# Tracker | Native Multi-Currency Financial Engine

### Offline-First Personal Finance Tracker — Compiled to Native Android via Capacitor

A statically compiled **Next.js 16** frontend wrapped into a native Android APK via **Capacitor 8**, backed by **Supabase** PostgreSQL, styled with **Tailwind CSS 4**, and updated over-the-air via **Capgo**. Engineered for zero-connectivity resilience, one-handed commute usage, native-grade biometric security, and flagship-tier haptic feedback.

---

## Tech Stack

- **Next.js 16** (App Router, `output: "export"`) — Static site generation compiled to native assets
- **React 19** — Component architecture with concurrent features
- **Tailwind CSS 4** — Utility-first styling with CSS custom properties for dynamic accent theming
- **Supabase** — PostgreSQL backend with email/password auth, Row Level Security, and user metadata storage
- **Capacitor 8** — Native Android shell with hardware API access (biometrics, haptics, filesystem, network, motion)
- **Framer Motion 12** — Spring-physics animations, gesture-driven modals, `AnimatePresence` transitions
- **Recharts 3** — `LineChart`, `PieChart`, `BarChart` with custom glassmorphism tooltips
- **Capgo** — Over-the-air update delivery, bypassing the Play Store for non-native changes

---

## Core Architecture: Offline-First

The app never assumes network connectivity. Every interaction is designed to work identically offline and online.

```
┌──────────────────────────────────────────────────────┐
│                  Android Device                       │
│  ┌────────────────────────────────────────────────┐  │
│  │          Capacitor Native Shell (APK)          │  │
│  │  ┌──────────────────────────────────────────┐  │  │
│  │  │     Next.js Static Assets (WebView)      │  │  │
│  │  │                                          │  │  │
│  │  │  ┌──────────────────────────────────┐    │  │  │
│  │  │  │       lib/context.tsx             │    │  │  │
│  │  │  │   Global State + Offline Engine   │    │  │  │
│  │  │  │                                   │    │  │  │
│  │  │  │  try: Supabase fetch → setState   │    │  │  │
│  │  │  │       + save localStorage cache   │    │  │  │
│  │  │  │                                   │    │  │  │
│  │  │  │  catch: read localStorage cache   │    │  │  │
│  │  │  │       + prepend offline queue     │    │  │  │
│  │  │  │       → setState (hydrate UI)     │    │  │  │
│  │  │  └──────────────────────────────────┘    │  │  │
│  │  │          localStorage (device)           │  │  │
│  │  │    ├── tracker_data_cache                │  │  │
│  │  │    └── offline_tx_queue                  │  │  │
│  │  └──────────────────────────────────────────┘  │  │
│  │  Native: Biometric · Haptics · Network · Back  │  │
│  └──────────────────────┬─────────────────────────┘  │
│                         │ HTTPS (when available)      │
└─────────────────────────┼────────────────────────────┘
                          ▼
               ┌─────────────────────┐
               │   Supabase Cloud    │
               │  PostgreSQL + Auth  │
               │  + Row Level Sec.   │
               └─────────────────────┘
```

**How it works:**

1. On cold boot, `refreshData()` fetches all 6 Supabase tables in `Promise.all`
2. Supabase `select()` doesn't throw on network failure — errors are explicitly detected and thrown
3. On success: React state is set + full payload cached to `localStorage['tracker_data_cache']`
4. On failure: `catch` block hydrates from cache, prepends any `offline_tx_queue` items to transactions
5. `isHydrating` loading gate blocks UI until hydration completes — no zero-balance flash

---

## Key Features

### Multi-Currency Wallet System
The Hub dashboard displays per-account balances in a compact horizontal carousel, respecting the user's custom sort order. Accounts named with currency codes (e.g., "SGD Savings") automatically display with the correct currency prefix. Archived accounts are hidden from daily UI but preserved in history.

### Native Biometric Security
`@aparajita/capacitor-biometric-auth` with `allowDeviceCredential: false` and `androidConfirmationRequired: true`. 6-digit PIN fallback stored in Capacitor Preferences (native secure storage). Biometric → instant unlock; fail/cancel → PIN pad.

### Accountant Export (CSV)
Generates formatted CSV reports via `@capacitor/filesystem` + `@capacitor/share`. Supports "Current Month" or "All Time" scope. Files are written to device storage and shared via the native share sheet (WhatsApp, Email, etc.).

### System-Level UI Optimizations
- Native system fonts (Roboto/San Francisco) — no Google Fonts dependency
- `-webkit-tap-highlight-color: transparent` — no blue tap flash
- Context menu blocked, drag events disabled, user-select disabled on non-input elements
- Hardware back button intercepted via `@capacitor/app` using Next.js `router.back()`
- App-switcher privacy blur overlay
- 10ms micro-vibration haptics optimized for X-axis linear motors (Xiaomi/Samsung)

### Modules
- **Expense Tracking** — Income/Expense/Transfer with multi-account, dual-layer history filters
- **Savings Goals** — Target-based with dashboard pinning
- **Food Budget** — Daily & monthly limits with real-time progress
- **Salary Planner** — Pre-allocate income, track available cashflow
- **Asset Vault** — Track physical assets with cost-per-day and maintenance logs
- **Trading / Flipping** — Buy-sell inventory with realized P&L
- **Radar** — RSS + TMDB cinema/streaming feed aggregator
- **Claims & Splits** — Reimbursement workflow with auto-generated income entries

---

## Build Instructions

### Prerequisites

- Node.js 18+ / npm 9+
- Supabase project (free tier)
- Android Studio (for APK builds)
- TMDB API key (optional, for Radar module)

### Setup

```bash
git clone <repo-url>
cd my-expense-tracker
npm install
```

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_TMDB_API_KEY=your-tmdb-api-key
```

Run `supabase/schema.sql` in your Supabase SQL Editor.

### Development

```bash
npm run dev
# Open http://localhost:3000
```

> Capacitor features (biometric, haptics, native network) only work in the compiled APK.

### Build Android APK

```bash
npm run build
npx cap sync
npx cap open android
# Android Studio → Build → Build Bundle(s) / APK(s) → Build APK(s)
```

### OTA Update (Code-Only Changes)

```bash
npm run build
npx @capgo/cli bundle upload --channel production
```

Devices download the bundle in the background and apply it on the next cold boot. `CapacitorUpdater.notifyAppReady()` confirms the update is stable.

> **CRITICAL**: Pushing to GitHub/Vercel does **nothing** for Android users. You must explicitly push an OTA bundle via Capgo.

---

## Database Schema

All tables use `uuid_generate_v4()` primary keys, `user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE`, and strict RLS: `FOR ALL USING (auth.uid() = user_id)`.

| Table | Purpose | Key Columns |
|---|---|---|
| `transactions` | Financial ledger | `amount`, `type`, `category`, `account`, `to_account`, `date`, `status`, `is_claimable`, `claim_status` |
| `goals` | Savings goals | `title`, `current_amount`, `target_amount`, `is_pinned` |
| `subscriptions` | Recurring payments | `name`, `amount`, `billing_day`, `source_account`, `auto_deduct`, `type` |
| `salary_planner` | Budget allocation | `category`, `item_name`, `amount` |
| `asset_vault` | Physical assets | `name`, `category`, `emoji_icon`, `purchase_date`, `purchase_price` |
| `asset_logs` | Maintenance logs | `asset_id` (FK), `log_date`, `description`, `cost` |
| `trade_items` | Trading inventory | `item_name`, `buy_price`, `sell_price`, `status`, `date_acquired`, `date_sold` |

**User Metadata** (stored in `auth.users.raw_user_meta_data`):

`display_name` · `custom_accounts` (Account objects with `name` + `isArchived`) · `include_savings` · `enable_food_budget` · `enable_salary_planner` · `food_daily_limit` · `food_monthly_limit` · `pin_enabled` · `biometric_enabled` · `vault_enabled` · `radar_enabled` · `claims_enabled` · `trading_enabled`

---

## Project Structure

```
my-expense-tracker/
├── app/
│   ├── layout.tsx              # Root — AppProvider + AppLayout
│   ├── page.tsx                # Dashboard — wallet carousel, trends, goals
│   ├── analytics/page.tsx      # Stats — pie, bar, velocity, income-by-account
│   ├── history/page.tsx        # Dual-layer filtered transaction history
│   ├── goals/page.tsx          # Goals + Food Budget + Salary Planner
│   ├── hub/page.tsx            # Hub — module launcher
│   ├── hub/claims/page.tsx     # Claims & Splits
│   ├── hub/radar/page.tsx      # Radar feed — RSS + TMDB
│   ├── trading/page.tsx        # Trading / Flipping tracker
│   ├── vault/page.tsx          # Asset Vault
│   └── profile/page.tsx        # Settings, modules, security, data
├── components/
│   ├── AppLayout.tsx           # Shell — toast, nav, modal, back button, privacy blur
│   ├── AuthGate.tsx            # Biometric + PIN lock screen
│   ├── AuthScreen.tsx          # Login / Signup
│   ├── BottomNav.tsx           # 5-tab navigation with FAB
│   ├── TransactionModal.tsx    # Add/Edit transaction + currency + claims
│   └── SalaryPlanner.tsx       # Salary cashflow planner
├── lib/
│   ├── context.tsx             # Global state, offline engine, cache, sync, CRUD, easter eggs
│   ├── haptics.ts              # NativeHaptics — lightTick, successMedium, heavyDoubleThud, creepyHeartbeat
│   ├── exportUtils.ts          # CSV generation via Capacitor Filesystem + Share
│   ├── supabase.ts             # Supabase client init
│   └── utils.ts                # Utility functions
├── supabase/
│   └── schema.sql              # Full schema + RLS
├── capacitor.config.ts         # Native Android configuration
├── next.config.ts              # Static export config
└── package.json
```

---

## License

Private project. All rights reserved.
