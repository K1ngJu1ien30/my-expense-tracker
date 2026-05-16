# Expense Tracker Pro

### Native Multi-Currency Financial Engine — v1.6.0

A production-grade, offline-first personal finance application built with Next.js and compiled to a native Android binary via Capacitor. Designed from the ground up to feel indistinguishable from a first-party iOS app, with zero native HTML controls, integer-cents precision math, and a resilient sync architecture backed by Supabase and IndexedDB.

> **Quality baseline (v1.6.0):** `tsc --noEmit` → 0 errors. `eslint .` → 0 errors / 0 warnings. `next build` → 35/35 static pages. Every exception is carefully justified inline.

---

## Tech Stack

- **Next.js 16** — App Router, React 19, TypeScript (strict), static export
- **Tailwind CSS v4** — Utility-first styling with custom design tokens
- **Supabase** — PostgreSQL backend, Row Level Security, real-time auth
- **Leaflet / react-leaflet** — Interactive map for WanderPlan travel planner
- **date-fns** — Lightweight date manipulation for itinerary & countdowns
- **LocalForage** — IndexedDB-backed offline cache with localStorage fallback
- **Capacitor 8** — Native Android shell (App, Haptics, Filesystem, Share, Biometric Auth, Motion, Network, Preferences)
- **Framer Motion 12** — Physics-based animations and page transitions
- **Recharts 3** — Typed, responsive financial visualizations
- **react-virtuoso** — Window-virtualisation for the History list (smooth at 50k+ transactions)

---

## Core Architecture

### Offline-First by Design

The application treats the network as an enhancement, not a dependency. Every interaction is designed to succeed instantly on a cold boot inside the Kuala Lumpur MRT tunnel.

1. **Cold Boot Hydration** — On app launch, the provider reads cached state from IndexedDB (via LocalForage) *synchronously-ish* and paints the UI before any network request fires. The user sees their dashboard in under 200ms.
2. **Background Reconciliation** — Once hydrated, a silent Supabase fetch runs. Fresh rows are merged and re-persisted to IndexedDB.
3. **Integer Cents Math** — All monetary values are stored and computed as integer cents (`Math.round(value * 100)`) to eliminate floating-point drift. Display-layer formatting divides by 100 at the very last moment.
4. **Idempotent Upserts** — Every transaction is assigned a client-generated `crypto.randomUUID()` before insertion. Sync operations use `upsert({ onConflict: 'id' })` so retries never duplicate.
5. **Soft Deletes** — Rows are never `DELETE`d. Instead, a `deleted_at` timestamp is set. This prevents the classic "deleted on Phone A, re-synced from Phone B" conflict and provides a trivial restore path. All provider-level queries filter `!t.deleted_at`.

### Context Facade + Domain Hooks

The app-wide React Context is a thin **façade** over eight focused domain hooks. This keeps each concern isolated and testable while preserving the single `useAppContext()` consumer surface.

```
lib/context.tsx (facade, ~580 lines)
  ├── hooks/useUIState.ts            toast, confirm modal, modal flags
  ├── hooks/useEasterEggsUI.ts       whale/derry/god-mode overlays
  ├── hooks/useUserPreferences.ts    20 user settings + feature flags
  ├── hooks/useAccountsState.ts      accounts & categories (dual-write)
  ├── hooks/useSyncState.ts          Supabase refresh + offline queue
  ├── hooks/useMoneyState.ts         transactions, subscriptions, utilities
  ├── hooks/usePlanningState.ts      goals + planner items
  └── hooks/useModulesData.ts        assets + trade items
```

Shared TypeScript types live in `lib/types.ts` and are re-exported from `lib/context.tsx` for backwards compatibility.

### Data Flow

```
┌──────────────┐   hydrate   ┌─────────────────┐
│  IndexedDB   │ ──────────► │  React Context  │ ──► UI
│ (LocalForage)│             │  (useMemo tree) │
└──────▲───────┘             └────────┬────────┘
       │                              │
       │ persist                      │ mutate
       │                              ▼
       │                     ┌─────────────────┐
       └─────────────────────┤  Supabase (PG)  │
              reconcile      └─────────────────┘
```

### Accessibility

- All interactive elements carry `aria-label` where visual text is absent
- Modals use `role="dialog"` + `aria-modal` + `aria-labelledby`
- Settings toggles implement `role="switch"` + `aria-checked` with full keyboard (Enter/Space) support
- Toast announcements use `role="status"` + `aria-live="polite"` so screen readers read them without stealing focus
- Primary nav is wrapped in `<nav aria-label="Primary">` with `aria-current="page"` on the active tab
- Decorative icons (lucide-react) are marked `aria-hidden="true"`

### Performance Budget

The app is engineered to stay smooth at **50,000+ transactions**, not just demo-scale.

| Path | Technique |
|---|---|
| Hub dashboard | Single-pass `useMemo` with O(1) lowercase-account `Map` — ~2 ms at 10k tx |
| History list | `react-virtuoso` window-virtualisation — only ~15 rows in the DOM regardless of list size |
| Provider re-renders | Memoised user-scoped filters (`transactions` / `goals` / `subscriptions` / `utilities`) keep array references stable when only UI state changes |
| Currency formatting | `formatCurrency` wrapped in `useCallback` — stable reference across non-currency renders keeps downstream `useMemo` chains from re-running |
| Supabase reads | 11 partial indexes incl. `(user_id, date DESC) WHERE deleted_at IS NULL` |
| Database View | Capped at 500 rows; full dataset goes through Export instead |
| Animations | Every custom keyframe respects `prefers-reduced-motion` |

---

## Key Features

### Multi-Currency Wallet System
Each account carries an explicit `currencyCode` (`RM`, `SGD`, `USD`, `JPY`). The Hub renders a Wise-style horizontal wallet carousel where every card displays its own prefix and balance — no silent FX conversions, no mixing currencies into a single aggregate.

### Native Biometric Security
A fingerprint or FaceID gate guards cold-launch access via `@aparajita/capacitor-biometric-auth`. Failed auth returns the user to the 6-digit PIN pad; there is no silent numeric fallback.

### Accountant Export (CSV)
A purpose-built wizard filters transactions by date range, account, and category, then writes a UTF-8 BOM CSV to the device via Capacitor Filesystem and hands it off to the native Android share sheet (WhatsApp, Gmail, Drive).

### Custom Native UI
Every single `<select>` and `<input type="date">` has been eradicated from the codebase. In their place:
- **Custom Dropdowns** — Chevron-triggered, animated, backdrop-dismissible pill menus
- **`CustomDatePicker`** — A reusable iOS-style inline calendar grid with month navigation, M-S weekday headers, and accent-colored selection
- **Pill Pickers** — 4-button segmented controls for short enumerations (currency, theme, account type)

### Additional Systems
- **Financial Planning module** — Unified home for Savings Goals, Subscriptions, and Utilities
- **Smart Insights** — Programmatic week-over-week spending deltas
- **Zen Mode** — Tap-to-reveal balance privacy
- **AMOLED Pitch Black** — True-black theme that auto-disables when Dark Mode is off
- **App-switcher privacy blur** — Automatic via Capacitor `appStateChange` listener

### Power-User Features (v1.1.0)

#### 🔍 Power Search
The History page supports a forgiving query language that AND-combines with the existing Today/Week/Category pill shortcuts:

| Syntax | Meaning |
|---|---|
| `coffee` | Free-text match against note / category / account / amount |
| `"coffee latte"` | Quoted phrase — matched as a single token |
| `#food` | Category filter |
| `@bank` | Account filter (prefix match) |
| `>50` / `<100` | Amount greater-than / less-than |
| `100-500` | Amount range (inclusive) |
| `today` / `yesterday` | Single-day filter |
| `this week` / `last week` / `this month` / `last month` / `this year` | Calendar-relative window |
| `april 2026` / `2025` | Specific month or year |

Unknown tokens fall through to free-text matching, so the search bar never returns empty due to syntax errors. Live "filter chips" render what the parser understood.

#### 👆 Swipe-to-Edit/Delete
Native iOS-style left-swipe on any transaction row reveals color-coded Edit + Delete actions. Snap physics with velocity awareness; only one row may be open at a time. Fallback buttons stay available for mouse/keyboard users.

#### ⚡ Long-Press FAB Templates
Hold the `+` button for ~450 ms to open a mini-sheet of up to 4 one-tap expense templates, auto-derived from your last 30 days of activity. Templates cluster similar-priced purchases by category + account, suggest the median amount, and only surface once a pattern has occurred at least twice.

#### 🧠 Category Auto-Suggest
A client-side token-weighted predictor (stored in IndexedDB via LocalForage) learns from every saved expense. As you type a note, a dismissible sparkle pill above the category picker suggests the best-matching category. Three-gate confidence filter (min score, margin over runner-up, 5-transaction cold-start threshold) prevents noise.

#### 💰 Split-Bill Widget
Amber Dashboard card surfaces unclaimed reimbursable expenses at a glance — total amount, transaction count, distinct payee count. Only renders when the Claims module is enabled and something is actually pending.

#### 🧾 Monthly Recap Receipt
Receiptify-style thermal-receipt render of any month's activity, complete with category breakdown, highlights (biggest splurge, quiet-day streak, vs-last-month delta), transaction count, and a decorative barcode. One-tap share as PNG via Capacitor Share (Instagram stories, WhatsApp, Gmail). Auto-prompt on Home days 1–7 of each month (dismissible per-month); manual triggers on the Analytics page.

### Flavour & Easter Eggs

- 🐋 **Whale** — expense ≥ RM 5,000 triggers a full-screen whale alert
- 🐧 **Penguin** — expense < RM 10 between 1 AM and 5 AM local time ("Late-Night Snack Detected")
- 🐉 **Dragon** — fires once when a Savings Goal crosses 100%
- 🔥 **Phoenix** — rises when shake-to-undo restores a soft-deleted transaction
- 🦈 **Shark** — swims across the screen on every successful undo
- 🎈 **Derry** — 8-second horror sequence triggered by amount `6.66`, the note "pennywise", or (opt-in) 13:13 on Friday the 13th
- 🦉 **Time-based greetings** — owl at 2–5 AM, "Still up?" at 23:00–02:00, early-bird sun at 05:00 (togglable in Profile)
- 🐛 **Broke Mode** — Net Total subtly glitches when balance dips below zero
- ✨ **Rich Mode** — Net Total gains a soft gold shimmer above RM 1,000,000
- 🎮 **Konami Code** — ↑↑↓↓←→←→BA toggles God Mode on desktop PWA (mobile: 7-tap the avatar)
- **God Mode** — tap avatar 7× in 3 seconds for fake-rich fantasy values across the UI

---

## Build Instructions

### Prerequisites
- Node.js 20+
- Android Studio (Ladybug or newer) with SDK 34
- JDK 17
- A Supabase project with the schema from `supabase/migrations/` applied (run them in numeric order)

### Setup

```powershell
# 1. Clone
git clone <your-repo-url>
cd my-expense-tracker

# 2. Install dependencies
npm install

# 3. Create .env.local with your Supabase keys
#    NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
#    NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...

# 4. Apply migrations in Supabase SQL editor (in order):
#    - supabase/migrations/001_add_indexes.sql
#    - supabase/migrations/002_accounts_categories_tables.sql

# 5. Dev server (web preview)
npm run dev
```

### Native Android Build

```powershell
# 1. Produce the static export
npm run build

# 2. Sync web assets into the native shell
npx cap sync android

# 3. Open in Android Studio (optional, for device run)
npx cap open android

# 4. Build a release APK from Android Studio:
#    Build → Generate Signed Bundle / APK → APK → release
#
#    Or from CLI:
cd android
./gradlew assembleRelease
# Output: android/app/build/outputs/apk/release/app-release.apk
```

### Deploying to a Device

```powershell
# With USB debugging enabled:
npx cap run android
```

---

## Project Structure

```
app/                   Next.js App Router pages
  ├─ page.tsx          Dashboard / Hub
  ├─ analytics/        Charts + velocity + smart insights
  ├─ goals/            Financial Planning (goals, subs, utilities)
  ├─ history/          Transaction log with filters
  ├─ hub/              Module grid (radar, claims, trading, vault)
  ├─ profile/          Settings, security, data export
  ├─ trading/          Buy-low / sell-high ledger
  ├─ vault/            Asset + maintenance log tracker
  └─ reset-password/   Supabase password recovery
components/            Reusable UI (TransactionModal, CustomDatePicker,
                       MonthlyReceipt, MonthlyReceiptModal, etc.)
  └─ profile/          Extracted Profile-page modals (ClearData, Export,
                       Categories, ManageAccounts, RawData, BillingCycle,
                       TimePicker, PinSetup) — each is a focused
                       presentational component owning its transient state.
lib/
  ├─ context.tsx       App-wide context facade
  ├─ types.ts          Shared TypeScript types
  ├─ supabase.ts       Supabase client singleton
  ├─ haptics.ts        Capacitor haptics wrapper
  ├─ exportUtils.ts    CSV generation + Filesystem handoff
  ├─ receiptData.ts    Monthly-recap data deriver
  ├─ receiptShare.ts   html-to-image + Capacitor Share for receipt PNG
  ├─ searchParser.ts   Power-search tokenizer + filter engine
  ├─ quickTemplates.ts Long-press FAB template deriver
  ├─ categoryPredictor.ts  Client-side category auto-suggest model
  ├─ utils.ts          `cn()` helper (tailwind-merge)
  └─ hooks/            Eight domain hooks (see Architecture)
supabase/migrations/   Ordered SQL migration files
android/               Capacitor native project (gitignored)
public/                Manifest + app icon
```

---

## License

Private — all rights reserved.
