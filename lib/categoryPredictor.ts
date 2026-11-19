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

/** In-memory model cache keyed by user-scoped predictor storage key. */
const memoryModelCache = new Map<string, PredictorModel>();
/** In-flight IndexedDB loads keyed by storage key to avoid duplicate reads. */
const inFlightLoads = new Map<string, Promise<PredictorModel>>();

/** Synchronously return the already-loaded in-memory model if cached. */
export function getCachedModel(userId?: string): PredictorModel | null {
  const key = getUserPredictorKey(userId);
  return memoryModelCache.get(key) ?? null;
}

/** Load the persisted model for a user, using the in-memory cache first. */
export async function loadModel(userId?: string): Promise<PredictorModel> {
  const key = getUserPredictorKey(userId);
  const cached = memoryModelCache.get(key);
  if (cached) return cached;

  const pending = inFlightLoads.get(key);
  if (pending) return pending;

  const loadPromise = (async () => {
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
      const resolved = stored || {};
      memoryModelCache.set(key, resolved);
      return resolved;
    } catch {
      return {};
    } finally {
      inFlightLoads.delete(key);
    }
  })();

  inFlightLoads.set(key, loadPromise);
  return loadPromise;
}

/** Persist the model to memory immediately and IndexedDB asynchronously. */
export async function saveModel(model: PredictorModel, userId?: string): Promise<void> {
  const key = getUserPredictorKey(userId);
  memoryModelCache.set(key, model);
  try {
    await localforage.setItem(key, model);
  } catch {
    /* swallow — predictor persistence must never break app flow */
  }
}

/**
 * Fire-and-forget incremental learning after a successful transaction save.
 * Updates the in-memory cache immediately if loaded and persists to IndexedDB
 * asynchronously. Never throws and never blocks transaction saving.
 */
export function learnAndSaveAsync(
  note: string | undefined,
  category: string | undefined,
  userId?: string
): void {
  if (!note || !category) return;
  const key = getUserPredictorKey(userId);
  const cached = memoryModelCache.get(key);

  if (cached) {
    learn(cached, note, category);
    void saveModel(cached, userId).catch(() => {});
    return;
  }

  void loadModel(userId)
    .then((model) => {
      learn(model, note, category);
      return saveModel(model, userId);
    })
    .catch(() => {
      /* swallow */
    });
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
    if (!Object.hasOwn(model, token)) model[token] = {};
    const bucket = model[token];
    const prev = Object.hasOwn(bucket, category) ? bucket[category] : 0;
    bucket[category] = prev + 1;
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
