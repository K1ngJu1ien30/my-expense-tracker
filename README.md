# Tracker — Expense & Lifestyle Super App v2.0

> A mobile-first, offline-capable financial and lifestyle aggregator purpose-built for native Android deployment via Capacitor. Combines real-time double-entry expense tracking, predictive spend analytics, reimbursement claim automation, asset amortization management, and a dynamic content radar into a single unified experience — engineered for one-handed use during a daily commute, with full offline resilience.

**Live:** [my-expense-tracker-pearl.vercel.app](https://my-expense-tracker-pearl.vercel.app/)

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Core Architecture & Modules](#core-architecture--modules)
3. [System Architecture](#system-architecture)
4. [Local Setup & Environment](#local-setup--environment)
5. [Database Schema](#database-schema)
6. [Project Structure](#project-structure)

---

## Tech Stack

| Technology | Role |
|---|---|
| **Next.js** (App Router, `output: "export"`, `trailingSlash: true`) | Static site generation for Capacitor WebView compatibility |
| **Capacitor** | Native Android wrapper — biometric auth, hardware back button, network detection |
| **TypeScript** | Full type safety across 600+ line context provider and all modules |
| **Tailwind CSS** | Utility-first styling with CSS custom properties for dynamic accent theming |
| **Supabase** | PostgreSQL database, email/password auth, Row Level Security, user metadata storage |
| **Recharts** | Data visualization — `LineChart`, `PieChart`, `BarChart` with custom glassmorphism tooltips |
| **Framer Motion** | Spring-physics animations, `AnimatePresence` transitions, drag-to-dismiss modals |
| **@capacitor/app** | Hardware back button interception + app exit control |
| **@capacitor/network** | Native network status detection powering the offline queue engine |

---

## Core Architecture & Modules

### 1. Double-Entry Claims Engine

The claims system transforms simple expense tracking into a full reimbursement workflow with automated accounting.

**Schema Extension:**
```sql
ALTER TABLE transactions
  ADD COLUMN is_claimable BOOLEAN DEFAULT false,
  ADD COLUMN claim_status TEXT DEFAULT 'none'
    CHECK (claim_status IN ('none', 'pending', 'cleared'));
```

**Transaction Modal Integration** (`components/TransactionModal.tsx`)
- When `txType === "Expense"`, a toggle appears: "Claimable / Split Bill"
- When enabled: `is_claimable: true`, `claim_status: 'pending'`
- When disabled: `is_claimable: false`, `claim_status: 'none'`
- Pre-fills correctly on edit mode from existing transaction data

**Claims Hub** (`app/hub/claims/page.tsx`)
- Summary pills: **Total Pending** (sum of all `claim_status === 'pending'` amounts) + **Pending Count**
- Tabbed view: Pending | Cleared — filters `transactions.filter(tx => tx.is_claimable === true)` by `claim_status`
- Enabled via Profile → Modules → Claims & Splits (persisted to `user_metadata.claims_enabled`)

**The "Mark Cleared" Double-Entry Logic:**
When a user taps "Mark as Cleared" on a pending claim, the system executes a two-step accounting sequence:

1. **UPDATE** the original expense: `claim_status = 'cleared'`
2. **INSERT** a new income transaction:
   ```
   type: "Income"
   amount: [original expense amount]
   account: [original expense account]
   category: "Reimbursement"
   note: "Claim Cleared: [original category]"
   date: [today]
   ```

This automatically restores the user's total balance by the claimed amount. The income entry appears in all analytics and the dashboard immediately via optimistic state updates.

---

### 2. Offline-First Sync (LRT Mode)

Designed for commuters who lose signal in tunnels and underground stations. The app never crashes on network failure and queues transactions for automatic sync on reconnect.

**Network Detection — Dual Layer:**
- **Browser**: `navigator.onLine` + `window.addEventListener('online'/'offline')` for web/PWA
- **Capacitor Native**: Dynamic `import('@capacitor/network')` with `Network.addListener('networkStatusChange')` for Android
- `isOffline: boolean` exposed via global context — any component can read network state
- Initial status checked via `Network.getStatus()` on mount

**Offline Transaction Queue** (`addTransaction` in `lib/context.tsx`):
```
if (isOffline) {
  1. Generate temporary ID: `offline-${Date.now()}`
  2. Append to React state immediately (UI updates instantly)
  3. Push to localStorage["offline_tx_queue"] JSON array
  4. Toast: "No connection. Expense saved offline."
  return; // Skip Supabase entirely
}
```

**Auto-Sync Engine** (`syncOfflineQueue`):
- Triggered when `networkStatusChange` fires `connected: true` OR browser `online` event
- Reads `localStorage["offline_tx_queue"]`, iterates through queued transactions
- Inserts each into Supabase with the user's real `user_id`
- Clears the localStorage queue on success
- Toast: "{N} offline expense(s) synced to cloud!"

**Graceful Degradation:**
- Initial 5-table `Promise.all` fetch wrapped in `try/catch` — on failure, app renders with empty state instead of white screen
- All Capacitor imports use dynamic `import()` + `// @ts-ignore` + `.catch()` — Vercel web builds never crash on missing native modules

---

### 3. State-Driven Overlays

**The Problem:** Next.js `output: "export"` generates static HTML files. Capacitor's Android WebView resolves routes like `/vault/detail?id=abc` by looking for a physical file at that path — which doesn't exist. This crashes the WebView with `ERR_FILE_NOT_FOUND`.

**Failed Approaches:**
- `useSearchParams()` + query strings → WebView crash
- Global context `activeAssetId` + `router.push('/vault/detail')` → still requires a separate route file
- `trailingSlash: true` → generates `/vault/detail/index.html` (helps but doesn't solve query params)

**The Solution: Full-Screen React State Overlays**

The Asset Vault detail view (`components/AssetDetailOverlay.tsx`) renders as a `fixed inset-0 z-[200] bg-background` overlay, triggered purely by local state in the parent page:

```tsx
// app/vault/page.tsx
const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

// Card click:
onClick={() => setSelectedAssetId(asset.id)}

// Render:
<AnimatePresence>
  {selectedAssetId && (
    <AssetDetailOverlay assetId={selectedAssetId} onClose={() => setSelectedAssetId(null)} />
  )}
</AnimatePresence>
```

**Benefits:**
- Zero Next.js routing involved — completely bypasses static file resolution
- Framer Motion spring slide-in animation (`initial={{ x: "100%" }}`)
- Back button clears state and unmounts the overlay
- All CRUD (edit asset, add/edit/delete maintenance logs) happens within the overlay with optimistic state updates
- Modals inside the overlay use `z-[250]` to layer above the `z-[200]` overlay itself

---

### 4. Financial Hub & Predictive Analytics

**Predictive Velocity** (`app/analytics/page.tsx`)
- Computes cumulative daily spend for the current calendar month
- **Daily Velocity** = `totalMonthSpend / currentDayOfMonth`
- **Projected End-of-Month** = `dailyVelocity × daysInMonth`
- Dual-line Recharts `LineChart`: solid accent line (actual cumulative) + dashed line (projected trajectory)
- Updates in real-time as new expenses are added

**Commute Mode — Morning Briefing** (`app/hub/page.tsx`)
- "Today's Velocity" card using strict local-timezone boundaries
- Radar Alert badge counting today's new articles/movies
- "Quick Log Expense" button triggers global `showTransactionModal` via context

**Strict Local-Timezone Filtering** (V55 fix applied globally)
- **Today**: `new Date(year, month, date).getTime()` → `startOfToday` / `startOfTomorrow`
- **Weekly (Mon–Sun)**: `distanceToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1`
- Applied in: Dashboard (today/weekly pills), History page (filter tabs), Food Budget card, Spending Trend chart
- Eliminates the UTC midnight bug where 12:00–8:00 AM MYT showed yesterday's data

**History Filtering** (`app/history/page.tsx`)
- Three filter pills: Today | This Week | Show All
- Dynamic subtitle: "Today — 3 transactions"
- Empty state adapts per filter with "Show All" escape hatch

**Global Currency Formatter** (`formatCurrency` in context)
- `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
- Uses user's stored currency symbol (RM, $, €) — consistent across all modules

---

### 5. The Asset Vault & Radar Engine

**Asset Vault** (`app/vault/page.tsx` + `components/AssetDetailOverlay.tsx`)
- Dashboard: 3-column summary — Total Value | Items | **Avg Cost / Day**
- Cost / Day = `purchase_price / Math.max(1, daysActive)` — recalculates per filter pill
- Detail overlay: **True Total** = `purchase_price + SUM(asset_logs.cost)`
- **Cost / Day** = `trueTotalInvestment / daysActive`
- Maintenance Timeline: vertical left-border line with accent-colored dots, full CRUD (add/edit/delete logs)

**Radar Engine** (`app/hub/radar/page.tsx`)
- User-configured sources stored in `radar_sources` table (3 types: RSS, TMDB Cinema, TMDB Streaming)
- Parallel fetch via `Promise.all` with per-source `.catch()` isolation
- RSS: `rss2json` API with optional keyword filtering; badge text = first keyword or feed title
- TMDB Cinema: `/movie/now_playing?region=MY`
- TMDB Streaming: `/discover/movie?watch_region=MY&with_watch_providers={id}` — dynamic provider from `source.url`
- Provider selector: Netflix (8), Disney+ (337), Amazon Prime (119), Apple TV+ (350), HBO Go (315), All
- Unified `RadarItem` interface with `category` (for filtering) + `badge` (for display)
- Deduplicated filter pills, broken image `onError` fallback, custom dropdown (no native `<select>`)

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    app/layout.tsx                        │
│  ┌───────────────────────────────────────────────────┐  │
│  │              <AppProvider>                         │  │
│  │   Context: auth, transactions, goals, assets,     │  │
│  │   claims, offline queue, modal triggers, network  │  │
│  │   ┌─────────────────────────────────────────┐     │  │
│  │   │          <AppLayout>                    │     │  │
│  │   │  ┌──────────┐  ┌────────────────────┐  │     │  │
│  │   │  │ AuthGate │  │   Page Components  │  │     │  │
│  │   │  │ (PIN/Bio)│  │  + State Overlays  │  │     │  │
│  │   │  └──────────┘  └────────────────────┘  │     │  │
│  │   │  ┌──────────────────────────────────┐  │     │  │
│  │   │  │ BottomNav + TransactionModal     │  │     │  │
│  │   │  └──────────────────────────────────┘  │     │  │
│  │   └─────────────────────────────────────────┘     │  │
│  └───────────────────────────────────────────────────┘  │
│                          │                              │
│              ┌───────────▼───────────┐                  │
│              │   lib/context.tsx      │                  │
│              │   Single Source of     │──── localStorage │
│              │   Truth + Offline Q    │   (offline_tx_q) │
│              │   + Claims Engine      │                  │
│              └───────────┬───────────┘                  │
│                          │                              │
│              ┌───────────▼───────────┐                  │
│              │   Supabase Client     │                  │
│              └───────────┬───────────┘                  │
└──────────────────────────┼──────────────────────────────┘
                           │
                ┌──────────▼──────────┐
                │   Supabase Cloud    │
                │  PostgreSQL + Auth  │
                │  + Row Level Sec.   │
                └─────────────────────┘
```

**Key Patterns:**
- **Context-Driven Architecture**: `lib/context.tsx` (650+ lines) manages auth, 7 data domains, offline queue, UI triggers, network listeners, and Capacitor integrations
- **Optimistic UI**: All CRUD updates local React state first, then syncs to Supabase
- **Double-Entry Accounting**: Claims generate mirrored income transactions; transfers debit source and credit destination
- **Static Export + Overlay Navigation**: `output: "export"` + `trailingSlash: true` for Capacitor; complex views use state overlays instead of routes
- **Dynamic Native Imports**: All Capacitor plugins loaded via `import().catch()` for web compatibility

---

## Local Setup & Environment

### Prerequisites
- Node.js 18+
- npm 9+
- A Supabase project (free tier)
- TMDB API key (free at [themoviedb.org](https://www.themoviedb.org/settings/api))

### 1. Clone & Install

```bash
git clone <repo-url>
cd my-expense-tracker
npm install
```

### 2. Configure Environment

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_TMDB_API_KEY=your-tmdb-api-key
```

### 3. Setup Database

Run `supabase/schema.sql` in your Supabase SQL Editor. This creates all 7 tables with UUID primary keys, foreign key cascades, CHECK constraints, and RLS policies.

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Build for Production / Capacitor

```bash
npm run build          # Static export to /out
npx cap sync           # Sync web assets to Android project
npx cap open android   # Open in Android Studio
```

---

## Database Schema

All tables use `uuid_generate_v4()` primary keys, `user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE`, and strict RLS: `FOR ALL USING (auth.uid() = user_id)`.

| Table | Purpose | Key Columns |
|---|---|---|
| **`transactions`** | Core financial ledger | `amount`, `type` (Income/Expense/Transfer), `category`, `account`, `to_account`, `date`, `status` (cleared/pending), **`is_claimable`** (boolean), **`claim_status`** (none/pending/cleared) |
| **`goals`** | Savings goal tracking | `title`, `current_amount`, `target_amount`, `is_pinned` |
| **`subscriptions`** | Recurring payments | `name`, `amount`, `billing_day`, `source_account`, `auto_deduct`, `type` (subscription/utility) |
| **`salary_planner`** | Budget allocation items | `category`, `item_name`, `amount` |
| **`asset_vault`** | Physical asset registry | `name`, `category`, `emoji_icon`, `purchase_date`, `purchase_price` |
| **`asset_logs`** | Maintenance timeline | `asset_id` (FK → asset_vault), `log_date`, `description`, `cost` |
| **`radar_sources`** | Feed source config | `source_type` (rss/tmdb_cinema/tmdb_streaming), `name`, `url`, `keywords` |

**User Metadata** (stored in `auth.users.raw_user_meta_data` via `supabase.auth.updateUser`):

| Key | Type | Purpose |
|---|---|---|
| `display_name` | string | User's display name |
| `custom_accounts` | string[] | Account list with preserved order |
| `include_savings` | boolean | Include savings in total balance |
| `enable_food_budget` | boolean | Food Budget module toggle |
| `enable_salary_planner` | boolean | Salary Planner toggle |
| `food_daily_limit` / `food_monthly_limit` | number | Budget caps |
| `pin_enabled` / `biometric_enabled` | boolean | Security locks |
| `vault_enabled` | boolean | Asset Vault toggle |
| `radar_enabled` | boolean | Radar Tracker toggle |
| `claims_enabled` | boolean | Claims & Splits toggle |

---

## Project Structure

```
my-expense-tracker/
├── app/
│   ├── layout.tsx              # Root — AppProvider + AppLayout
│   ├── page.tsx                # Dashboard — balance, today/weekly, trend
│   ├── analytics/page.tsx      # Stats — pie, bar, velocity projection
│   ├── history/page.tsx        # Filtered transaction history (Today/Week/All)
│   ├── goals/page.tsx          # Goals + Food Budget + Salary Planner
│   ├── hub/page.tsx            # Hub — Morning Briefing + module launcher
│   ├── hub/claims/page.tsx     # Claims & Splits — pending/cleared tabs
│   ├── hub/radar/page.tsx      # Radar feed — RSS + TMDB aggregator
│   ├── hub/radar/settings/     # Radar source CRUD
│   ├── vault/page.tsx          # Asset Vault + overlay injection
│   └── profile/page.tsx        # Settings, modules, data, security
├── components/
│   ├── AppLayout.tsx           # Shell — toast, nav, transaction modal
│   ├── AssetDetailOverlay.tsx  # Full-screen asset detail + maintenance
│   ├── AuthGate.tsx            # Biometric/PIN lock screen
│   ├── AuthScreen.tsx          # Login / Signup
│   ├── BottomNav.tsx           # 5-tab navigation with FAB
│   ├── FoodBudgetCard.tsx      # Daily/monthly food tracker
│   ├── SalaryPlanner.tsx       # Salary cashflow planner
│   └── TransactionModal.tsx    # Add/Edit transaction + claimable toggle
├── lib/
│   ├── context.tsx             # Global state — auth, data, offline, claims
│   ├── supabase.ts             # Supabase client init
│   └── utils.ts                # Utility functions
├── supabase/
│   └── schema.sql              # Full schema + RLS + claims columns
├── capacitor.config.ts         # Native config
├── next.config.ts              # Static export + trailing slash
├── USER_MANUAL.md              # End-user guide
└── package.json
```

---

## License

Private project. All rights reserved.
