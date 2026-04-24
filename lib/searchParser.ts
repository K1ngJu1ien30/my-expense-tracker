/**
 * Power Search parser for the History page.
 *
 * Accepts a free-form query string and returns a structured `SearchQuery`
 * that the caller can use to filter a list of transactions. Any token the
 * parser can't classify becomes a "free text" term that's matched against
 * note / category / account / amount.
 *
 * Syntax:
 *   food             free-text ("food" matched against notes, categories, etc.)
 *   #food            category filter       → category == "Food" (case-insensitive)
 *   @bank            account filter        → account startsWith "bank"
 *   >50              amount greater than 50
 *   <100             amount less than 100
 *   100-500          amount range inclusive
 *   "coffee latte"   quoted phrase (treated as single free-text term)
 *   last week        date shortcut (7 days ago → today)
 *   last month       date shortcut (previous calendar month)
 *   this month       date shortcut (current calendar month)
 *   april 2026       month + year  (parsed month name or "YYYY-MM")
 *   2025             year-only filter
 *
 * Everything is AND-combined. Filters compose — you can write:
 *   #food @bank >20 tokyo last week
 *
 * Unrecognised tokens fall through to free-text, so users can be sloppy and
 * still get useful results.
 */

import type { Transaction } from "./types";

export type AmountRange = { min?: number; max?: number };
export type DateRange = { from: number; to: number; label: string };

export type SearchQuery = {
  /** Free-text terms AND-combined against every textual field. */
  terms: string[];
  /** "food" — matched case-insensitively against `tx.category`. */
  categories: string[];
  /** "bank" — matched case-insensitively as a prefix of `tx.account`. */
  accounts: string[];
  /** Amount filter, AND-combined with the rest. */
  amount?: AmountRange;
  /** Date window in epoch ms, with a human label for the filter-chip UI. */
  date?: DateRange;
};

/**
 * Tokenise a query string, respecting quoted phrases. `"foo bar" baz` →
 * `["foo bar", "baz"]`. Case is preserved so free-text can render with the
 * user's original typing — matchers normalise when comparing.
 */
function tokenise(raw: string): string[] {
  const tokens: string[] = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    tokens.push(m[1] ?? m[2] ?? "");
  }
  return tokens.filter((t) => t.length > 0);
}

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/** Return epoch ms for the first/last millisecond of a Y-M day window. */
function dayBounds(year: number, month: number, day?: number) {
  if (day === undefined) {
    const from = new Date(year, month, 1).getTime();
    const to = new Date(year, month + 1, 1).getTime() - 1;
    return { from, to };
  }
  const from = new Date(year, month, day).getTime();
  const to = from + 86400000 - 1;
  return { from, to };
}

/**
 * Try to interpret a multi-word phrase ("last week", "april 2026") as a
 * date range. Returns null if the phrase doesn't match any shortcut.
 */
function parseDatePhrase(phrase: string): DateRange | null {
  const p = phrase.toLowerCase().trim();
  const now = new Date();

  if (p === "today") {
    const { from, to } = dayBounds(now.getFullYear(), now.getMonth(), now.getDate());
    return { from, to, label: "Today" };
  }
  if (p === "yesterday") {
    const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const { from, to } = dayBounds(y.getFullYear(), y.getMonth(), y.getDate());
    return { from, to, label: "Yesterday" };
  }
  if (p === "this week") {
    const dayOfWeek = now.getDay() || 7;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek + 1);
    const from = monday.getTime();
    const to = from + 7 * 86400000 - 1;
    return { from, to, label: "This Week" };
  }
  if (p === "last week") {
    const dayOfWeek = now.getDay() || 7;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek + 1);
    const from = monday.getTime() - 7 * 86400000;
    const to = monday.getTime() - 1;
    return { from, to, label: "Last Week" };
  }
  if (p === "this month") {
    const { from, to } = dayBounds(now.getFullYear(), now.getMonth());
    return { from, to, label: "This Month" };
  }
  if (p === "last month") {
    const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const m = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const { from, to } = dayBounds(y, m);
    return { from, to, label: "Last Month" };
  }
  if (p === "this year") {
    const from = new Date(now.getFullYear(), 0, 1).getTime();
    const to = new Date(now.getFullYear() + 1, 0, 1).getTime() - 1;
    return { from, to, label: "This Year" };
  }

  // Month name with optional year: "april" or "april 2026".
  const monthMatch = p.match(/^([a-z]+)(?:\s+(\d{4}))?$/);
  if (monthMatch) {
    const monthIdx = MONTH_NAMES.indexOf(monthMatch[1]);
    if (monthIdx >= 0) {
      const year = monthMatch[2] ? parseInt(monthMatch[2], 10) : now.getFullYear();
      const { from, to } = dayBounds(year, monthIdx);
      const label = `${monthMatch[1][0].toUpperCase()}${monthMatch[1].slice(1)} ${year}`;
      return { from, to, label };
    }
  }

  // Year only: "2025".
  const yearMatch = p.match(/^(\d{4})$/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1], 10);
    if (year >= 1970 && year <= 2100) {
      const from = new Date(year, 0, 1).getTime();
      const to = new Date(year + 1, 0, 1).getTime() - 1;
      return { from, to, label: String(year) };
    }
  }

  return null;
}

/**
 * Try to classify a single token as an amount operator. Returns either an
 * `AmountRange` or null if the token isn't numeric.
 */
function parseAmountToken(tok: string): AmountRange | null {
  // ">50" or "<100"
  const gtMatch = tok.match(/^>\s*(\d+(?:\.\d+)?)$/);
  if (gtMatch) return { min: parseFloat(gtMatch[1]) };
  const ltMatch = tok.match(/^<\s*(\d+(?:\.\d+)?)$/);
  if (ltMatch) return { max: parseFloat(ltMatch[1]) };

  // "100-500"
  const rangeMatch = tok.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/);
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1]);
    const max = parseFloat(rangeMatch[2]);
    return { min: Math.min(min, max), max: Math.max(min, max) };
  }

  return null;
}

/**
 * Parse a raw query string into a `SearchQuery` ready for filtering.
 *
 * The parser is intentionally forgiving: anything it can't classify is
 * preserved as free-text so typos and natural-language attempts still return
 * useful hits instead of empty screens.
 */
export function parseSearchQuery(raw: string): SearchQuery {
  const query: SearchQuery = { terms: [], categories: [], accounts: [] };
  if (!raw || !raw.trim()) return query;

  // Date phrases ("last week", "april 2026") are two tokens — scan for them
  // before single-token parsing so we don't shred them.
  const phrases = ["last week", "this week", "last month", "this month", "this year"];
  let working = raw;
  for (const phrase of phrases) {
    const re = new RegExp(`\\b${phrase}\\b`, "i");
    if (re.test(working)) {
      const range = parseDatePhrase(phrase);
      if (range) {
        query.date = range;
        working = working.replace(re, " ").trim();
      }
    }
  }

  // "april 2026" — month + year pair. Also handled here because it's two
  // tokens that must be interpreted together.
  const monthYearRe = new RegExp(`\\b(${MONTH_NAMES.join("|")})\\s+(\\d{4})\\b`, "i");
  const mym = working.match(monthYearRe);
  if (mym) {
    const range = parseDatePhrase(`${mym[1]} ${mym[2]}`);
    if (range) {
      query.date = range;
      working = working.replace(monthYearRe, " ").trim();
    }
  }

  for (const tok of tokenise(working)) {
    // Category filter: "#food"
    if (tok.startsWith("#") && tok.length > 1) {
      query.categories.push(tok.slice(1).toLowerCase());
      continue;
    }
    // Account filter: "@bank"
    if (tok.startsWith("@") && tok.length > 1) {
      query.accounts.push(tok.slice(1).toLowerCase());
      continue;
    }
    // Amount operators
    const amt = parseAmountToken(tok);
    if (amt) {
      query.amount = {
        min: amt.min ?? query.amount?.min,
        max: amt.max ?? query.amount?.max,
      };
      continue;
    }
    // Single-token date: "today", "yesterday", "april", "2025"
    const dateRange = parseDatePhrase(tok);
    if (dateRange) {
      query.date = dateRange;
      continue;
    }
    // Everything else — free-text
    query.terms.push(tok);
  }

  return query;
}

/**
 * Apply a parsed `SearchQuery` to a transaction list. All filters AND
 * together. Returns a new array — does not mutate input.
 */
export function applySearchQuery(
  transactions: Transaction[],
  q: SearchQuery
): Transaction[] {
  // Precompute lowercase terms so we don't re-lowercase per row.
  const termsLower = q.terms.map((t) => t.toLowerCase());

  return transactions.filter((tx) => {
    // Categories: tx.category must match one of the requested categories.
    if (q.categories.length > 0) {
      const cat = (tx.category || "").toLowerCase();
      if (!q.categories.some((c) => cat === c || cat.includes(c))) return false;
    }

    // Accounts: prefix or inclusion match is friendlier than strict equality.
    if (q.accounts.length > 0) {
      const acc = (tx.account || "").toLowerCase();
      if (!q.accounts.some((a) => acc.includes(a))) return false;
    }

    // Amount range.
    if (q.amount) {
      const amt = Number(tx.amount);
      if (q.amount.min !== undefined && amt < q.amount.min) return false;
      if (q.amount.max !== undefined && amt > q.amount.max) return false;
    }

    // Date range.
    if (q.date) {
      const when = new Date(tx.date).getTime();
      if (when < q.date.from || when > q.date.to) return false;
    }

    // Free-text terms — must ALL match at least one textual field.
    if (termsLower.length > 0) {
      const haystack =
        `${tx.note || ""} ${tx.category || ""} ${tx.account || ""} ${tx.amount}`.toLowerCase();
      for (const term of termsLower) {
        if (!haystack.includes(term)) return false;
      }
    }

    return true;
  });
}

/**
 * Build a human-readable chip list describing what the query matched.
 * Used by the UI to render removable filter pills above the transaction list.
 */
export type SearchChip = { key: string; label: string };

export function describeChips(q: SearchQuery): SearchChip[] {
  const chips: SearchChip[] = [];
  for (const c of q.categories) chips.push({ key: `cat:${c}`, label: `#${c}` });
  for (const a of q.accounts) chips.push({ key: `acc:${a}`, label: `@${a}` });
  if (q.amount?.min !== undefined && q.amount?.max !== undefined)
    chips.push({ key: "amt", label: `${q.amount.min}–${q.amount.max}` });
  else if (q.amount?.min !== undefined)
    chips.push({ key: "amt", label: `> ${q.amount.min}` });
  else if (q.amount?.max !== undefined)
    chips.push({ key: "amt", label: `< ${q.amount.max}` });
  if (q.date) chips.push({ key: "date", label: q.date.label });
  for (const t of q.terms) chips.push({ key: `term:${t}`, label: `"${t}"` });
  return chips;
}
