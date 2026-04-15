# Tracker — Personal Finance & Asset Management Super App (V4)

A comprehensive personal finance tracker, asset manager, and trading profit tracker — built as a **true native Android application**. Not a web app. Not a PWA. A statically compiled Next.js frontend wrapped into a native APK via Capacitor, backed by Supabase, and updated over-the-air via Capgo.

Engineered for zero-connectivity resilience, one-handed commute usage, and native-grade security.

---

## Table of Contents

1. [Architecture](#architecture)
2. [Tech Stack](#tech-stack)
3. [Core Modules](#core-modules)
4. [Offline-First & Security Engine](#offline-first--security-engine)
5. [Developer Deployment Workflow](#developer-deployment-workflow)
6. [Local Development Setup](#local-development-setup)
7. [Database Schema](#database-schema)
8. [Project Structure](#project-structure)
9. [User Manual](#user-manual)

---

## Architecture

The codebase is a **Next.js 16** (React 19) project configured with `output: "export"`, which compiles the entire application into static HTML/CSS/JS files. These static assets are bundled into a native Android APK using **Capacitor 8**, which runs them inside a native WebView with full access to device hardware — biometric sensors, network status listeners, and hardware back button.

The backend is **Supabase** — PostgreSQL with email/password authentication, Row Level Security, and user metadata storage. The app communicates over HTTPS but is engineered to function fully when that connection drops.

**Over-the-air updates** are delivered via **Capgo**. Code changes are pushed as bundles that devices download in the background and apply on the next cold boot — bypassing the Play Store entirely for non-native updates.

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
│  │  │                   │                      │  │  │
│  │  │          localStorage (device)           │  │  │
│  │  │    ├── tracker_data_cache                │  │  │
│  │  │    └── offline_tx_queue                  │  │  │
│  │  └──────────────────────────────────────────┘  │  │
│  │                      │                         │  │
│  │  Native: Biometric · Network · Back Button     │  │
│  └──────────────────────┬─────────────────────────┘  │
│                         │ HTTPS (when available)      │
└─────────────────────────┼────────────────────────────┘
                          │
               ┌──────────▼──────────┐
               │   Supabase Cloud    │
               │  PostgreSQL + Auth  │
               │  + Row Level Sec.   │
               └─────────────────────┘
                          │
               ┌──────────▼──────────┐
               │    Capgo Cloud      │
               │  OTA Bundle Dist.   │
               └─────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Version | Role |
|---|---|---|---|
| **Framework** | Next.js (App Router) | 16.2 | Static site generation (`output: "export"`, `trailingSlash: true`) |
| **UI** | React | 19.2 | Component architecture |
| **Styling** | Tailwind CSS | 4.x | Utility-first CSS with CSS custom properties for dynamic accent theming |
| **Animation** | Framer Motion | 12.x | Spring-physics animations, `AnimatePresence` transitions, drag-to-dismiss modals |
| **Charts** | Recharts | 3.x | `LineChart`, `PieChart`, `BarChart` with custom glassmorphism tooltips |
| **Icons** | Lucide React | 1.x | Consistent icon library |
| **Backend** | Supabase | 2.x | PostgreSQL, email/password auth, RLS, user metadata |
| **Native Shell** | Capacitor | 8.x | Android APK, WebView bridge, hardware API access |
| **Biometric** | @aparajita/capacitor-biometric-auth | 10.x | Native fingerprint/face authentication with strict fallback prevention |
| **Network** | @capacitor/network | 8.x | Native network status detection powering the offline queue engine |
| **Preferences** | @capacitor/preferences | 8.x | Secure native key-value storage for PIN |
| **OTA Updates** | @capgo/capacitor-updater | 8.x | Background bundle download, safe boot verification |

---

## Core Modules

### 1. Expense Tracking & Financial Dashboard

The core module. Double-entry transaction ledger with Income, Expense, and Transfer types across user-defined accounts (Bank, Cash, eWallet, etc.).

- **Dashboard**: Total balance, today's spending, weekly spending, 7-day trend chart, pinned savings goals
- **History**: Dual-layer filtering — **Time** (Today / This Week / All) × **Category** (horizontally scrollable pills derived from user categories). Filters stack with AND logic
- **Analytics**: Category breakdown pie chart, stacked cash flow bar chart, spending velocity projection with daily pace and end-of-month forecast, income-by-account bar chart, account balance pills
- **Subscriptions & Utilities**: Tracked with billing day, source account, and auto-deduct configuration
- **Pending Income**: Income marked as "pending" excluded from balance until cleared
- **Global Currency**: Dynamic currency symbol (RM, MYR, $) configurable in Profile, propagated across every display

### 2. Savings Goals & Budget Tools

- **Savings Goals**: Target-based with progress bar, "Add Funds" quick action, pin to dashboard
- **Food Budget Tracker**: Daily and monthly food spending limits with real-time progress bars
- **Salary Planner**: Pre-allocate income to categories; shows current balance → planned reserves → available cashflow

### 3. Asset Vault

Track physical assets (phones, laptops, headphones) and understand their true cost over time.

- **Dashboard**: Total value, item count, average cost-per-day across filtered categories
- **Detail Overlay**: Purchase price, days active, cost/day, maintenance cost, true total investment
- **Maintenance Timeline**: Vertical timeline with full CRUD for repair/accessory logs
- **Cost / Day** = `(Purchase Price + Total Maintenance) ÷ Days Active`

### 4. Trading / Flipping Tracker

A dedicated module for tracking buy-sell inventory — TCG cards, collectibles, electronics, anything flipped for profit.

- **Dashboard Metrics**: Capital Invested (sum of held items' buy prices), Realized Profit (sum of sell−buy for sold items, green/red), Active Inventory count
- **Active Inventory**: Item cards with name, acquisition date, buy price, "Mark Sold" action, delete
- **Sell Flow**: Modal prompts for sell price with live profit/loss preview before confirmation
- **Sold Items**: Historical ledger showing buy→sell flow, date sold, and bold net profit/loss per item

### 5. Radar Tracker

Personal content feed aggregating news, cinema, and streaming drops.

- **RSS Feeds**: Any blog URL with optional keyword filtering
- **TMDB Cinema**: Malaysian cinema listings with poster art
- **TMDB Streaming**: Netflix, Disney+, Amazon Prime, Apple TV+, HBO Go per-platform drops
- **Unified Feed**: Filter pills by source, deduplicated, broken image fallbacks

### 6. Claims & Splits

Reimbursement workflow with automated double-entry accounting.

- Flag any expense as "Claimable" during entry
- **Claims Hub**: Pending vs Cleared tabs with total pending amount
- **Mark Cleared**: Auto-generates a matching income transaction, restoring balance instantly

---

## Offline-First & Security Engine

### Hydration System

Every successful Supabase fetch saves the full data payload (transactions, goals, subscriptions, utilities, planner items, assets, trade items, accounts) to `localStorage` under `tracker_data_cache`.

On cold boot:
1. A "Loading Tracker..." screen blocks the UI during hydration
2. `refreshData()` attempts to fetch live data from Supabase
3. Supabase errors (which don't throw — they return error objects) are explicitly detected and thrown
4. On failure, the `catch` block reads `tracker_data_cache` and hydrates all React state from the local cache
5. Any pending items in `offline_tx_queue` are prepended to cached transactions so balances stay accurate
6. The UI never shows empty arrays or zero balances

### Background Sync

1. User logs an expense while offline → temporary `offline-${timestamp}` ID → added to React state immediately → pushed to `localStorage['offline_tx_queue']`
2. Network reconnects (detected via both browser events and Capacitor's native `Network` plugin)
3. Queue is flushed to Supabase sequentially
4. `refreshData()` is called post-sync to pull server-assigned UUIDs and refresh the entire UI
5. Toast: *"3 offline expenses synced to cloud!"*

### Native Security

- **PIN Lock**: 6-digit PIN stored in Capacitor Preferences (native secure storage) or localStorage fallback
- **Biometric Auth**: `@aparajita/capacitor-biometric-auth` with `allowDeviceCredential: false` and `androidConfirmationRequired: true` — background tap cannot bypass the prompt
- **Flow**: On cold boot → attempt biometric → if success, instant unlock (no secondary PIN prompt) → if fail/cancel, show PIN pad
- **Hardware Back Button**: Intercepted via `@capacitor/app` using Next.js `useRouter().back()` for proper App Router navigation; exits app on root paths (`/` and `/hub`)

---

## Developer Deployment Workflow

### Two Deployment Targets

| Target | Method | Affects |
|---|---|---|
| **Web Preview** | `git push` → Vercel auto-deploys | Browser preview only — **zero effect on the Android app** |
| **Android OTA** | `npx @capgo/cli bundle upload` | All installed Android devices on the target channel |
| **New APK** | Android Studio → Build APK | Required only for native/structural changes |

> **CRITICAL**: Pushing to GitHub/Vercel does **nothing** for Android users. You must explicitly push an OTA bundle.

### OTA Update (Code Changes)

```bash
npm run build
npx @capgo/cli bundle upload --channel production
```

Devices download the bundle in the background and apply it on the next cold boot. `CapacitorUpdater.notifyAppReady()` confirms the update is stable.

### New APK (Native/Structural Changes)

```bash
npm run build
npx cap sync
npx cap open android
# Android Studio → Build → Build Bundle(s) / APK(s) → Build APK(s)
```

---

## Local Development Setup

### Prerequisites

- Node.js 18+ / npm 9+
- Supabase project (free tier)
- Android Studio (for APK builds only)
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

Run `supabase/schema.sql` in your Supabase SQL Editor, then:

```bash
npm run dev
# Open http://localhost:3000
```

> Capacitor features (biometric, native network, OTA) only work in the compiled APK.

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
| `radar_sources` | Content feeds | `source_type`, `name`, `url`, `keywords` |
| `trade_items` | Trading inventory | `item_name`, `buy_price`, `sell_price`, `status` (held/sold), `date_acquired`, `date_sold` |

**User Metadata** (stored in `auth.users.raw_user_meta_data`):

`display_name` · `custom_accounts` · `include_savings` · `enable_food_budget` · `enable_salary_planner` · `food_daily_limit` · `food_monthly_limit` · `pin_enabled` · `biometric_enabled` · `vault_enabled` · `radar_enabled` · `claims_enabled` · `trading_enabled`

---

## Project Structure

```
my-expense-tracker/
├── app/
│   ├── layout.tsx              # Root — AppProvider + AppLayout
│   ├── page.tsx                # Dashboard — balance, velocity, trends
│   ├── analytics/page.tsx      # Stats — pie, bar, velocity, income-by-account
│   ├── history/page.tsx        # Dual-layer filtered transaction history
│   ├── goals/page.tsx          # Goals + Food Budget + Salary Planner
│   ├── hub/page.tsx            # Hub — Morning Briefing + module launcher
│   ├── hub/claims/page.tsx     # Claims & Splits
│   ├── hub/radar/page.tsx      # Radar feed — RSS + TMDB
│   ├── hub/radar/settings/     # Radar source CRUD
│   ├── trading/page.tsx        # Trading / Flipping tracker
│   ├── vault/page.tsx          # Asset Vault
│   └── profile/page.tsx        # Settings, modules, security, data
├── components/
│   ├── AppLayout.tsx           # Shell — toast, nav, modal, back button
│   ├── AssetDetailOverlay.tsx  # Asset detail + maintenance logs
│   ├── AuthGate.tsx            # Biometric + PIN lock screen
│   ├── AuthScreen.tsx          # Login / Signup
│   ├── BottomNav.tsx           # 5-tab navigation with FAB
│   ├── FoodBudgetCard.tsx      # Food spend tracker
│   ├── SalaryPlanner.tsx       # Salary cashflow planner
│   └── TransactionModal.tsx    # Add/Edit transaction + claims toggle
├── lib/
│   ├── context.tsx             # Global state, offline engine, cache, sync, CRUD
│   ├── supabase.ts             # Supabase client init
│   └── utils.ts                # Utility functions
├── supabase/
│   └── schema.sql              # Full schema + RLS + trade_items
├── capacitor.config.ts         # Native Android configuration
├── next.config.ts              # Static export config
└── package.json
```

---

## User Manual

### Installation

Install the APK on your Android device once. That's it — all future updates are delivered automatically in the background via OTA. No Play Store visits required.

### Daily Usage

**Logging an expense**: Tap the center **+** button from any screen → enter amount → pick category → pick account → save. Three seconds.

**Transfers**: Tap + → select Transfer → enter amount, source, and destination accounts.

**Income**: Tap + → select Income. Optionally mark as "Pending" for unpaid invoices.

### Dual-Layer History Filters

The History tab has two filter rows:

1. **Time row**: Today / This Week / Show All
2. **Category row**: Horizontally scrollable pills (Food, Transport, etc.) + "All Categories"

Filters stack with AND logic. Selecting "This Week" + "Food" shows only food transactions from this week. The subtitle updates: *"This Week • Food — 3 transactions"*. Tap "Clear All Filters" to reset.

### Billing Cycle

Your billing cycle resets on a configurable day (Profile → Billing Cycle → pick day 1–31). The Analytics page respects this for monthly views.

### Offline Mode

Use the app exactly the same way with zero connectivity:

- Open the app in Airplane Mode — your last-known data loads instantly from cache
- Log expenses normally — they save to your device and appear in your dashboard immediately
- When signal returns, everything syncs automatically to the cloud
- Toast confirms: *"3 offline expenses synced to cloud!"*

No data is ever lost. No sync button to press.

### Trading / Flipping

Enable in Profile → Modules → Trading / Flipping. Access via Hub.

1. Tap **+** to add an item with name, buy price, and acquisition date
2. Items appear in **Active Inventory** with your total capital invested
3. When you sell, tap **Mark Sold** → enter sell price → confirm
4. The item moves to **Sold Items** with profit/loss displayed
5. Dashboard shows your total realized profit across all trades

### Security

- **PIN**: Profile → Security → Use PIN to Login → set 6-digit PIN
- **Biometrics**: Enable after PIN is set → fingerprint/face unlock on cold boot
- **Dark Mode**: Profile → toggle Dark Mode
- **Accent Colors**: Profile → choose Blue, Emerald, Yellow, Purple, or Rose

---

## License

Private project. All rights reserved.
