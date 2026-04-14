# Tracker — Offline-First Native Android Expense App

> A true native Android application — not a web app, not a PWA. Built with Next.js compiled to static assets, wrapped into a native APK via Capacitor, powered by Supabase, and updated over-the-air via Capgo. Designed for zero-connectivity resilience from the ground up.

---

## Table of Contents

1. [Project Overview & Architecture](#project-overview--architecture)
2. [Key Features](#key-features)
3. [Tech Stack](#tech-stack)
4. [Developer Deployment Workflow](#developer-deployment-workflow)
5. [Local Development Setup](#local-development-setup)
6. [Database Schema](#database-schema)
7. [Project Structure](#project-structure)
8. [User Manual](#user-manual)

---

## Project Overview & Architecture

This is **not** a website deployed to Vercel. This is a native Android application.

The codebase is a Next.js (React) project configured with `output: "export"` which compiles the entire app into static HTML, CSS, and JavaScript files. These static assets are then bundled into a native Android APK using **Capacitor**, which runs them inside a native WebView with full access to device APIs (biometrics, network status, hardware back button).

The backend is powered by **Supabase** — providing PostgreSQL, email/password authentication, Row Level Security, and user metadata storage. The app communicates with Supabase over HTTPS, but is engineered to function fully when that connection is unavailable.

```
┌──────────────────────────────────────────────────────┐
│                  Android Device                       │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │          Capacitor Native Shell (APK)          │  │
│  │  ┌──────────────────────────────────────────┐  │  │
│  │  │     Next.js Static Assets (WebView)      │  │  │
│  │  │                                          │  │  │
│  │  │  ┌──────────────────────────────────┐    │  │  │
│  │  │  │     lib/context.tsx               │    │  │  │
│  │  │  │   Global State + Offline Engine   │    │  │  │
│  │  │  │                                   │    │  │  │
│  │  │  │  try: Supabase fetch ──► setState │    │  │  │
│  │  │  │       + save localStorage cache   │    │  │  │
│  │  │  │                                   │    │  │  │
│  │  │  │  catch: read localStorage cache   │    │  │  │
│  │  │  │       + prepend offline queue     │    │  │  │
│  │  │  │       ──► setState (hydrate UI)   │    │  │  │
│  │  │  └──────────────────────────────────┘    │  │  │
│  │  │                   │                      │  │  │
│  │  │          localStorage (device)           │  │  │
│  │  │    ├── tracker_data_cache (full state)   │  │  │
│  │  │    └── offline_tx_queue (pending sync)   │  │  │
│  │  └──────────────────────────────────────────┘  │  │
│  │                      │                         │  │
│  │  Capacitor Plugins: Network, Biometric, App    │  │
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

## Key Features

### Offline-First Hydration

The app uses a bulletproof `localStorage` caching system built into `lib/context.tsx`:

- On every successful Supabase fetch, the entire data payload (transactions, goals, subscriptions, utilities, planner items, assets, accounts) is saved to `localStorage` under the key `tracker_data_cache`.
- On a cold boot with no network, Supabase's `select()` returns error objects instead of throwing exceptions. The app explicitly detects these errors and throws into a `catch` block that reads the cache.
- A **hydration loading screen** (`"Loading Tracker..."`) blocks the UI until data is fully loaded — whether from the network or the cache. The user never sees empty arrays or zero balances.

### Background Syncing

Users can log transactions completely offline:

1. The expense is assigned a temporary `offline-${timestamp}` ID and added to React state immediately (UI updates instantly).
2. The transaction is pushed to a `localStorage` queue under `offline_tx_queue`.
3. The user sees: *"No connection. Expense saved offline."*
4. The moment the network reconnects (detected via both browser events and Capacitor's native `Network` plugin), the queue is automatically flushed to Supabase.
5. After sync, `refreshData()` is called to pull server-assigned UUIDs and refresh the entire UI.
6. The user sees: *"3 offline expenses synced to cloud!"*

During offline cold boots, any pending items in `offline_tx_queue` are prepended to the cached transactions so balances and history stay accurate.

### Over-The-Air (OTA) Updates

Powered by **Capgo**. The traditional update cycle (code → build → upload to Play Store → wait for review → user manually updates) is completely bypassed:

1. Developer pushes a new bundle via `npx @capgo/cli bundle upload`.
2. Capgo distributes the bundle to all devices on the target channel.
3. The app downloads the new bundle in the background.
4. On the next cold boot, the app loads the updated code seamlessly.
5. `CapacitorUpdater.notifyAppReady()` confirms the update is stable (safe boot mechanism).

Users never need to visit the Play Store for feature updates or bug fixes.

### Additional Features

- **Double-Entry Claims Engine** — Flag expenses as claimable; marking them cleared auto-generates a matching income entry.
- **Asset Vault** — Track physical assets with purchase price, maintenance logs, and cost-per-day calculations.
- **Radar Tracker** — Aggregated RSS feeds, cinema listings, and streaming drops in one feed.
- **Predictive Velocity** — Projected end-of-month spending based on daily velocity.
- **Food Budget Tracking** — Daily and monthly food spend limits with real-time tracking.
- **Salary Planner** — Pre-allocate income to budget categories.
- **PIN & Biometric Lock** — Device-level security via Capacitor.
- **Dark Mode + Accent Colors** — Full theming support.

---

## Tech Stack

| Layer | Technology | Role |
|---|---|---|
| **Frontend** | Next.js 16, React 19, TypeScript | Static site generation (`output: "export"`) for Capacitor compatibility |
| **Styling** | Tailwind CSS 4, Framer Motion | Utility-first CSS + spring-physics animations |
| **Charts** | Recharts | Line, pie, and bar charts with custom tooltips |
| **Icons** | Lucide React | Consistent icon library |
| **Backend** | Supabase | PostgreSQL, email/password auth, RLS, user metadata |
| **Native Wrapper** | Capacitor 8 | Android APK generation, native API access |
| **Native Plugins** | @capacitor/network, @capacitor/app, capacitor-biometric-auth | Network detection, back button, fingerprint |
| **Live Updates** | @capgo/capacitor-updater | OTA bundle distribution, safe boot |

---

## Developer Deployment Workflow

### Understanding the Two Deployment Targets

| Target | Method | Affects |
|---|---|---|
| **Web Preview** (Vercel) | `git push` to GitHub → Vercel auto-deploys | Browser preview only — **has zero effect on the Android app** |
| **Android App** (OTA) | `npx @capgo/cli bundle upload` | All installed Android devices on the target channel |

> **CRITICAL:** Pushing to GitHub/Vercel does **nothing** for Android users. The Android app loads static assets from its local bundle, not from Vercel. You must explicitly push an OTA update for changes to reach Android devices.

### Pushing a Live OTA Update to Android

This is the command sequence to ship a code update to every installed Android device:

```bash
# 1. Build the static export
npm run build

# 2. Upload the bundle to Capgo for OTA distribution
npx @capgo/cli bundle upload --channel production
```

That's it. Capgo handles distribution. Devices download the bundle in the background and apply it on the next cold boot.

### Building the Master APK (For New Installations)

New users need a one-time APK install. This is how you build it:

```bash
# 1. Build the static export
npm run build

# 2. Sync web assets into the native Android project
npx cap sync

# 3. Open in Android Studio
npx cap open android
```

Then in Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**

The generated APK can be distributed directly or uploaded to the Google Play Store. After the initial install, all subsequent updates are delivered via OTA — users never need to re-download the APK.

---

## Local Development Setup

### Prerequisites

- Node.js 18+
- npm 9+
- A Supabase project (free tier works)
- Android Studio (for APK builds only)
- TMDB API key (free at [themoviedb.org](https://www.themoviedb.org/settings/api)) — optional, for Radar module

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

Run `supabase/schema.sql` in your Supabase SQL Editor. This creates all tables with UUID primary keys, foreign key cascades, CHECK constraints, and RLS policies.

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the browser preview.

> **Note:** Capacitor-specific features (biometric auth, native network detection, OTA updates) only work in the compiled APK, not in the browser dev server.

---

## Database Schema

All tables use `uuid_generate_v4()` primary keys, `user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE`, and strict RLS: `FOR ALL USING (auth.uid() = user_id)`.

| Table | Purpose | Key Columns |
|---|---|---|
| `transactions` | Core financial ledger | `amount`, `type`, `category`, `account`, `to_account`, `date`, `status`, `is_claimable`, `claim_status` |
| `goals` | Savings goal tracking | `title`, `current_amount`, `target_amount`, `is_pinned` |
| `subscriptions` | Recurring payments | `name`, `amount`, `billing_day`, `source_account`, `auto_deduct`, `type` |
| `salary_planner` | Budget allocation | `category`, `item_name`, `amount` |
| `asset_vault` | Physical asset registry | `name`, `category`, `emoji_icon`, `purchase_date`, `purchase_price` |
| `asset_logs` | Maintenance timeline | `asset_id` (FK), `log_date`, `description`, `cost` |
| `radar_sources` | Content feed config | `source_type`, `name`, `url`, `keywords` |

**User Metadata** (stored in `auth.users.raw_user_meta_data`):

`display_name`, `custom_accounts`, `include_savings`, `enable_food_budget`, `enable_salary_planner`, `food_daily_limit`, `food_monthly_limit`, `pin_enabled`, `biometric_enabled`, `vault_enabled`, `radar_enabled`, `claims_enabled`

---

## Project Structure

```
my-expense-tracker/
├── app/
│   ├── layout.tsx              # Root — AppProvider + AppLayout
│   ├── page.tsx                # Dashboard — balance, velocity, trends
│   ├── analytics/page.tsx      # Stats — pie, bar, velocity projection
│   ├── history/page.tsx        # Filtered transaction history
│   ├── goals/page.tsx          # Goals + Food Budget + Salary Planner
│   ├── hub/page.tsx            # Hub — Morning Briefing + modules
│   ├── hub/claims/page.tsx     # Claims & Splits
│   ├── hub/radar/page.tsx      # Radar feed — RSS + TMDB
│   ├── hub/radar/settings/     # Radar source CRUD
│   ├── vault/page.tsx          # Asset Vault
│   └── profile/page.tsx        # Settings, modules, security
├── components/
│   ├── AppLayout.tsx           # Shell — toast, nav, modal
│   ├── AssetDetailOverlay.tsx  # Asset detail + maintenance logs
│   ├── AuthGate.tsx            # PIN / biometric lock screen
│   ├── AuthScreen.tsx          # Login / Signup
│   ├── BottomNav.tsx           # 5-tab navigation with FAB
│   ├── FoodBudgetCard.tsx      # Food spend tracker
│   ├── SalaryPlanner.tsx       # Salary cashflow planner
│   └── TransactionModal.tsx    # Add/Edit transaction + claims toggle
├── lib/
│   ├── context.tsx             # Global state, offline engine, cache, sync
│   ├── supabase.ts             # Supabase client init
│   └── utils.ts                # Utility functions
├── supabase/
│   └── schema.sql              # Full schema + RLS
├── capacitor.config.ts         # Native Android configuration
├── next.config.ts              # Static export config
└── package.json
```

---

## User Manual

### Installation (One-Time)

1. Receive the APK file from the developer.
2. Install it on your Android device (you may need to enable "Install from Unknown Sources" in Settings).
3. Open the app and create an account.

**That's it.** You will never need to reinstall or update manually. All future updates are delivered automatically in the background.

### How Updates Work

- The app checks for updates every time it opens.
- If a new version is available, it downloads silently in the background.
- The update is applied the next time you fully close and reopen the app.
- You don't need to do anything — no Play Store, no download prompts, no waiting.

### Using the App Offline

You can use this app with **zero internet connectivity**. Here's what to expect:

**Logging expenses offline:**
1. Open the app normally — even in Airplane Mode.
2. Your last-known data (balances, transactions, goals) loads from the device cache.
3. Tap **+** and log an expense as usual. It saves locally on your device.
4. You'll see: *"No connection. Expense saved offline."*
5. Your dashboard updates immediately with the offline entry included.

**When you reconnect:**
1. The app detects the network automatically.
2. All queued expenses upload to the cloud invisibly.
3. You'll see: *"3 offline expenses synced to cloud!"*
4. The UI refreshes with server-confirmed data.

**The bottom line:** Use the app exactly the same way whether you have signal or not. Log your coffee in the train tunnel, your lunch in the basement food court, your parking at the underground lot. Everything syncs when you surface. No data is ever lost.

### Quick Tips

- **Quick Log:** Tap the center **+** button on the bottom bar from any screen.
- **Claims:** Flag an expense as "Claimable" when adding it. Mark it cleared later to auto-generate a matching income entry.
- **Asset Vault:** Track your gadgets and see their cost-per-day drop over time. Add maintenance logs for the true total cost.
- **Radar:** Set up RSS feeds, cinema listings, or streaming alerts in one aggregated feed.
- **Dark Mode & Themes:** Profile → toggle Dark Mode or change your accent color.
- **Security:** Profile → Security → set a PIN or enable fingerprint lock.

---

## License

Private project. All rights reserved.
