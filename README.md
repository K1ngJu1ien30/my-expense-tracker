# Tracker — Personal Finance Dashboard

> A beautifully crafted, mobile-first Progressive Web App for personal finance management. Built with Next.js 16, React 19, Supabase, and a modern design system featuring animated charts, dark mode, and a native-like experience.

---

## Table of Contents

1. [Project Overview & Tech Stack](#1-project-overview--tech-stack)
2. [System Architecture & Data Flow](#2-system-architecture--data-flow)
3. [Backend Logic & Database Schema](#3-backend-logic--database-schema)
4. [Comprehensive User Manual](#4-comprehensive-user-manual)

---

## 1. Project Overview & Tech Stack

**Tracker** is a full-featured personal finance and budgeting dashboard designed as a Progressive Web App (PWA). It provides real-time balance tracking across multiple accounts, double-entry transfer accounting, dynamic analytics with interactive charts, savings goals, food budget tracking, and salary cashflow planning — all within a polished, mobile-first interface that feels native on any device.

### Core Technologies

| Technology | Version | Role |
|---|---|---|
| **Next.js** (App Router) | 16.2.3 | Framework — file-based routing, SSR, metadata API |
| **React** | 19.2.4 | UI rendering with hooks (`useState`, `useMemo`, `useEffect`, `useContext`) |
| **TypeScript** | ^5 | Full type safety across all components and context |
| **Tailwind CSS** | ^4 | Utility-first styling with CSS custom properties for theming |
| **Recharts** | ^3.8.1 | Data visualization — `LineChart`, `PieChart`, `BarChart` |
| **Framer Motion** | ^12.38.0 | Animations — page transitions, modals, progress bars, drag-to-reorder |
| **Supabase** | ^2.103.0 | Backend-as-a-Service — PostgreSQL database, authentication, Row Level Security |
| **Lucide React** | ^1.8.0 | Icon library — consistent, lightweight SVG icons throughout the UI |
| **Geist Font** | (Google Fonts) | Typography — `Geist` (sans) and `Geist Mono` for code/IDs |

### Project Structure

```
my-expense-tracker/
├── app/
│   ├── layout.tsx            # Root layout — AppProvider + AppLayout shell
│   ├── page.tsx              # Dashboard / Home page
│   ├── globals.css           # Global styles + Tailwind directives
│   ├── analytics/page.tsx    # Analytics & Stats page
│   ├── goals/page.tsx        # Goals + Budgeting modules page
│   ├── history/page.tsx      # Transaction history page
│   └── profile/page.tsx      # Profile & Settings page
├── components/
│   ├── AppLayout.tsx         # App shell — auth gate, toast layer, bottom nav
│   ├── AuthScreen.tsx        # Login / Signup screen
│   ├── BottomNav.tsx         # Fixed bottom navigation with FAB
│   ├── FoodBudgetCard.tsx    # Daily/Monthly food budget tracker module
│   ├── InstallPrompt.tsx     # PWA install prompt (iOS + Android)
│   ├── SalaryPlanner.tsx     # Salary cashflow planner module
│   └── TransactionModal.tsx  # Add/Edit transaction bottom sheet
├── lib/
│   ├── context.tsx           # Global state manager (React Context + Supabase)
│   ├── supabase.ts           # Supabase client initialization
│   └── utils.ts              # Utility functions (cn for class merging)
├── public/
│   ├── manifest.json         # PWA manifest
│   └── icon.png              # App icon (512x512)
├── supabase/
│   └── schema.sql            # Database schema definition
├── package.json
├── tsconfig.json
├── next.config.ts
└── tailwind.config.ts
```

---

## 2. System Architecture & Data Flow

### 2.1 Frontend-to-Backend Data Flow

The application follows a **Context-Driven Architecture** where all data flows through a single centralized React Context provider.

```
┌─────────────────────────────────────────────────────────┐
│                    app/layout.tsx                        │
│  ┌───────────────────────────────────────────────────┐  │
│  │              <AppProvider>                         │  │
│  │   ┌─────────────────────────────────────────┐     │  │
│  │   │          <AppLayout>                    │     │  │
│  │   │  ┌──────────┐  ┌────────────────────┐  │     │  │
│  │   │  │ AuthGate │  │   Page Components  │  │     │  │
│  │   │  └──────────┘  │  (Dashboard, etc.) │  │     │  │
│  │   │                └────────────────────┘  │     │  │
│  │   │  ┌──────────────────────────────────┐  │     │  │
│  │   │  │ BottomNav + TransactionModal     │  │     │  │
│  │   │  └──────────────────────────────────┘  │     │  │
│  │   └─────────────────────────────────────────┘     │  │
│  └───────────────────────────────────────────────────┘  │
│                          │                              │
│                    useAppContext()                       │
│                          │                              │
│              ┌───────────▼───────────┐                  │
│              │   lib/context.tsx      │                  │
│              │   (Single Source of    │                  │
│              │    Truth — all state   │                  │
│              │    + CRUD operations)  │                  │
│              └───────────┬───────────┘                  │
│                          │                              │
│              ┌───────────▼───────────┐                  │
│              │   Supabase Client     │                  │
│              │   (REST API calls)    │                  │
│              └───────────┬───────────┘                  │
└──────────────────────────┼──────────────────────────────┘
                           │
                ┌──────────▼──────────┐
                │   Supabase Cloud    │
                │  ┌──────────────┐   │
                │  │  PostgreSQL  │   │
                │  │  + Auth      │   │
                │  │  + RLS       │   │
                │  └──────────────┘   │
                └─────────────────────┘
```

**Lifecycle:**

1. **App Boot** → `AppProvider` mounts → calls `supabase.auth.getSession()` to recover the session
2. **Auth State Change** → `onAuthStateChange` listener updates session → triggers data fetch
3. **Data Fetch** → On valid session, `Promise.all()` fetches `transactions`, `goals`, `subscriptions`, and `salary_planner` in parallel from Supabase
4. **User Metadata** → Settings like `custom_accounts`, `include_savings`, `enable_food_budget`, `food_daily_limit`, etc. are read from `session.user.user_metadata`
5. **Context Distribution** → All state + CRUD functions are exposed via `useAppContext()` to any component in the tree
6. **Mutations** → CRUD functions (e.g., `addTransaction`) write to Supabase first, then optimistically update local state on success
7. **Re-renders** → React's Context system automatically re-renders consuming components when state changes

### 2.2 `lib/context.tsx` — The Single Source of Truth

This 459-line file is the backbone of the application. It manages:

| Domain | State | CRUD |
|---|---|---|
| **User** | `userName`, `currency`, `billingCycle`, `accentColor` | `setUserName`, `setCurrency`, etc. |
| **Auth** | `session`, `authLoading` | Supabase Auth listeners |
| **Transactions** | `transactions: Transaction[]` | `addTransaction`, `updateTransaction`, `deleteTransaction` |
| **Goals** | `goals: Goal[]` | `addGoal`, `updateGoal`, `deleteGoal` |
| **Subscriptions** | `subscriptions: Subscription[]` | `addSubscription`, `updateSubscription`, `deleteSubscription` |
| **Utilities** | `utilities: Subscription[]` | `addUtility`, `updateUtility`, `deleteUtility` |
| **Planner** | `plannerItems: PlannerItem[]` | `addPlannerItem`, `deletePlannerItem` |
| **Accounts** | `accounts: string[]` | `addAccount`, `renameAccount`, `deleteAccount`, `reorderAccounts` |
| **Categories** | `categories: string[]` | `addCategory`, `deleteCategory` |
| **Modules** | `enableFoodBudget`, `enableSalaryPlanner`, `foodDailyLimit`, `foodMonthlyLimit` | Toggle/set functions with Supabase metadata sync |
| **UI** | `toast`, `confirmAction`, `editTransactionId` | `triggerToast`, modal state management |

**Key TypeScript Types:**

```typescript
type Transaction = {
  id: string;            // UUID
  type: string;          // "Income" | "Expense" | "Transfer"
  amount: number;
  category: string;
  sub_category?: string;
  account: string;
  to_account?: string;   // Only for Transfers
  date: string;          // ISO 8601
  note?: string;
  user_id?: string;
};

type PlannerItem = {
  id: string;
  category: string;
  item_name: string;
  amount: number;
  user_id?: string;
};
```

### 2.3 PWA Integration

The app is configured as an installable Progressive Web App:

- **`public/manifest.json`** — Defines `"display": "standalone"` for fullscreen native-like experience, dark theme colors (`#0f172a`), and a 512x512 maskable icon
- **`app/layout.tsx`** — Metadata API links the manifest and configures `appleWebApp` for iOS (status bar, title, capability)
- **`components/InstallPrompt.tsx`** — Custom install banner:
  - **Android/Chrome**: Intercepts the `beforeinstallprompt` event, defers it, and shows a custom "Install App" banner with an accent-colored button that triggers the native install prompt
  - **iOS/Safari**: Detects iOS via user agent and shows manual instructions ("Tap Share then Add to Home Screen") since iOS doesn't support `beforeinstallprompt`
  - **Dismissal**: Persists `pwa_prompt_dismissed` to `localStorage` so the banner doesn't re-appear
- **`components/AppLayout.tsx`** — The app shell renders inside a `max-w-md` container that on desktop (`lg:`) simulates a phone frame with rounded corners and a border, making it look like a device mockup. On mobile, it fills the viewport using `100dvh`.

---

## 3. Backend Logic & Database Schema

### 3.1 Supabase Architecture

The backend uses **Supabase** (hosted PostgreSQL) with three layers:

1. **Authentication** — Email/password auth via `supabase.auth`. Session management handles login, signup, logout, and auth state recovery.
2. **Database** — Four PostgreSQL tables with UUID primary keys and `user_id` foreign keys cascading to `auth.users`.
3. **Row Level Security (RLS)** — Every table enforces `auth.uid() = user_id`, ensuring complete data isolation between users at the database level. No user can ever read, update, or delete another user's data — even if client-side code is compromised.

### 3.2 Database Tables

#### `transactions` — Core Financial Ledger

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | PK, auto-generated | Unique transaction identifier |
| `user_id` | `UUID` | FK → `auth.users(id)`, CASCADE | Owner reference |
| `amount` | `DECIMAL(12,2)` | NOT NULL | Transaction amount |
| `date` | `TIMESTAMPTZ` | DEFAULT NOW() | Transaction date (ISO 8601) |
| `type` | `VARCHAR(50)` | NOT NULL | `"Income"`, `"Expense"`, or `"Transfer"` |
| `category` | `VARCHAR(255)` | nullable | Spending category (e.g., Food, Transport) |
| `sub_category` | `VARCHAR(255)` | nullable | Sub-category or tag |
| `account` | `VARCHAR(255)` | nullable | Source account (e.g., "Bank (MBB)") |
| `to_account` | `VARCHAR(255)` | nullable | Destination account (Transfers only) |
| `note` | `TEXT` | nullable | Free-text note |
| `created_at` | `TIMESTAMPTZ` | DEFAULT NOW() | Record creation timestamp |

#### `goals` — Savings Goals

| Column | Type | Description |
|---|---|---|
| `id` | `UUID` | Primary key |
| `user_id` | `UUID` | Owner |
| `title` | `VARCHAR(255)` | Goal name (e.g., "Dream Car") |
| `current_amount` | `DECIMAL(12,2)` | Current saved amount (default 0) |
| `target_amount` | `DECIMAL(12,2)` | Target amount |
| `is_pinned` | `BOOLEAN` | Whether pinned to the home dashboard |
| `created_at` | `TIMESTAMPTZ` | Creation timestamp |

#### `subscriptions` — Recurring Payments

| Column | Type | Description |
|---|---|---|
| `id` | `UUID` | Primary key |
| `user_id` | `UUID` | Owner |
| `name` | `VARCHAR(255)` | Subscription/utility name |
| `amount` | `DECIMAL(12,2)` | Monthly cost |
| `billing_day` | `INTEGER` | Day of month for auto-deduction |
| `source_account` | `VARCHAR(255)` | Account to deduct from |
| `auto_deduct` | `BOOLEAN` | Whether auto-deduction is enabled |
| `type` | `VARCHAR(50)` | `"subscription"` or `"utility"` |
| `created_at` | `TIMESTAMPTZ` | Creation timestamp |

#### `salary_planner` — Budget Allocation

| Column | Type | Description |
|---|---|---|
| `id` | `UUID` | Primary key |
| `user_id` | `UUID` | Owner |
| `category` | `VARCHAR(255)` | Expense category |
| `item_name` | `VARCHAR(255)` | Planned expense name (e.g., "Rent") |
| `amount` | `DECIMAL(12,2)` | Allocated amount |
| `created_at` | `TIMESTAMPTZ` | Creation timestamp |

### 3.3 Creative Use of Supabase User Metadata

Instead of creating additional database tables for user preferences, the app leverages **Supabase Auth User Metadata** (`auth.users.raw_user_meta_data`). This JSONB column is updated via `supabase.auth.updateUser({ data: { ... } })` and read from `session.user.user_metadata`.

**Stored settings:**

| Metadata Key | Type | Default | Purpose |
|---|---|---|---|
| `display_name` | `string` | Email prefix | User's display name |
| `custom_accounts` | `string[]` | `["Bank", "Cash", "eWallet"]` | Custom account list (order preserved) |
| `include_savings` | `boolean` | `true` | Whether savings accounts are included in Total Balance |
| `enable_food_budget` | `boolean` | `false` | Food Budget module toggle |
| `enable_salary_planner` | `boolean` | `false` | Salary Planner module toggle |
| `food_daily_limit` | `number` | `0` | Daily food spending cap (RM) |
| `food_monthly_limit` | `number` | `0` | Monthly food spending cap (RM) |

**Why this pattern?** It eliminates an entire `user_settings` table and the associated CRUD. Metadata is fetched automatically with every session, adding zero extra API calls. Updates are atomic and instant. The trade-off is that this data lives in the auth layer rather than a relational table, but for user-specific preferences this is a clean and performant pattern.

### 3.4 Row Level Security (RLS)

Every table has RLS enabled with a single policy:

```sql
CREATE POLICY "Strict isolation" ON <table>
    FOR ALL USING (auth.uid() = user_id);
```

This means:
- `SELECT` — Users can only read their own rows
- `INSERT` — The `user_id` must match the authenticated user
- `UPDATE` / `DELETE` — Only the row owner can modify or remove their data

As an additional client-side safety layer, the context provider filters all arrays by `user_id` before distributing them to components: `transactions.filter(t => !t.user_id || t.user_id === session?.user?.id)`.

---

## 4. Comprehensive User Manual

### 4.1 Dashboard / Home Page

**File:** `app/page.tsx`

The home screen is your financial command center, showing a snapshot of your current financial state.

#### Greeting & Avatar
A time-based greeting ("Good morning/afternoon/evening") with your display name and an avatar showing your first initial.

#### Total Balance Card
The prominent dark card shows your **Total Balance** — the sum of all active account balances.

**How it works:**
1. Takes your global `accounts` array (e.g., `["Bank (MBB)", "HSBC", "TnG eWallet"]`)
2. If **Include Savings** is OFF, it filters out any account containing "saving" (case-insensitive)
3. For each remaining account, it computes the true balance using double-entry accounting:
   - **Income** to this account → **adds** to balance
   - **Expense** from this account → **subtracts** from balance
   - **Transfer out** (this account is the sender) → **subtracts** from balance
   - **Transfer in** (this account is the receiver) → **adds** to balance
4. Sums all individual account balances for the final number

This means if you transfer RM 500 from "HSBC" to "Savings", and Savings is excluded, HSBC drops by RM 500 and the excluded Savings doesn't contribute — your Total Balance correctly decreases by RM 500.

#### Today & Weekly Insight Cards
Two cards showing aggregated expense totals:

- **Today**: Filters transactions to expenses where the date string (YYYY-MM-DD) matches today's date exactly. Shows "No transactions today!" when empty.
- **Weekly**: Calculates Monday-to-Sunday of the current week using ISO date string comparison and sums all expenses within that range.

Both respect the **Include Savings** toggle — expenses from savings accounts are excluded when the toggle is off. Tapping either card navigates to the full transaction history.

#### Pinned Savings Goals
Goals marked as "pinned" appear here as progress cards with animated progress bars (Framer Motion). Shows current amount, target, and completion percentage. Links to the full Goals page.

#### Spending Trend Chart
A 7-day `LineChart` (Recharts) showing daily expense totals. The X-axis labels dynamically render real weekday names (Mon, Tue, Wed...) using `Intl.DateTimeFormat`, always ending on today. A custom tooltip reveals both expense and income breakdowns per day.

---

### 4.2 Transactions & Transfers

**File:** `components/TransactionModal.tsx`

The floating action button (FAB) in the bottom navigation opens a drag-dismissable bottom sheet for creating transactions.

#### Transaction Types
A segmented control switches between three types:

| Type | Behavior |
|---|---|
| **Expense** | Deducts from the selected account. Requires a category. |
| **Income** | Adds to the selected account. No category needed. |
| **Transfer** | Moves money between two accounts using double-entry accounting. |

#### Double-Entry Transfer Accounting
When you create a Transfer:
- You select a **From Account** and a **To Account** using pill selectors populated from your accounts list
- The amount is **subtracted** from the source account's balance
- The same amount is **added** to the destination account's balance
- The category is automatically set to "Transfer"
- The `to_account` field is saved to the database

This ensures the total across all accounts remains unchanged (money moved, not created/destroyed), but the per-account balances accurately reflect where your money actually is.

#### Additional Fields
- **Currency Selector**: Quick toggle between RM, USD, JPY with live conversion estimates
- **Date Picker**: Native date input, defaults to today
- **Note**: Optional free-text note / sub-category
- **Edit Mode**: Tapping any existing transaction opens the modal pre-filled for editing

---

### 4.3 Analytics & Stats

**File:** `app/analytics/page.tsx`

A comprehensive analytics dashboard with dynamic filtering and interactive charts.

#### Time Filter
Toggle between **Month** (current calendar month), **Year** (current calendar year), and **All** (entire history). A "Viewing: April 2026" indicator confirms the active range. All charts and metrics reactively update based on the selected filter.

#### Account Balance Pills
A horizontally scrollable row of account pills showing the live balance of each account, computed from all transactions (Income + Transfers In − Expenses − Transfers Out). Green for positive balances, red for negative.

#### Spending Category Donut Chart
A `PieChart` with:
- Inner donut showing the total expense amount in the center
- Outside labels showing category names and percentages (`Food (35%)`)
- Color-coded legend below the chart
- Only includes **Expense** type transactions from the filtered date range

#### Stacked Cash Flow Bar Chart
A `BarChart` showing expenses stacked by category over time:
- **Month view**: Grouped by day (`4/10`, `4/11`, etc.)
- **Year/All view**: Grouped by month (`Apr '26`, `May '26`, etc.)
- `interval={0}` forces every X-axis label to render without skipping
- Horizontally scrollable with hidden scrollbar for datasets exceeding the viewport

#### Smart Insights
A contextual insight card with accent-colored styling that changes its text based on the selected time range.

#### Subscriptions & Utilities Manager
Full CRUD management for recurring payments:
- **Add/Edit Modal**: Spring-animated bottom sheet with name, cost, auto-deduct toggle, billing day picker (scrollable 1-28 buttons), and source account selector
- **Auto-deduct indicator**: Shows "Auto-deducts on Day 15 via Bank MBB" beneath each item
- **Monthly totals**: Live sum displayed in the section header

---

### 4.4 Goals & Budgeting Modules

**File:** `app/goals/page.tsx`, `components/FoodBudgetCard.tsx`, `components/SalaryPlanner.tsx`

#### Savings Goals
Create and track savings goals with:
- **Title** and **target amount**
- **Progress bar** animated from 0% to current completion
- **Add Funds**: Inline input to increment the saved amount
- **Pin/Unpin**: Pin goals to show them on the home dashboard
- **Delete**: Confirmation dialog before removal

#### Food Budget Tracker (Toggleable Module)
Enabled via Profile → Modules → Food Budget Tracker. Appears on the Goals page when active.

**How it works:**
- Scans all transactions where `type === "Expense"` AND `category` contains "food" (case-insensitive)
- **Daily tracking**: Sums food expenses where the date matches today → shows remaining vs. daily limit
- **Monthly tracking**: Sums food expenses in the current calendar month → shows remaining vs. monthly limit
- **Visual progress bars**: Green (<80%), amber (80-99%), red (≥100% / over budget)
- Limits are configured in Profile → Modules → Food Budget Tracker (Daily Limit / Monthly Limit inputs)

The daily counter effectively resets every day automatically since it only sums transactions matching today's date.

#### Salary Cashflow Planner (Toggleable Module)
Enabled via Profile → Modules → Salary Planner. Appears on the Goals page when active.

**How it works:**
1. **Add planned expenses**: Category dropdown (from your global categories), item name, and amount
2. **Items table**: Aligned table with Item (left), Category (center), Amount (center), and delete action
3. **Cash Flow Analysis**:
   - **Current Balance**: Your Total Balance (same calculation as the home page)
   - **Total Planned Reserves**: Sum of all planner item amounts
   - **Available Cash Flow** = Current Balance − Total Planned Reserves
   - Highlighted in accent color when positive ("Safe to spend") or red when negative ("Over-allocated")

Data is persisted to the `salary_planner` Supabase table with full CRUD.

---

### 4.5 Profile & Personalization

**File:** `app/profile/page.tsx`

#### User Info
Editable display name with inline edit mode. Shows email address from the Supabase session.

#### Account Defaults
- **Billing Cycle**: Select the monthly reset day (1-31) via a full-screen grid bottom sheet
- **Currency Format**: Toggle between RM, MYR, and $ display formats

#### Personalization
- **Accent Color**: 5 presets (Blue, Emerald, Yellow, Purple, Rose) that dynamically theme all buttons, toggles, charts, and UI elements throughout the app
- **Include Savings in Total**: Toggle that controls whether accounts containing "savings" in their name are included in the Total Balance calculation. Disabled if no savings account exists.
- **Manage Categories**: Modal with drag-to-reorder (Framer Motion `Reorder.Group`), delete, and add new categories. Categories populate the transaction modal and planner dropdowns.
- **Manage Accounts**: Modal with drag-to-reorder, inline rename, delete with confirmation, and add new accounts. Account order is persisted to Supabase user metadata.
- **Dark Mode**: Toggle that adds/removes the `dark` class on `<html>` and persists to `localStorage`
- **Daily Reminders**: Toggle with expandable time picker (scrollable hour/minute/AM-PM wheels)

#### Modules
- **Food Budget Tracker**: Toggle on/off + configure daily and monthly RM limits
- **Salary Planner**: Toggle on/off

#### Data Management
- **View Raw Data**: Full-screen modal with two tabs:
  - **Transactions**: 9-column table mirroring the exact database schema (ID, Date, Type, Category, Sub Category, Amount, Account, To Account, Note)
  - **Subscriptions & Goals**: Combined view of all subscriptions, utilities, and goals
- **Export to CSV**: Downloads all transactions as a CSV file with proper escaping
- **Clear All Data**: Password-verified destructive action that wipes all transaction data. Re-authenticates the user before executing the delete as a security measure.

#### Log Out
Signs out via `supabase.auth.signOut()` and clears the session.

---

## License

This is a private personal project. All rights reserved.
