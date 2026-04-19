# Expense Tracker Pro

### Native Multi-Currency Financial Engine

A production-grade, offline-first personal finance application built with Next.js and compiled to a native Android binary via Capacitor. Designed from the ground up to feel indistinguishable from a first-party iOS app, with zero native HTML controls, integer-cents precision math, and a resilient sync architecture backed by Supabase and IndexedDB.

---

## Tech Stack

- **Next.js 14** — App Router, React Server Components, TypeScript
- **Tailwind CSS v4** — Utility-first styling with custom design tokens
- **Supabase** — PostgreSQL backend, Row Level Security, real-time auth
- **LocalForage** — IndexedDB-backed offline cache with localStorage fallback
- **Capacitor 6** — Native Android shell (App, Haptics, Filesystem, Share, Biometric Auth)
- **Framer Motion** — Physics-based animations and page transitions
- **Recharts** — Typed, responsive financial visualizations

---

## Core Architecture

### Offline-First by Design

The application treats the network as an enhancement, not a dependency. Every interaction is designed to succeed instantly on a cold boot inside the Kuala Lumpur MRT tunnel.

1. **Cold Boot Hydration** — On app launch, the provider reads cached state from IndexedDB (via LocalForage) *synchronously-ish* and paints the UI before any network request fires. The user sees their dashboard in under 200ms.
2. **Background Reconciliation** — Once hydrated, a silent Supabase fetch runs. Fresh rows are merged and re-persisted to IndexedDB.
3. **Integer Cents Math** — All monetary values are stored and computed as integer cents (`Math.round(value * 100)`) to eliminate floating-point drift. Display-layer formatting divides by 100 at the very last moment.
4. **Idempotent Upserts** — Every transaction is assigned a client-generated `crypto.randomUUID()` before insertion. Sync operations use `upsert({ onConflict: 'id' })` so retries never duplicate.
5. **Soft Deletes** — Rows are never `DELETE`d. Instead, a `deleted_at` timestamp is set. This prevents the classic "deleted on Phone A, re-synced from Phone B" conflict and provides a trivial restore path. All provider-level queries filter `!t.deleted_at`.

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

---

## Key Features

### Multi-Currency Wallet System
Each account carries an explicit `currencyCode` (`RM`, `SGD`, `USD`, `JPY`). The Hub renders a Wise-style horizontal wallet carousel where every card displays its own prefix and balance — no silent FX conversions, no mixing currencies into a single aggregate.

### Native Biometric Security
A fingerprint or FaceID gate guards cold-launch access via `@capacitor/biometric-auth`. Failed auth returns the user to the lock screen; there is no numeric fallback surface exposed by default.

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

---

## Build Instructions

### Prerequisites
- Node.js 20+
- Android Studio (Ladybug or newer) with SDK 34
- JDK 17
- A Supabase project with the schema from `supabase/schema.sql` applied

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

# 4. Dev server (web preview)
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
app/            Next.js App Router pages (Hub, Stats, Planning, Vault, Profile)
components/    Reusable UI (TransactionModal, CustomDatePicker, AppLayout, ...)
lib/           Context provider, haptics, Supabase client, types
supabase/      schema.sql with soft-delete columns
android/       Capacitor native project
```

---

## License

Private — all rights reserved.
