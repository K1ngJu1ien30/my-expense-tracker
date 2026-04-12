# Tracker — Expense & Lifestyle Super App

> A mobile-first, offline-capable lifestyle aggregator and financial tracker purpose-built for native Android deployment via Capacitor. Combines real-time expense tracking, predictive spend analytics, asset amortization management, and a dynamic content radar into a single unified experience — designed for one-handed use during a daily commute.

**Live:** [my-expense-tracker-pearl.vercel.app](https://my-expense-tracker-pearl.vercel.app/)

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Core Modules — The 4 Pillars](#core-modules)
3. [Architecture Overview](#architecture-overview)
4. [Local Setup & Environment](#local-setup--environment)
5. [Database Schema (Supabase)](#database-schema)
6. [Project Structure](#project-structure)

---

## Tech Stack

| Technology | Role |
|---|---|
| **Next.js** (App Router, `output: "export"`, `trailingSlash: true`) | Static site generation for Capacitor WebView compatibility |
| **Capacitor** | Native Android wrapper — biometric auth, hardware back button, network detection |
| **TypeScript** | Full type safety across all modules and context |
| **Tailwind CSS** | Utility-first styling with CSS custom properties for dynamic accent theming |
| **Supabase** | PostgreSQL database, email/password auth, Row Level Security, user metadata storage |
| **Recharts** | Data visualization — `LineChart`, `PieChart`, `BarChart` with custom glassmorphism tooltips |
| **Framer Motion** | Spring-physics animations, `AnimatePresence` transitions, drag interactions |
| **@capacitor/app** | Hardware back button interception + app exit control |
| **@capacitor/network** | Native network status detection for offline queue engine |

---

## Core Modules

### 1. Financial Hub & Analytics

The financial core provides real-time multi-account balance tracking with double-entry transfer accounting, category breakdowns, and forward-looking projections.

**Predictive Velocity Analytics** (`app/analytics/page.tsx`)
- Computes cumulative daily spend for the current calendar month
- Calculates a **Daily Average Velocity** = `totalSpend / currentDayOfMonth`
- Projects **End-of-Month Spend** = `dailyAvg × daysInMonth`
- Renders a dual-line Recharts `LineChart`: solid line for actual cumulative spend, dashed line for projected trajectory from today to month-end
- Summary: *"At your current pace of RM X.XX/day, you are projected to spend RM Y,YYY.YY this month"*

**Commute Mode — Morning Briefing** (`app/hub/page.tsx`)
- A large briefing card at the top of the Hub showing **Today's Velocity** (total expenses today) using local-timezone-aware date boundaries
- **Radar Alert** badge counts today's new RSS articles and TMDB drops across the user's configured sources
- **Quick Log Expense** button triggers the global transaction modal via context-level state (`showTransactionModal`), enabling one-tap expense logging from the Hub

**Global Currency Formatting**
- `formatCurrency(amount)` helper in context uses the user's selected currency symbol (RM, $, €)
- Stored in Supabase `user_metadata` and applied consistently across the dashboard, analytics, and asset modules

---

### 2. The Asset Vault

A full asset lifecycle manager with amortization analytics, rendered as a **state-driven full-screen overlay** to bypass Capacitor's static routing limitations.

**Architecture Decision: Overlay vs. Route**
- Standard Next.js dynamic routes (`/vault/detail?id=X`) crash in Capacitor's Android WebView because `output: "export"` generates static HTML files — query parameters resolve to non-existent file paths
- Solution: `components/AssetDetailOverlay.tsx` renders as a `fixed inset-0 z-[200]` overlay triggered by local state (`selectedAssetId`) in the parent vault page — zero Next.js routing involved
- Slides in from right via Framer Motion spring animation; back button clears state and unmounts

**Amortization Analytics**
- **Dashboard** (`app/vault/page.tsx`): 3-column summary grid — Total Value, Items Tracked, **Avg Cost / Day** (sum of `purchase_price / daysActive` for each filtered asset)
- **Detail Overlay**: Hero card computes per-asset **Cost / Day** = `trueTotalInvestment / daysActive`, where `trueTotalInvestment = purchase_price + SUM(asset_logs.cost)`
- Filter pills recalculate all math instantly when switching categories

**Maintenance Timeline**
- Vertical timeline UI with accent-colored newest-node dot, date labels, description, and red `+ RM X.XX` cost badges
- Full CRUD: Add, Edit (pre-filled dual-purpose modal), Delete (with confirmation dialog) — all update local state immediately, triggering instant Cost/Day recalculation via `useMemo`

---

### 3. The Radar Engine

A dynamic, user-customizable content aggregator combining RSS feeds and TMDB movie data into a unified feed.

**Source Management** (`app/hub/radar/settings/page.tsx`)
- Full CRUD for radar sources stored in `radar_sources` Supabase table
- Three source types: **RSS Feed** (URL + optional comma-separated keyword filter), **In Cinemas (MY)** (TMDB now_playing), **Streaming Drops** (TMDB discover with platform selector)
- Streaming platform selector: custom React dropdown (not native `<select>`) with Netflix, Disney+, Amazon Prime, Apple TV+, HBO Go, or All Major Platforms — stores provider ID in `url` column

**Dynamic Fetch Engine** (`app/hub/radar/page.tsx`)
- On mount, fetches user's `radar_sources` from Supabase, then executes parallel fetches via `Promise.all`
- Each fetcher is individually `.catch()`-wrapped so one failed source doesn't crash the entire feed
- **RSS**: Fetches via `rss2json` API, applies keyword filtering, maps `feed.title` as badge text
- **TMDB Cinema**: `GET /movie/now_playing?region=MY`
- **TMDB Streaming**: `GET /discover/movie?watch_region=MY&with_watch_providers={id}` — provider ID read dynamically from `source.url`
- All results normalized into a unified `RadarItem` interface: `{ id, title, date, snippet, image, category, badge, sourceType, link, platform? }`

**UI & Filtering**
- Deduplicated horizontal filter pills generated from `Array.from(new Set(sources.map(s => s.name)))` — clicking one pill shows items from all underlying sources sharing that category
- TMDB cards render with poster banner, gradient overlay (`from-black/90 via-black/50 to-black/10`), and platform badge (e.g., "Netflix • Apr 10, 2026")
- RSS cards render compact with thumbnail + text; broken images gracefully hidden via `onError`
- TMDB API key stored in `.env.local` as `NEXT_PUBLIC_TMDB_API_KEY`

---

### 4. Offline Architecture (LRT Mode)

Seamless offline operation using local storage queuing and automatic cloud sync on reconnect.

**Network Detection**
- Dual-layer: browser `navigator.onLine` + `online`/`offline` events, plus native `@capacitor/network` plugin for Capacitor builds
- `isOffline` boolean exposed via global context — any component can read network state
- Dynamic import with `// @ts-ignore` + `.catch()` ensures Vercel web builds don't crash on missing native modules

**Offline Transaction Queue**
- When `isOffline === true`, `addTransaction()` skips Supabase entirely:
  1. Generates temporary `offline-${Date.now()}` ID
  2. Appends to React state immediately (UI updates instantly)
  3. Pushes to `localStorage["offline_tx_queue"]` JSON array
  4. Shows toast: "No connection. Expense saved offline."

**Auto-Sync Engine**
- On reconnect (`networkStatusChange` or browser `online` event):
  1. Reads `localStorage["offline_tx_queue"]`
  2. Loops through queued transactions, inserting each into Supabase
  3. Clears the queue from localStorage
  4. Shows toast: "{N} offline expense(s) synced to cloud!"

**Graceful Degradation**
- Initial data fetch (`Promise.all` across 5 Supabase tables) wrapped in `try/catch` — on failure, app renders with empty state instead of white screen crash
- All Capacitor-specific imports use dynamic `import()` + `.catch()` pattern for web compatibility

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    app/layout.tsx                        │
│  ┌───────────────────────────────────────────────────┐  │
│  │              <AppProvider>                         │  │
│  │   Context: auth, transactions, goals, assets,     │  │
│  │   subscriptions, offline queue, modal triggers     │  │
│  │   ┌─────────────────────────────────────────┐     │  │
│  │   │          <AppLayout>                    │     │  │
│  │   │  ┌──────────┐  ┌────────────────────┐  │     │  │
│  │   │  │ AuthGate │  │   Page Components  │  │     │  │
│  │   │  │ (PIN/Bio)│  │  + Overlay System  │  │     │  │
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
│              │   Truth + Offline Q    │    (offline_tx)  │
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
- **Context-Driven Architecture**: All state flows through `lib/context.tsx` — 600+ lines managing auth, data, offline queue, UI triggers, and Capacitor listeners
- **Optimistic UI**: CRUD operations update local React state immediately, then sync to Supabase
- **Static Export Compatibility**: `output: "export"` + `trailingSlash: true` generates `/page/index.html` for every route — required for Capacitor WebView
- **Overlay-Based Navigation**: Complex detail views (Asset Vault) use full-screen overlay components instead of Next.js routes to avoid WebView static file resolution crashes

---

## Local Setup & Environment

### Prerequisites
- Node.js 18+
- npm 9+
- A Supabase project (free tier works)

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

- **Supabase**: Get your URL and anon key from [Supabase Dashboard](https://app.supabase.com) → Settings → API
- **TMDB**: Get a free API key from [themoviedb.org](https://www.themoviedb.org/settings/api)

### 3. Setup Database

Run the SQL in `supabase/schema.sql` against your Supabase project's SQL Editor. This creates all tables with RLS policies.

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

All tables use UUID primary keys (`uuid_generate_v4()`), `user_id` foreign keys cascading to `auth.users`, and strict RLS policies (`auth.uid() = user_id`).

| Table | Purpose | Key Columns |
|---|---|---|
| `transactions` | Core financial ledger | `amount`, `type` (Income/Expense/Transfer), `category`, `account`, `to_account`, `date`, `status` (cleared/pending) |
| `goals` | Savings goal tracking | `title`, `current_amount`, `target_amount`, `is_pinned` |
| `subscriptions` | Recurring payments | `name`, `amount`, `billing_day`, `source_account`, `auto_deduct`, `type` (subscription/utility) |
| `salary_planner` | Budget allocation items | `category`, `item_name`, `amount` |
| `asset_vault` | Physical asset registry | `name`, `category`, `emoji_icon`, `purchase_date`, `purchase_price` |
| `asset_logs` | Maintenance timeline entries | `asset_id` (FK → asset_vault), `log_date`, `description`, `cost` |
| `radar_sources` | User-configured feed sources | `source_type` (rss/tmdb_cinema/tmdb_streaming), `name`, `url`, `keywords` |

**User Metadata** (stored in `auth.users.raw_user_meta_data`):
Settings like `display_name`, `custom_accounts`, `include_savings`, `enable_food_budget`, `pin_enabled`, `biometric_enabled`, `vault_enabled`, `radar_enabled`, and food/salary limits — eliminates a separate settings table.

---

## Project Structure

```
my-expense-tracker/
├── app/
│   ├── layout.tsx              # Root layout — AppProvider + AppLayout
│   ├── page.tsx                # Dashboard — balance, today/weekly, trend chart
│   ├── analytics/page.tsx      # Stats — pie, bar, velocity projection chart
│   ├── history/page.tsx        # Transaction history list
│   ├── goals/page.tsx          # Goals + Food Budget + Salary Planner
│   ├── hub/page.tsx            # Hub — Morning Briefing + module launcher
│   ├── hub/radar/page.tsx      # Radar feed — dynamic RSS + TMDB aggregator
│   ├── hub/radar/settings/     # Radar source CRUD management
│   ├── vault/page.tsx          # Asset Vault dashboard + overlay injection
│   ├── vault/detail/page.tsx   # (Legacy) Detail page — superseded by overlay
│   └── profile/page.tsx        # Profile, settings, modules, data management
├── components/
│   ├── AppLayout.tsx           # App shell — toast, nav, transaction modal
│   ├── AssetDetailOverlay.tsx  # Full-screen asset detail + maintenance CRUD
│   ├── AuthGate.tsx            # Biometric/PIN lock screen
│   ├── AuthScreen.tsx          # Login / Signup
│   ├── BottomNav.tsx           # 5-tab navigation with FAB
│   ├── FoodBudgetCard.tsx      # Daily/monthly food budget tracker
│   ├── SalaryPlanner.tsx       # Salary cashflow planner
│   └── TransactionModal.tsx    # Add/Edit transaction bottom sheet
├── lib/
│   ├── context.tsx             # Global state — auth, data, offline, Capacitor
│   ├── supabase.ts             # Supabase client init
│   └── utils.ts                # Utility functions
├── supabase/
│   └── schema.sql              # Full database schema + RLS policies
├── capacitor.config.ts         # Capacitor native config
├── next.config.ts              # Static export + trailing slash
└── package.json
```

---

## License

Private project. All rights reserved.
