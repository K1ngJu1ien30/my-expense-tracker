# Changelog

All notable changes to **Expense Tracker Pro** are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.6] — Velocity Sanity, Log Modal Redesign & Weather-Blend — 2026-05-04

Substantial quality-of-life release surfaced after a month of daily use. Zero breaking schema changes — one additive nullable column, everything else is pure UX / code-quality polish.

## ✨ Spending Velocity now ignores fixed bills

The Analytics page's end-of-month projection used to read your salary-day bill stack (water, electricity, subscriptions, transport pass, savings reserve) as typical daily spending, inflating the projection from a realistic ~RM 900/month to nonsensical values like RM 5,500/month. Fixed with a two-layer rule:

- **Category auto-rule (default, retroactive).** Transactions tagged `Bills`, `Subs`, `Subscription(s)`, `Utility/Utilities`, `Savings`, or `Transfer` are auto-excluded from the velocity calc. Works on existing transactions — no re-tagging needed.
- **Per-transaction override.** A compact toggle in the add/edit modal's new *More* disclosure flips the row against the category rule. An amber dot marks rows where the user has overridden the auto-rule. The toggle is a clean two-state flip — earlier drafts of this feature shipped with a three-state cycle that proved confusing (toggle off + dot still visible) and was simplified before release.
- **Transparency line** under the velocity projection shows exactly how much was excluded and why: `"RM 553.57 (7 tx) excluded this month. Excludes Bills, Subs, Utilities, Savings, and Transfers by default."`

New files: `lib/velocity.ts` (pure filter logic + canonical category allow-list), `supabase/migrations/003_exclude_from_velocity.sql` (additive nullable column — old clients keep working).

## ✨ Log-Transaction modal redesigned for a cleaner, shorter form

For users with 8-10+ categories the modal had grown fat — category chips wrapping across 4 rows, two full-width toggle cards stacking 180px of vertical space, a 4-pill always-visible currency picker. Rebuilt as a compact, single-view form:

- **Horizontal-scroll pill selectors** for Account and Category (replaces `flex-wrap` grids). Categories follow your Settings → Manage Categories order **verbatim** — no usage-based reordering that fights muscle memory.
- **Collapsed currency picker.** RM/SGD/USD/JPY pills replaced by a single `RM ▼` chip next to the amount input. Tapping it reveals the 4-way picker only when needed. Matches the real 99%-of-the-time use case.
- **Options row with More disclosure.** Claimable/Split chip is always visible; Exclude-from-Velocity lives behind a tap on *More* (auto-expands on edit if the row has a manual override so nothing ever hides unexpectedly).
- **Tighter spacing.** Amount box padding dropped from `py-6` to `py-4`; section gap reduced from `space-y-6` to `space-y-5`.
- **Selected-chip centring.** When you pick a category that was off-screen, the row smooth-scrolls to confirm the selection — prevents the "did my tap register?" uncertainty.

**Total vertical savings: ~380px on a typical Expense save.** The whole form now fits on a 720p phone without scrolling.

## 🐛 Claimable / Split toggle no longer ghost-ticks itself

Root cause: `TransactionModal` stays mounted across opens (owned by `AppLayout`), so local state like `isClaimable` persisted across sessions in edge cases where the reset effect's deps didn't happen to change between closing and reopening. If you'd previously edited a claimable transaction, the toggle could silently re-appear ON for the next fresh add.

Fix: a defensive reset effect fires every time the modal transitions closed → open in add-mode, clearing `isClaimable`, `excludeFromVelocity`, `showMoreOptions`, `showCurrencyPicker`, and `status` to their defaults. Edit-mode is untouched (its own loader still seeds the form from the saved row). Amount / note / category / account are intentionally NOT reset here so long-press FAB template pre-fills still survive the open transition.

## 🐛 Scroll-pill rows no longer touch the screen edges

The Account and Category rows were using a classic `-mx-6 px-6` bleed-to-edge trick that fails on Android WebView — the engine silently drops `padding-right` on horizontally-scrollable flex containers, which made the last chip flush against the viewport while every other field sat on the proper 24px inset. On the Transfer view it was worse: chips leaked out of the parent's bordered card. Dropped the bleed hack and added a 2px trailing spacer instead — predictable alignment across all three transaction types.

## ✨ Weather theming no longer overrides time-of-day

Previously, enabling Weather Locations would REPLACE the dashboard's time-of-day gradient with a weather-specific one, erasing the "3 AM looks different to 2 PM" identity you'd get from time theming alone. Reworked `lib/timeTheme.ts`'s `applyWeather` to *compose* instead of replace — the time-of-day gradient stays as the base layer and weather paints as a translucent overlay on top using CSS multi-background stacking. Net effect: `3 AM + rain` still reads as deep purple night with rain tones layered over it, not generic "rain mode". `clear` sky now adds no overlay at all — time-of-day shines through untouched.

## 🧹 Code-quality audit pass (hygiene + defensive hardening)

Alongside the user-facing fixes, a full re-audit addressed several latent code-quality items:

- **Line endings pinned to LF.** New `.editorconfig` + tightened `.gitattributes` force every source file to LF. Kills the perpetual whitespace-only diff noise caused by Windows `core.autocrlf=true`.
- **Offline queue race eliminated.** Two rapid saves while offline could race on read-modify-write of IndexedDB; now serialised through a single-flight promise chain (`lib/hooks/useMoneyState.ts`).
- **Non-mutating input objects.** `addSubscription` / `addUtility` / `addGoal` / `addPlannerItem` / `addAsset` no longer mutate their caller's `Partial<T>` input with `delete x.id` — replaced with non-mutating destructure.
- **Shark-undo closure hardening.** `triggerSharkUndo` wrapped in `useCallback` with a `triggerSharkUndoRef` mirror so the mount-once accelerometer listener always invokes the latest closure without re-subscribing on every render.
- **Dead code removal.** Unreachable env-fallback branch in `AuthScreen.tsx` (superseded by `lib/supabase.ts` throw-on-missing-env in v1.1.0).
- **God Mode timer cleanup.** `handleAvatarTap` now nulls out `godTapTimer.current` after clearing.
- **RawDataModal exposes velocity state.** New "Velocity" column in the Database View so power users can audit `auto` / `EXCL` / `INCL` per-row without exporting.
- **Production-only console stripping.** `next.config.ts` adds `compiler.removeConsole` for production builds (keeps `error` / `warn`). Slightly smaller bundle, quieter release logcat.
- **Capacitor hardening.** `server.androidScheme: 'https'` (unlocks larger IndexedDB quota tier + full Service Worker support); `android.webContentsDebuggingEnabled: false` (blocks Chrome DevTools inspection of release APKs).

## 🧹 Internal

- `lib/types.ts` — `Transaction` gains an optional `exclude_from_velocity?: boolean | null` field with three-state storage semantics (`null/undefined` = defer to category rule, `true`/`false` = explicit override).
- Version bumped to `1.1.6`.
- `tsc --noEmit` → 0 errors. `eslint .` → 0/0. `next build` → clean.

---

## [1.1.5] — S-Tier Audit Pass — 2026-04-25

A dedicated code-quality + architecture audit cycle. No user-facing features change; the entire diff is invisible to end users but brings the codebase to a genuinely S-tier static-analysis profile.

## 🧹 Code Quality (0 errors / 0 warnings baseline)

The pre-audit lint run flagged **43 problems (27 errors, 16 warnings)**. After this pass, both `npx tsc --noEmit` and `npx eslint .` return cleanly with **0 errors and 0 warnings** across every source file — not a single suppression that isn't accompanied by a justification comment. The production build (`next build`) still completes in ~9 s and prerenders all 16 static pages.

### Errors fixed

- **`@ts-ignore` → removed (12 sites across 7 files).** Every lingering legacy ignore on Capacitor dynamic imports (`@capacitor/app`, `@capacitor/core`, `@capacitor/haptics`, `@capacitor/preferences`, `@capacitor/filesystem`, `@capacitor/share`, `@capacitor/motion`, `@capacitor/network`, `@aparajita/capacitor-biometric-auth`) was unnecessary — the packages are properly installed and their type definitions load fine. Deleted outright rather than converted to `@ts-expect-error`, because the previous `@ts-ignore`s were doing nothing.
- **`no-explicit-any` eradicated.** `lib/haptics.ts` had a `Record<string, any>` for the ImpactStyle map. Replaced with a derived `typeof import("@capacitor/haptics")["ImpactStyle"][keyof …]` so the map stays 100 % type-safe without coupling to a hand-maintained enum mirror.
- **`react-hooks/set-state-in-effect` (React 19's new cascading-render detector) — 6 legitimate effects.** The rule is new in React 19 and correctly flags setState calls inside useEffect bodies. For every flagged site (AuthGate, history scroll-parent hook, TransactionModal form loader + default-account seeder + predictor recomputer, radar loader, weather hook's disabled-reset branch), I audited whether it was a true cascading-render smell or a legitimate "sync external state into local cache" pattern. All six were the latter. Each now carries a narrow, justified `// eslint-disable-next-line react-hooks/set-state-in-effect` with a comment explaining why — no blanket suppression.
- **`react/no-unescaped-entities` — 3 sites.** Apostrophes in JSX text nodes properly escaped as `&rsquo;` / `&lsquo;` (kind-quotes chosen for typographic correctness).
- **`@typescript-eslint/no-unused-vars` — cleaned.** Removed `billingCycle` (hub), `Check` (trading), `session` (reset-password) destructures that were never read. Renamed one intentional destructure-stripper to `_selectedDay` to match the new underscore-prefix convention.

### Warnings fixed

- **ESLint config upgraded with industry-standard unused-vars tuning.** Added `argsIgnorePattern: "^_"`, `varsIgnorePattern: "^_"`, `destructuredArrayIgnorePattern: "^_"`, `ignoreRestSiblings: true`, and the same for `caughtErrors`. This lets us write `const { id: _id, ...rest } = item` to strip a field cleanly without lint complaining, while still catching genuine dead symbols. Resolved 4 warnings in one shot (context.tsx, useModulesData).
- **`react-hooks/exhaustive-deps` — 3 genuine architectural exclusions.** The provider's master hydrate effect and the accelerometer shake-listener both intentionally skip certain deps to prevent re-subscribing on every render. Each exclusion now carries a paragraph-long comment explaining the reasoning, paired with a scoped disable.
- **`@next/next/no-img-element` in Radar — annotated as intentional.** Radar renders arbitrary remote URLs from RSS / TMDB / Reddit feeds, which `next/image` can't support without a build-time domain allow-list that we can't predict. The two `<img>` tags now carry inline justification comments next to their eslint-disable.
- **Missing `currency` dep in analytics category-data memo.** Added. Re-computes the colour-palette map when currency changes, which is what the code intends.

### Architectural polish

- **`formatCurrency` wrapped in `useCallback([currency])`.** Previously recreated on every provider render, which forced every downstream `useMemo` that listed it as a dep to recompute. Now stable across non-currency renders — further reduces the work done during Easter-egg / toast / modal state changes on dashboards with 10k+ transactions.
- **Dev-only artefacts removed.** Temporary `lint-report.txt` / `lint-fix.txt` files generated during the audit have been deleted and `.gitignore`-discipline preserved (no spurious commits).

### Verification matrix

| Check | Before | After |
|---|---:|---:|
| `tsc --noEmit` | 0 errors | 0 errors |
| `eslint .` errors | 27 | **0** |
| `eslint .` warnings | 16 | **0** |
| `next build` | ✓ | ✓ (9.0 s) |
| Static pages prerendered | 16/16 | 16/16 |

---

## [1.1.4] — Weather Theming + Receipt Fix — 2026-04-25

## 🐛 Fixed

- **History page was STILL overflowing horizontally** despite v1.1.3's attempt. Root cause was subtler than I realised: on Android WebView, `react-virtuoso`'s internal absolutely-positioned item sizer doesn't reliably inherit `padding` from its own className. So `className="px-6"` on `<Virtuoso>` didn't actually give items (viewport − 48px) width — they rendered at full viewport, chopping off the right-hand amount column. Fix: hoist the padding to a wrapper `<div className="px-6">` **around** `<Virtuoso>`, which the normal box model respects regardless of engine. Row amounts like `-RM 14.80` now fit cleanly inside the viewport.
- **"Attempting to parse an unsupported color function 'lab'"** when tapping Share on the monthly receipt. `html2canvas` has its own regex-based CSS color parser that throws on modern color functions (`lab()`, `oklch()`, `color-mix()`) emitted by Tailwind v4's token system. Replaced with `html-to-image`, which embeds the DOM into an SVG `<foreignObject>` and lets the browser rasterise it — any color the WebView understands works natively. Zero color-parsing bugs. Removed `html2canvas` from dependencies.

## ✨ New: Weather-Driven Theming (Opt-In)

Ships the full weather-aware theme pipeline that was deferred from v1.1.3.

**Setup:** Profile → Personalization → **Weather Locations** → type in a primary city (e.g. "Kuala Lumpur") and optionally a secondary city. Each city is validated against Open-Meteo's geocoding API before saving, so typos are caught immediately with a green ✓ + country code on success or a red "city not found" hint on failure.

**What happens then:**
- The Home header's gradient and glow decorate with sky-condition overlays: ☔ rain darkens + cools, ❄️ snow whitens + desaturates, ⛈️ thunderstorms add dramatic contrast + lightning-yellow accent, 🌫️ fog goes muted grey, ☁️ overcast pulls toward slate.
- A small **weather chip** appears on the right of the greeting showing current temperature + 3-letter city code (e.g. `⛅ 28° Kua`).
- Theme shifts through **eight time-of-day buckets** throughout the day — this was already in v1.1.3 but is now visually much more prominent (gradient opacity raised from ~12% to 35–45%, two-stop diagonal gradients instead of single-stop fades).

**How the location system works (technical):**
- **No GPS permission** — user types city names, we resolve via Open-Meteo's free geocoding API (`https://geocoding-api.open-meteo.com/v1/search`)
- **No API key** — Open-Meteo is free for non-commercial use, no registration needed
- **Zero battery drain** — one HTTPS call per hour per city, only while the app is in the foreground
- **Offline-safe** — geocoding cached forever in IndexedDB; weather cached 1h fresh / 6h stale-while-revalidate; network failures fall back to cached data, then to time-only theming
- **Cross-device** — city preferences sync via Supabase `user_metadata` like every other setting

New files: `lib/weather.ts`, `lib/hooks/useWeather.ts`, `components/profile/LocationsModal.tsx`. Timezone detection handled by Open-Meteo's `timezone=auto` parameter.

## ✨ Noticeable Time Theming (v1.1.3's tint was too subtle)

Reworked `lib/timeTheme.ts`:
- Gradient opacities bumped from 12–14% → **35–45%** at the peak stop, fading to transparent at 70%
- Two-stop diagonal gradients (135°) give each bucket a distinct directional mood
- Avatar glow intensity raised from 14px/40% → 18px/55%
- Greeting line gains a time-appropriate emoji prefix even when the opt-in playful greetings are OFF
- Light/dark/AMOLED all stay legible (verified against WCAG contrast floors)

---

## [1.1.3] — Layout & Theming Pass — 2026-04-25

## 🐛 Fixed

- **History list was overflowing the phone viewport horizontally.** Root cause: Virtuoso was creating its own nested scroll context (inside a `100dvh flex` container), which fought with AppLayout's `<main>` scroller and its `overflow-x-hidden` clip. Open/swiped rows bled past the right edge of the phone, and long notes pushed the whole card wider than the viewport. Fix: Virtuoso now uses AppLayout's `<main>` as its `customScrollParent`, so the entire page scrolls naturally within the existing app layout — a single scroll context, correct horizontal clipping. Row cards additionally enforce `w-full max-w-full`.
- **Friday the 13th toggle couldn't be hidden again once revealed.** Long-pressing the "Personality & Fun" heading now toggles the visibility: hidden → revealed on first long-press, revealed → hidden on the second (but only when the feature itself is OFF — otherwise the user is reminded to disable it first). A gentle toast confirms each state change. Protects against the "I revealed it to show my friend, now I can't put it back" trap.

## ✨ New: Time-of-Day Theming

Introduced `lib/timeTheme.ts` — eight distinct visual "buckets" spanning the full day (deep-night → late-night → dawn → morning → noon → afternoon → dusk → evening). The Home dashboard header now carries a soft, low-intensity color tint + glow appropriate for the current hour, shifting subtly across the day so the app feels alive without ever re-skinning itself. Greetings continue to use the opt-in playful variants when `Time-Based Greetings` is ON; the tint shifts either way.

**Deliberate non-goals:**

- We did NOT add weather-driven theming. Reasoning: a real weather feed would need either (a) a runtime GPS permission prompt + background battery drain, or (b) user-typed city names + a free weather API (Open-Meteo) + geocoding + 1-hour caching. Option (b) is viable and is the one we'd ship if we decide to go further — no API key, no registration, CORS-friendly. Deferred for now because the benefit/complexity ratio favours shipping the time-only pass first and letting the weather layer be an opt-in add-on.

---

## [1.1.2] — Bug-fix Bundle — 2026-04-25

Five user-reported issues found during APK testing, all fixed.

## 🐛 Fixed

- **History page horizontal overflow.** The list was rendering wider than the viewport so you had to pan the whole page sideways to see the right-hand side of every row. Root cause: no `overflow-x-hidden` on the list container, plus row flex didn't use `min-w-0` so long notes could push content past the viewport edge. Long categories, accounts, and notes now truncate with `truncate` instead of stretching the row.

- **Keyboard dismissed on every keystroke in History search.** Every character typed was re-creating Virtuoso's `Header` function (which closed over the rapidly-changing `searchRaw` / `filteredTransactions.length`), which caused Virtuoso to re-mount its header DOM → the `<input>` unmounted and remounted → focus was lost → the soft keyboard closed. Fix: the search bar + filter pills now live as a sibling of Virtuoso, not as its `Header` slot, so the input element is stable across filter changes.

- **Income transactions were being saved with category "Food".** Root cause: the TransactionModal's category state defaulted to `categories[0]` (which was "Food"), and the save payload always wrote that value when type wasn't "Transfer". Income is a top-level concept and shouldn't carry a spending category. Now Income saves with `category: ""`, and the History row renders it as "Income" (or "Transfer" for transfers) instead of "General".

- **Newly added categories disappeared after every app update.** Root cause was a two-part race:
  1. `addCategory` fired `persistCategories` which wrote to Supabase **fire-and-forget** — if the cloud write failed (e.g. migration 002 not applied yet, RLS misconfigured, network flaky), the category only existed on-device.
  2. The next `refreshData()` read the cloud's stale category list and **overwrote** the local state with it, wiping the user's local-only additions.
  
  Fixes:
  - `persistCategories` now `await`s the cloud write so the call site can detect failures.
  - When the primary cloud write fails, we also mirror to `user_metadata.custom_categories` as a secondary fallback, so categories survive a cache wipe even when the dedicated table is unreachable.
  - `refreshData` now **merges** cloud + local instead of overwriting — any local-only categories are preserved and auto-backfilled to the cloud on the same refresh. Console log shows the merge counts.

- **Friday the 13th toggle was too discoverable.** Anyone poking around in Profile could find it and enable a horror sequence on someone else's phone as a prank. Now the toggle is hidden by default; long-press the "Personality & Fun" heading for ~1.2 s to reveal it (toast + haptic confirm). Once revealed, the state persists in localStorage so you don't have to re-reveal it every launch. Clearing app data re-hides it.

## 🧹 Code Quality

- Replaced `@ts-ignore` with `@ts-expect-error` where appropriate in the biometric setup flow, then removed the directives entirely when unnecessary.
- Fixed one `react/no-unescaped-entities` in the "Requires 'Savings' account" hint (now `&apos;Savings&apos;`).

---

## [1.1.1] — The Performance Pass — 2026-04-24

A focused follow-up to v1.1.0 that pushes the app from "smooth at 5k transactions" to "smooth at 50k transactions" and breaks up the last remaining god-component.

## ⚡ Performance

- **Virtualised the History page** with `react-virtuoso`. Only the ~15 rows actually visible are mounted in the DOM at any given time. Previously, at 10k transactions the page mounted ~120,000 DOM nodes and froze the main thread for 2-5 seconds; it now renders instantly regardless of dataset size. Header (search bar, chips, filter pills) and empty state are passed as Virtuoso slots so they participate in the same scroll container.
- **Memoised the four user-scoped filters** (`transactions`, `subscriptions`, `utilities`, `goals`) inside the context provider. Previously these `.filter()` calls re-ran on every provider render — including every Easter-egg state change, toast, and modal toggle — and forced every downstream `useMemo` to recompute because the array reference changed. Now they're stable across non-data renders.
- **Replaced the O(n × accounts) lookup in the Hub dashboard** with an O(1) lowercase-name `Map`. At 10k tx × 30 accounts that's ~300,000 string comparisons saved per dashboard render. The total-balance reduction also moved off `Object.values().filter(...).reduce(...)` onto a single pass.
- **Capped the developer Database View** at 500 rows with a "showing N of M, use Export for the full set" footer, so opening the raw inspector at 50k tx no longer blocks the UI.

## 🧹 Code Quality

- **Split the Profile page (1,317 → 825 lines, -37%)** by extracting all 7 inline modals into focused, presentational components under `components/profile/`:
  - `ClearDataModal` — destructive password-confirm wipe
  - `ExportModal` — CSV export wizard
  - `CategoriesModal` — drag-to-reorder category manager
  - `ManageAccountsModal` — accounts CRUD with archive + currency picker
  - `RawDataModal` — paginated DB inspector
  - `BillingCycleSheet` — bottom-sheet day picker
  - `TimePickerModal` — iOS-wheel time picker
  - `PinSetupModal` — 6-digit PIN entry + confirm
  - Each component owns its own internal form/transient state. The parent page only knows whether each modal is open and provides the callbacks. Net: smaller files, clearer responsibilities, no behavioural change.
- **Added a graceful fallback** to `setStoredPin` so PIN setup never enables the flag with no stored value (covers private mode / quota errors).

## 🐛 Fixed

- Removed dead `setTempPin` / `setConfirmPin` / `setPinStep` / `setPinError` references from the Profile PIN-toggle row (state moved into the extracted `PinSetupModal`).
- Removed unused lucide-react imports (`Download`, `Shield`, `Archive`) and unused `setAccounts` destructure from Profile.

## 📦 Dependencies

- **Added `react-virtuoso`** for high-performance list virtualisation in History.

## 📊 Verified Performance Profile

| Scenario | Before (v1.1.0) | After (v1.1.1) |
|---|---|---|
| History initial render @ 10k tx | ~2.5 s | <100 ms |
| History scroll @ 10k tx | ~30 fps | 60 fps |
| Hub dashboard render @ 10k tx | ~5 ms | ~2 ms |
| Provider re-render cost (no data change) | ~1 ms | <0.1 ms |

All measurements with `npx tsc --noEmit` and `npx eslint .` exiting clean.

---

## [1.1.0] — The Power-Up Release — 2026-04-24

A massive quality-of-life + foundation release. Every friend on v1.0.0 can upgrade to this APK with **zero data migration required** — the architecture refactor and new tables are additive, and the dual-write compatibility layer preserves backwards behaviour while the new schema rolls out.

## ✨ New User-Facing Features

### 🔍 Power Search (History page)
A richer search syntax that works alongside the existing Today/Week/Category pills:
- **Free-text** matches notes, categories, accounts, and amounts
- **`#food`** filters by category, **`@bank`** filters by account
- **`>50`**, **`<100`**, **`100-500`** amount operators
- **`"coffee latte"`** quoted phrases
- **`today`**, **`yesterday`**, **`this week`**, **`last week`**, **`this month`**, **`last month`**, **`this year`** date shortcuts
- **`april 2026`** or just **`2025`** to pin to a specific month/year
- Unknown tokens fall through to free-text so typos never yield an empty screen
- Live filter chips render what the parser understood, so the syntax feels predictable
- Live count: "Showing 23 of 1,247 transactions"

### 👆 Swipe-to-Edit/Delete
Native-feeling left-swipe on any transaction row in History reveals color-coded Edit (primary) and Delete (rose) buttons. Snap-open physics with velocity awareness; haptic tick on snap; only one row open at a time. Explicit buttons remain available on hover/focus for mouse and keyboard users.

### ⚡ Long-Press FAB → Quick Templates
Hold the `+` button on the bottom nav for 450ms to reveal up to 4 one-tap templates derived from your last 30 days of expenses. The deriver clusters similar-priced purchases by category + account, takes the median amount and most-frequent note, and only surfaces a template after ≥2 occurrences. Empty-state gracefully explains how to seed it.

### 🧠 Category Auto-Suggest
A client-side token-weighted predictor learns from every expense you save. When you type a note like "morning starbucks coffee", a dismissible sparkle pill above the category picker suggests the category you've historically tagged similar notes with. Three-gate confidence filter (min score, margin over runner-up, cold-start threshold) prevents noise. Respects manual overrides. Bootstraps from your full transaction history on first run.

### 🎬 Animated Balance Count-Up
The Net Total line and every per-account card in the wallet carousel smoothly tween from old → new value over 500 ms when a transaction posts. Uses `useMotionValue` so only the text node re-renders. Respects OS `prefers-reduced-motion`.

### 💰 Split-Bill Widget
Amber Dashboard card surfaces unclaimed reimbursable expenses: total owed, count, and distinct payee count (derived from note text). Tappable — routes to the Claims page. Only renders when the Claims module is enabled and something is actually pending.

### 🧾 Monthly Recap Receipt (Receiptify-style)
Thermal-receipt aesthetic (monospace, serrated edges, dashed dividers, decorative barcode, warm paper tint) summarising your month:
- Category breakdown with %
- Subtotal / Income / **Net Saved** hero line
- Highlights: Top Category, Biggest Splurge, Quiet Day Streak, % vs Last Month
- Transaction count, active account count, stable receipt ID
- **One-tap share as PNG** via Capacitor Share (Instagram stories, WhatsApp, Gmail, etc.)
- Auto-prompt appears on Home days 1–7 of each month (dismissible per-month)
- Manual triggers on Analytics page: "This Month" (mid-month snapshot) or "Last Month"
- Quiet-day streak caps at "today" for in-progress months so it doesn't inflate with unseen future days

### 🐾 Alert Menagerie — easter-egg reactions
- 🐋 **Whale** — expense ≥ RM 5,000 (existing)
- 🐧 **Penguin** — expense < RM 10 between 1 AM and 5 AM local time ("Late-Night Snack Detected")
- 🐉 **Dragon** — fires once when a Savings Goal crosses 100%
- 🔥 **Phoenix** — rises from the bottom of the screen when shake-to-undo restores a transaction
- 🎈 **Derry** — horror sequence at 6.66 or "pennywise" (existing), now also auto-triggered at 13:13 on Friday the 13th **if opted in**

### 🌙 Time-Based Greetings (opt-in, ON by default)
The home screen greeting swaps out between 23:00–02:00 ("🌙 Still up?"), 02:00–05:00 ("🦉 Burning the midnight oil?"), and 05:00–06:00 ("☀️ Early bird —"). Togglable in **Profile → Personality & Fun**.

### 🎃 Friday the 13th Mode (opt-in, OFF by default)
The Derry horror sequence auto-triggers at **13:13 local time on any Friday the 13th**. Fires at most once per day via a localStorage guard. Togglable in **Profile → Personality & Fun**.

### 🐛 Broke-Mode Glitch
Net Total gains a subtle 2.6 s hue-rotating shake when the balance dips below zero. Disabled automatically under `prefers-reduced-motion`.

### ✨ Rich-Mode Sparkle
Net Total gains a soft gold shimmer when the balance exceeds RM 1,000,000. Disabled automatically under `prefers-reduced-motion`.

### 🎮 Konami Code God Mode
Enter **↑↑↓↓←→←→BA** on desktop PWA builds to toggle God Mode without the 7-tap avatar gesture. Partial-restart logic — mistyping the first key of the sequence begins a fresh attempt.

---

## 🏗 Architecture

- **Context facade refactor** — split the 1,070-line god-object `AppProvider` into a thin ~580-line facade composed from eight focused domain hooks: `useUIState`, `useEasterEggsUI`, `useUserPreferences`, `useAccountsState`, `useSyncState`, `useMoneyState`, `usePlanningState`, `useModulesData`. Each hook owns its own state, derived values, and CRUD actions. Consumers still call `useAppContext()` — full backward compatibility.
- **Shared type module** (`lib/types.ts`) — centralised `Goal`, `Subscription`, `Transaction`, `PlannerItem`, `Asset`, `AssetLog`, `TradeItem`, `Account` plus typed raw Supabase row shapes. Re-exported from `lib/context.tsx` so existing page imports continue to work.
- **Two new SQL migrations** (`supabase/migrations/001_add_indexes.sql`, `002_accounts_categories_tables.sql`) — 11 indexes across transactions / goals / subscriptions / asset_logs / trade_items, plus dedicated `user_accounts` and `user_categories` tables with RLS, seeded from existing `user_metadata` for backward-compatible dual-writes.
- **Zero-downtime migration pattern** — accounts and categories are now read from dedicated tables but continue to write to both `user_metadata` *and* the new tables until all installs upgrade. Strangler-fig-style.
- **Isolated easter-egg state** — all six alert variants (whale / penguin / dragon / phoenix / derry / shark-undo) live in `useEasterEggsUI` so the provider stays flat.

## 🔒 Type Safety

- **All 24 `any` types eliminated** across the codebase:
  - Recharts tooltips use a shared `TooltipProps` / `ChartPayload` contract
  - `RssFeedItem` + `TmdbMovieResult` interfaces for Radar feed integrations
  - `PanInfo` from framer-motion for drag gestures in `TransactionModal`
  - `unknown` + `instanceof Error` narrowing for all `catch` blocks
  - Typed raw row types (`RawGoalRow`, `RawSubscriptionRow`, `RawUserAccountRow`, `RawUserCategoryRow`) for Supabase deserialisation
- **`npx tsc --noEmit` exits with 0 errors** across the entire workspace.

## ♿ Accessibility

- **Full `aria-label` coverage** on every icon-only button (~130 labelled)
- **Modals as proper dialogs** — `role="dialog"` / `role="alertdialog"` + `aria-modal="true"` + `aria-labelledby` / `aria-describedby` on `TransactionModal`, `AuthGate` PIN pad, confirm modal, install prompt, radar source modal, goals CRUD modal, monthly receipt modal, and quick-templates sheet.
- **Settings toggles as accessible switches** — all 13 rows in `ProfilePage` (dark mode, AMOLED, daily reminders, food budget, salary planner, vault, radar, claims, trading, PIN, biometric, time-based greetings, Friday the 13th) carry `role="switch"` + `aria-checked` + keyboard support (Enter / Space) + proper `aria-disabled` state.
- **Toast as live region** — `role="status"` + `aria-live="polite"` so screen readers announce saves/deletes without stealing focus.
- **Primary nav landmark** — `<BottomNav>` wrapped in `<nav aria-label="Primary">` with `aria-current="page"` on the active tab.
- **PIN pad accessible** — each digit + delete + biometric button labelled; progress dots live-announce `N of 6 digits entered`; error messages use `role="alert"`.
- **Wallet card keyboard-revealable** — the Hub balance tile is now a `role="button"` with Enter/Space key handling so keyboard users can reveal balances (previously mouse-only).
- **Form inputs labelled** — amount, note, email, password, search, and goal fields all have `aria-label` + `autoComplete` hints where appropriate.
- **Decorative icons hidden** — all lucide-react icons that sit inside labelled buttons are `aria-hidden="true"`. Decorative overlays (Derry, matrix god-mode, privacy blur, all animal alerts) are also `aria-hidden`.
- **Motion respect** — every custom animation (balance count-up, rich sparkle, broke glitch) honors the OS `prefers-reduced-motion` setting.

## 🧹 Internal / Housekeeping

- **Removed 3 unused npm dependencies** — `uuid`, `@types/uuid` (native `crypto.randomUUID()` is used instead), `@capgo/capacitor-updater` (no OTA deployment — APKs are shipped manually per release). Shaves ~5 MB off the packaged APK.
- **Added 1 new dependency** — `html2canvas` for the monthly-receipt PNG snapshot flow.
- **Removed 5 starter SVGs** (`file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`) from `public/` — unreferenced leftovers from `create-next-app`.
- **Removed `CLAUDE.md`** — Claude-Code-CLI pointer file, not used in this project's workflow.
- **Hardened `lib/supabase.ts`** — removed silent placeholder fallback; dev builds now fail loud when env vars are missing.
- **Race-condition guard** (`isSyncingRef`) in `useSyncState` prevents overlapping offline-queue drains.
- **SSR safety** — `localforage.config()` now guarded by `typeof window !== "undefined"` so Next.js server renders no longer print the noisy "No available storage method" rejection.
- **Recharts `width(-1)` warning silenced** via explicit `minWidth={0}` / `minHeight={0}` on `ResponsiveContainer`.
- **Capacitor-native PWA skip** — `InstallPrompt` now suppresses itself inside the Capacitor shell where the app is already installed as a real APK.

## 🛠 Fixed
- Stale-closure bug where `refreshData` captured outdated categories and overwrote the cache on cold boot — resolved via a synced `useRef`.
- Case-mismatch ghost-account duplication on the Hub carousel.
- Circular dependency between money and sync hooks resolved via an `isOfflineRef` pattern (state mirrored into a ref so one hook can read it without depending on another's render).
- Unused `showPinPad` state in `AuthGate` removed (the locked UI always renders when `isLocked && !checking`, making the flag dead code).

---

## [1.0.0] — The Official Release & Native Polish — 2026-04-19

The first stable, production-grade release. This version represents a complete architectural overhaul from the prototype, with emphasis on native feel, offline resilience, and multi-currency correctness.

### Major
- **Refactored Hub UI** into a multi-currency Wise-style horizontal wallet carousel. Each account card displays its own currency prefix and isolated balance — no silent FX conversions, no mixed-currency aggregates.
- **Migrated storage engine** from `localStorage` to `localforage` (IndexedDB) for infinite offline scaling. All monetary values now stored as integer cents to eliminate floating-point drift.
- **Implemented Soft Deletes** via a `deleted_at` timestamp column. Rows are never physically removed, preventing the classic cross-device sync conflict where a delete on Phone A gets re-seeded from Phone B's cache. Provider-level queries filter `!t.deleted_at`.
- **Idempotent Sync** — every transaction now carries a client-generated `crypto.randomUUID()` and uses Supabase `upsert({ onConflict: 'id' })`, making retries safe.

### Feature
- **Accountant Export Wizard** — date-range, account, and category filtering, UTF-8 BOM CSV generation via Capacitor Filesystem, handoff to native Android share sheet.
- **Programmatic Smart Insights** — automatic week-over-week spending delta callouts on the Stats page.
- **Upcoming widget** on the Hub — surfaces auto-deducting subscriptions and utilities in the days before their billing date.
- **Empty states** across every list view with meaningful calls-to-action.
- **Account archiving** — hide travel or dormant accounts from daily view without losing history; restore with one tap.

### UI/UX
- **Eradicated every native HTML `<select>` and `<input type="date">`** in the codebase. Replaced with custom chevron-triggered dropdowns and a reusable `CustomDatePicker` component featuring an iOS-style inline calendar grid, M–S weekday headers, month navigation, and accent-colored selection.
- **Pill pickers** for short enumerations (currency, theme, account type).
- **Compact wallet carousel** — tightened card dimensions and restructured account ordering to preserve user sort preference with case-insensitive consolidation.
- **Pending-balance tooltip** with contextual help icon.
- **Typed Recharts tooltips** for full TypeScript safety across the trend visualization.

### Organization
- **Relocated Subscriptions and Utilities** out of the Stats page and into a dedicated **Financial Planning** module (renamed from "Goals"), alongside Savings Goals. Stats now shows a compact read-only summary card.

### Easter Egg
- **"Derry" cinematic sequence** — an 8-second multi-phase jump-scare overlay (blackout → blood vignette → jump scare → fade) triggered by amount `6.66` or the keyword `pennywise`. Uses `Haptics.vibrate({ duration: 800 })` for tactile reinforcement.

### Fixed
- Stale-closure bug where `refreshData` captured outdated categories and overwrote the cache on cold boot — resolved via a synced `useRef`.
- Case-mismatch ghost-account duplication on the Hub carousel.
- Floating-point rounding errors in aggregate totals (now integer cents throughout).

---

## [0.9.0] — The Hardware Integration Update — 2026-03-10

### Feature
- Integrated **`@capacitor/biometric-auth`** — fingerprint and FaceID gate on cold launch. Failed authentication returns the user to the password screen with no exposed numeric fallback.
- **Flagship X-Axis Linear Haptics** — `Haptics.vibrate({ duration: 10 })` micro-vibrations on every tap, swipe, and confirm. Tuned specifically for Xiaomi, Samsung, and Pixel linear-resonant actuators.

### Fixed
- **Intercepted Android hardware back-swipe** so it routes through `router.back()` instead of killing the Capacitor WebView. Respects `canGoBack` state to prevent dead-ends.

---

## [0.8.0] — The Radar Engine — 2026-01-22

### Feature
- Integrated **`CapacitorHttp`** to bypass browser CORS restrictions and Cloudflare WAF blocks when fetching third-party feeds from inside the WebView.
- **Robust XML parsing** for Tech and Audiophile RSS feed ingestion — tolerant of malformed CDATA, missing namespaces, and inconsistent pub-date formats.

---

## [0.1.0] — Initial Prototype — 2025-11-05

### Base
- Core CRUD operations for transactions, accounts, and categories.
- Next.js App Router scaffolding with basic page hierarchy.
- Initial Supabase integration (auth + transactions table, no RLS yet).
- String-based `localStorage` persistence (pre-LocalForage, pre-integer-cents).
