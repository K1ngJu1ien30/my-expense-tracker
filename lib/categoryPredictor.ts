/**
 * Client-side category predictor.
 *
 * Learns from the user's own transaction history: every expense contributes
 * (note, category) co-occurrences into a weighted token-frequency map. When
 * the user types a new note, we score each known category by summing the
 * token→category weights and suggest the winner only when it's confidently
 * above the runner-up.
 *
 * Design decisions:
 *   • LocalForage-backed, not Supabase: suggestion must be instant during
 *     typing, and the map is derived data — rebuildable from transactions at
 *     any time.
 *   • Token-level (not full-note): generalises across "starbucks latte" and
 *     "morning starbucks" without overfitting.
 *   • Guards against noise via three tests: min score, margin over #2, and
 *     a cold-start threshold on total transaction count.
 *   • Never auto-applies — the UI surfaces it as a dismissible pill.
 *
 * Persistence key: `category_predictor_v1`
 */

import localforage from "localforage";
import type { Transaction } from "./types";
import { getUserPredictorKey, LEGACY_PREDICTOR_KEY } from "./cacheKeys";

/** Shape: token → { category → occurrence count } */
export type PredictorModel = Record<string, Record<string, number>>;

/** Stop-words too generic to carry predictive signal. */
const STOP_WORDS = new Set([
  "a", "an", "and", "at", "be", "by", "for", "from", "in", "is", "it",
  "me", "my", "of", "on", "or", "our", "the", "this", "to", "was", "we",
  "with", "i", "am",
]);

/** Minimum total transactions before the predictor is allowed to suggest. */
const COLD_START_THRESHOLD = 5;
/** Minimum score the winning category must have. */
const MIN_SCORE = 2;
/** Winner must beat #2 by at least this multiplier. */
const CONFIDENCE_MARGIN = 1.5;

/**
 * Normalise and tokenise a free-text note. Lowercases, strips punctuation,
 * splits on whitespace, filters short/stop-word tokens.
 */
export function tokenise(note: string): string[] {
  if (!note) return [];
  return note
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
}

/** Load the persisted model for a user, or an empty one if absent. */
export async function loadModel(userId?: string): Promise<PredictorModel> {
  const key = getUserPredictorKey(userId);
  try {
    let stored = await localforage.getItem<PredictorModel>(key);
    if (!stored && userId) {
      // Migrate from legacy un-scoped key if exists
      const legacy = await localforage.getItem<PredictorModel>(LEGACY_PREDICTOR_KEY);
      if (legacy) {
        stored = legacy;
        await localforage.setItem(key, legacy);
        await localforage.removeItem(LEGACY_PREDICTOR_KEY);
      }
    }
    return stored || {};
  } catch {
    return {};
  }
}

/** Persist the model to IndexedDB for a user. Swallows errors silently. */
export async function saveModel(model: PredictorModel, userId?: string): Promise<void> {
  const key = getUserPredictorKey(userId);
  try {
    await localforage.setItem(key, model);
  } catch {
    /* swallow */
  }
}

/**
 * Teach the model a single (note, category) pair. Mutates and returns the
 * passed model so callers can chain multiple learn() calls before saving.
 */
export function learn(
  model: PredictorModel,
  note: string | undefined,
  category: string | undefined
): PredictorModel {
  if (!note || !category) return model;
  const tokens = tokenise(note);
  if (tokens.length === 0) return model;

  for (const token of tokens) {
    if (!model[token]) model[token] = {};
    model[token][category] = (model[token][category] || 0) + 1;
  }
  return model;
}

/**
 * Rebuild the entire model from a transaction history array. Used for cold
 * bootstrapping on first run, or when a user wipes + restores.
 *
 * Only expense transactions with a note contribute signal — transfers and
 * income are excluded because their categories are structural, not learned.
 */
export async function rebuildFromHistory(txs: Transaction[], userId?: string): Promise<PredictorModel> {
  const model: PredictorModel = {};
  for (const tx of txs) {
    if (tx.type !== "Expense") continue;
    if (tx.deleted_at) continue;
    learn(model, tx.note, tx.category);
  }
  await saveModel(model, userId);
  return model;
}

/**
 * Score and return the best category suggestion for a given note, or null
 * when confidence is too low. The caller shouldn't need to interpret the
 * return shape beyond `category` and `confidence`.
 */
export type Prediction = {
  category: string;
  score: number;
  runnerUp: string | null;
  runnerUpScore: number;
};

export function predict(
  model: PredictorModel,
  note: string,
  totalTransactionCount: number
): Prediction | null {
  // Cold-start guard: don't show suggestions until the user has some history.
  if (totalTransactionCount < COLD_START_THRESHOLD) return null;

  const tokens = tokenise(note);
  if (tokens.length === 0) return null;

  // Aggregate scores across all tokens.
  const scores: Record<string, number> = {};
  for (const token of tokens) {
    const bucket = model[token];
    if (!bucket) continue;
    for (const [cat, count] of Object.entries(bucket)) {
      scores[cat] = (scores[cat] || 0) + count;
    }
  }

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return null;

  const [topCat, topScore] = sorted[0];
  const runnerUp = sorted[1] ?? null;
  const runnerUpScore = runnerUp ? runnerUp[1] : 0;

  // Minimum-confidence gates: need enough signal AND a clear winner.
  if (topScore < MIN_SCORE) return null;
  if (runnerUp && topScore < runnerUpScore * CONFIDENCE_MARGIN) return null;

  return {
    category: topCat,
    score: topScore,
    runnerUp: runnerUp ? runnerUp[0] : null,
    runnerUpScore,
  };
}
