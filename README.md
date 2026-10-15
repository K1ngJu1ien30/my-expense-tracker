# Expense Tracker Pro

### Native Multi-Currency Financial Engine & Credit Card Architecture — v3.0.0

A production-grade, offline-first personal finance application built with Next.js and compiled to a native Android binary via Capacitor. Engineered with strict integer-cents precision, double-entry accounting integrity separating cash assets from credit liabilities, a complete optional credit-card lifecycle engine, resilient multi-queue offline synchronization, and bank-grade PostgreSQL Row Level Security.

> **Quality Baseline (v3.0.0):**
> - TypeScript Strict: `npx tsc --noEmit` → 0 errors
> - ESLint 9 Flat Config: `npm run lint` → 0 errors / 0 warnings
> - Next.js Static Export: 16/16 pages statically prerendered to `out/`
> - Android Native Compilation: Gradle 8.14.3 / SDK 36 `BUILD SUCCESSFUL`

---

## 1. Tech Stack & Official Versions

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| **Framework** | Next.js (App Router) | `16.2.3` | React 19 server/client components, static export (`output: "export"`) |
| **Runtime UI** | React / React DOM | `19.2.4` | Component tree and hooks |
| **Styling** | Tailwind CSS / PostCSS | `^4.0` | High-density mobile utility styling with CSS custom properties |
| **Native Shell** | Capacitor | `8.3.0` | Native Android bridge (App, Haptics, Preferences, Filesystem, Share, Motion, Network) |
| **Biometrics** | Capacitor Biometric Auth | `^10.0.0` | Native Android Fingerprint / Face ID authentication gate |
| **Database & Auth** | Supabase JS Client | `^2.103.0` | PostgreSQL backend, Row Level Security, real-time auth, hardened RPCs |
| **Local Cache** | LocalForage | `^1.10.0` | IndexedDB persistent local cache with mutex-locked mutation queues |
| **Animations** | Framer Motion | `^12.38.0` | Hardware-accelerated UI transitions and micro-animations |
| **Visualizations** | Recharts | `^3.8.1` | Responsive SVG spending charts and sparklines |
| **Virtualization** | react-virtuoso | `^4.18.6` | Window virtualization for high-volume transaction history lists |
| **Dates** | date-fns | `^4.1.0` | ISO date arithmetic, statement closing cycles, and calendar grouping |
| **Icons** | Lucide React | `^1.8.0` | Lightweight, accessible SVG icon library |

---

## 2. Core Application Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Next.js Frontend                       │
│  (React 19, TypeScript strict, Tailwind v4, Framer Motion) │
└──────────────┬───────────────────────────────▲──────────────┘
               │                               │
       Hydrate │ Mutate                Paints  │ < 200ms
               ▼                               │
┌──────────────────────────────┐       ┌───────┴──────────────┐
│  IndexedDB via LocalForage   │       │  React Context Tree  │
│  - User-scoped cache keys    │       │  (lib/context.tsx    │
│  - offline_tx_queue (mutex)  │       │   domain hooks facade│
│  - offline_statement_queue   │       └──────────────────────┘
└──────────────┬───────────────┘
               │
               │ Background Sync / RPCs
               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Supabase PostgreSQL Backend                 │
│  - Row Level Security (RLS) on all tables                   │
│  - 4 Hardened SECURITY DEFINER RPCs (search_path = public)  │
│  - Row-level concurrency locking (FOR UPDATE)               │
└─────────────────────────────────────────────────────────────┘
```

### A. Offline-First Dual-Layer Architecture

1. **Instant Cold Boot (< 200ms)**: On launch, the application hydrates cached accounts, categories, transactions, and preferences from IndexedDB (scoped by `user_id`) before initiating network requests.
2. **Durable Mutex-Locked Offline Queues**:
   - `offline_tx_queue`: Unsynced transactions are queued locally under a serialized single-flight mutex (`withQueueLock`), preventing race conditions when transactions are logged rapidly.
   - `offline_statement_queue`: Credit card statement creations that encounter network dropouts are captured in a dedicated offline queue and flushed automatically upon reconnection.
3. **Integer Cents Precision**: All financial amounts in storage and context math are stored as integer cents (`Math.round(amount * 100)`). Display formatting divides by 100 at the render boundary, eliminating floating-point rounding errors (e.g. `0.1 + 0.2 = 0.30000000000000004`).
4. **Soft Deletions**: Transactions use a `deleted_at` timestamp rather than physical row deletion, preventing sync conflicts across devices and enabling shake-to-undo recovery.

### B. High-Volume Keyset Pagination

To prevent memory exhaustion and UI degradation when scaling to tens of thousands of transactions, `lib/transactionPagination.ts` implements cursor-based keyset batch loading (`(date, id)` pagination), ensuring smooth scrolling in `react-virtuoso` lists with fixed memory footprints.

---

## 3. Major Modules & Navigation

The application is structured around a 5-tab bottom navigation dock:

### 1. Home (`/`)
- **Main Wallet Card**: Horizontal swipe carousel of active accounts with per-account balances, account kind badges, and native currency indicators.
- **Financial Position Summary**: Transparent breakdown of **Available Cash**, **Savings**, **Net Total**, **Outstanding Credit Card Balance**, and **Net Financial Position**.
- **Multi-Currency Breakdown**: Discretely displays balances per currency (`RM`, `SGD`, `USD`, `JPY`, etc.) with alert banners when unrated foreign currencies are excluded from base totals.
- **Proactive Due Date Banners**: High-priority alerts warning of upcoming statement deadlines (`overdue`, `due_today`, `due_soon`).
- **Spending Trend Sparkline**: Compact 95px area chart tracking daily expenses and income.
- **Today & Weekly KPI Scorecards**: Quick spending metrics versus weekly averages.
- **Split-Bill Widget**: Displays unclaimed reimbursable expenses at a glance.
- **Pinned Savings Goals**: Progress rings toward target milestones.
- **Monthly Recap Auto-Prompt**: Dismissible banner during days 1–7 of each month advertising the previous month's financial recap.

### 2. Stats (`/analytics`)
- **Spending Velocity Meter**: Projects month-end spend by analyzing daily burn rate while automatically excluding fixed commitments (rent, utilities, subscriptions, insurance) to prevent false panic.
- **Category Breakdown**: Interactive donut chart and ranked category spending list.
- **Month-over-Month Comparison**: Visual trajectory of current spending against historical periods.
- **Monthly Thermal Receipt**: Renders financial summaries as a vintage receipt ready for export as a high-resolution 9:16 PNG.
- **Accountant CSV Export Wizard**: Filter by date range, account, and category to produce UTF-8 BOM CSV files for tax or audit review.

### 3. Add Transaction (Center Floating Button)
- **Single Tap**: Opens the modal to record an Expense, Income, or Transfer with integer-cent accuracy, custom date/time, category auto-suggest, note, and claimable split-bill flag.
- **Long Press (450ms)**: Opens the **Quick Add** sheet featuring up to 4 top recurring spending templates derived from your last 30 days of activity for instant one-tap logging.

### 4. Hub (`/hub`)
Central workspace hosting specialized financial modules:
- **Heatmap Calendar (`/calendar`)**: GitHub-style daily spending intensity grid.
- **Financial Planning (`/goals`)**: Pinned savings goals (with celebratory animations), recurring subscriptions, utility bills, food budget, and salary planner.
- **Credit Cards (`/hub/credit-cards`)**: Multi-card credit limits, utilization progress bars (<30% safe, 30–70% moderate, >70% high, ≥100% over-limit), statement cycles, unbilled transactions, atomic repayments, cashback tracking, and finance charge / APR simulation.
- **Asset Vault (`/vault`)**: Physical equipment registry, serial numbers, warranty expirations, and maintenance logs.
- **Claims & Splits (`/hub/claims`)**: Reimbursable company expenses and shared split-bills.
- **Statement Import (`/hub/statement-import`)**: AI-assisted OCR parsing for bank statement PDFs and images.

### 5. Profile (`/profile`)
- **Manage Accounts**: Create, edit, archive, and safely delete accounts with dependency validation.
- **Categories**: Customize category names, colors, and icons.
- **Security & Privacy**: Biometric authentication toggle, 4/6-digit PIN passcode, and app-switcher privacy blur.
- **Appearance**: Light, Dark, and AMOLED Pitch Black themes with custom accent color picker.
- **AI Assistant**: Input personal Google Gemini API key, select model (`gemini-2.0-flash-lite`), and set daily call limits.
- **Data Management**: Export all data, reset local cache, or execute secure account deletion via RPC.

---

## 4. Financial Accounting Principles & Terminology

### A. Terminology & Math Formulas

| Metric | Calculation / Definition |
|---|---|
| **Available Cash** | Operational liquid funds: $\sum(\text{Bank} + \text{Cash} + \text{E-Wallet})$. If user preference *"Include Savings"* is enabled, dedicated $\text{Savings}$ are added. |
| **Savings** | $\sum(\text{Savings Accounts})$. |
| **Outstanding Credit Card Balance** | Current total credit card debt: $\sum \|\text{Credit Card Negative Balances}\|$. |
| **Net Total** | Operational liquid net worth: $\text{Available Cash} - \text{Outstanding Credit Card Balance}$. |
| **Net Financial Position** | Comprehensive net worth: $(\text{Available Cash} + \text{Savings} + \text{Investments} + \text{Credit Assets}) - \text{Liabilities}$. Dedicated savings are **always** included in this figure regardless of user toggles. |
| **Statement Balance** | The total billed amount due on the latest monthly bank statement closing date. |
| **Statement Remaining** | Unpaid balance on an issued statement: $\text{Statement Balance} - \sum(\text{Allocated Repayments})$. |
| **Payment Due** | Required payment by the due date (Minimum Due or Statement Remaining). |
| **Confirmed Cashback** | Cashback officially applied as a statement credit or bank deposit. |
| **Estimated Interest** | Simulated finance charges based on card APR and revolving balances. |

### B. Multi-Currency Handling & Exchange Rates

- **Base Currency**: Defaults to `RM` (MYR), configurable in user preferences.
- **Rate Resolution Hierarchy** (`lib/balance.ts`):
  1. Base currency identity ($1.0$).
  2. Custom user-defined exchange rates.
  3. Live rates fetched from `open.er-api.com/v6/latest/MYR`.
  4. Static baseline exchange rate fallback table (`DEFAULT_EXCHANGE_RATES_TO_MYR`).
- **Mathematical Safety Guard**: If a foreign currency has no verified rate, `isKnown` resolves to `false`. Unrated nominal currency amounts are **excluded from the consolidated base currency total** (returning `0` in `toBase`), preventing mathematical corruption (e.g. adding 1,000,000 JPY nominally as 1,000,000 MYR). Native currency balances remain accurately tracked and displayed in `byCurrency` with a dashboard warning banner.

---

## 5. Credit Card Engine: Concurrency & Reliability

### A. Atomic 4-Preset Repayment Engine

Credit card repayments are executed through the PostgreSQL RPC `record_credit_card_repayment`, which enforces strict concurrency locking and accounting consistency:
1. **Row-Level Concurrency Locking**: Locks destination card and source account rows in `user_accounts` and candidate statement rows in `credit_card_statements` `FOR UPDATE`, preventing race conditions during concurrent submissions.
2. **Live Debt Validation**: Repayment amounts are validated against current live ledger debt; overpayments exceeding current debt (+0.01 tolerance) are rejected.
3. **Idempotency Protection**: The client generates a durable `operationId` UUID persisted across retries in a React ref (`paymentOperationIdRef`). If a network interruption occurs, retrying the submission reuses the original ID, allowing the backend to return the existing record without duplicate deductions.
4. **The 4 Presets**:
   - **Statement Balance**: Pays the billed statement to retain the 100% interest-free grace period without prematurely paying unbilled new purchases.
   - **Minimum Due**: Pays the statutory 5% minimum (floor RM 50.00).
   - **Custom Amount**: Partial repayment applied via FIFO against the oldest unsettled statement.
   - **Full Outstanding**: Clears both statement balance and recent unbilled transactions.

### B. Confirmed Cashback & Offline Statement Queues

- **Confirmed Cashback**: Posted atomically via `post_credit_card_cashback` as a statement credit or bank deposit; unsafe non-atomic 2-step write fallbacks have been eliminated.
- **Offline Statement Queue**: Failed statement creations during network dropouts are enqueued in `offlineStatementQueue` in `lib/offlineQueue.ts` and auto-flushed upon reconnection.

---

## 6. Supabase Security & Database Configuration

### A. Row Level Security & Permissions Hardening

All tables enforce Row Level Security (`ENABLE ROW LEVEL SECURITY`) with policies restricting queries and mutations to `auth.uid() = user_id`.

In migration `012_security_hardening_and_integrity.sql`, execute permissions on all sensitive `SECURITY DEFINER` routines were revoked from `PUBLIC` and `anon` and granted exclusively to `authenticated` and `service_role`:

```sql
REVOKE ALL ON FUNCTION record_credit_card_repayment(UUID, UUID, UUID, NUMERIC, DATE, VARCHAR, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION record_credit_card_repayment(UUID, UUID, UUID, NUMERIC, DATE, VARCHAR, UUID, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION post_credit_card_cashback(UUID, UUID, UUID, VARCHAR, NUMERIC, DATE, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION post_credit_card_cashback(UUID, UUID, UUID, VARCHAR, NUMERIC, DATE, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION check_account_dependencies(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION check_account_dependencies(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION delete_user_account(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION delete_user_account(UUID) TO authenticated, service_role;
```

All functions specify `SET search_path = public, auth` to prevent search-path injection vulnerabilities.

### B. Database Migration State vs. CLI History

> [!NOTE]
> Production database migrations for this repository were applied manually via the **Supabase Dashboard SQL Editor** rather than through the Supabase CLI migration tracker.
> Consequently, querying the Supabase migration API returns no CLI-managed migration history.

**For a clean installation or new environment:**
- Run the single consolidated reference schema: `supabase/schema.sql`.
- Alternatively, apply migrations in sequential order:
  1. `001_add_indexes.sql` — Partial indexes on transactions
  2. `002_accounts_categories_tables.sql` — Base tables, default seeds, and RLS
  3. `003_exclude_from_velocity.sql` — Velocity exclusion column
  4. `004_schema_sync.sql` — Schema synchronization
  5. `005_remove_wanderplan.sql` — Legacy WanderPlan cleanup
  6. `006_financial_accounts_architecture.sql` — Account kinds, currencies, archiving, opening balance
  7. `007_credit_card_architecture.sql` — Credit card attributes and statements table
  8. `008_cashback_rewards.sql` — Cashback rules table and rebate tiers
  9. `009_credit_card_payment_integrity.sql` — Repayments, allocations, composite constraint `uq_credit_card_payments_id_user`
  10. `010_safe_account_deletion_and_integrity.sql` — Dependency checks and safe deletion RPC
  11. `011_cashback_persistence_and_integrity.sql` — Confirmed cashback posting RPC
  12. `012_security_hardening_and_integrity.sql` — Permission hardening, concurrency locking, and live debt checks

---

## 7. Required Environment Variables

Create a `.env.local` file in the project root:

```ini
# Supabase Environment Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### Environment Scope & Build Requirements

- **Local Development**: Used by `npm run dev` to connect to Supabase.
- **Next.js Static Export (`npm run build`)**: Because `output: "export"` statically prerenders pages at build time, `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` **must be present in `.env.local` during the build**. If missing, `lib/supabase.ts` throws an error to prevent building bundles with broken client references.
- **Android Compilation**: Capacitor packages the static export from `out/`. The Supabase URL and Anon Key are baked into the compiled JavaScript bundle during `npm run build`. The Android shell itself requires no native `.env` files.
- **Vercel Deployment**: Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` under **Project Settings → Environment Variables** in the Vercel dashboard.
- **AI Assistant Key**: The Google Gemini API key is **not** an environment variable. It is entered by the user in **Profile → AI Assistant** and stored in local preferences.

---

## 8. Development & Build Instructions

### Prerequisites (Verified Toolchain)

- **Node.js**: `v20.x` or `v22.x` (LTS)
- **Java Development Kit (JDK)**: JDK 17 or JDK 21 (Gradle 8.14.3 compatible)
- **Android Studio**: Ladybug (2024.2) or newer
- **Android SDK Components**:
  - `compileSdkVersion`: **36**
  - `targetSdkVersion`: **36**
  - `minSdkVersion`: **24** (Android 7.0+)
  - Android SDK Build-Tools 36.0.0

### Local Setup (Windows PowerShell)

```powershell
# 1. Clone repository
git clone https://github.com/K1ngJu1ien30/my-expense-tracker.git
cd my-expense-tracker

# 2. Install dependencies
npm ci

# 3. Configure environment
Copy-Item .env.example .env.local
# Edit .env.local with your real Supabase HTTPS URL and anon key

# 4. Start local development server
npm run dev
# Web application available at http://localhost:3000
```

### Static Web Export & Capacitor Sync

```powershell
# 1. Run typecheck and linting
npx tsc --noEmit
npm run lint

# 2. Compile static export
npm run build
# Outputs static HTML, JS, CSS into the `out/` directory

# 3. Copy web assets to native Android project
npx cap copy android
```

### Building the Android Debug APK

```powershell
cd android
.\gradlew.bat assembleDebug

# Output APK location:
# android/app/build/outputs/apk/debug/app-debug.apk
```

### Generating a Signed Release APK

**Option A: Android Studio (Recommended)**
1. Open project in Android Studio: `npx cap open android`.
2. Navigate to **Build → Generate Signed Bundle / APK**.
3. Select **APK**, choose your release keystore, key alias, and password.
4. Select build variant: **release**.
5. Output location: `android/app/release/app-release.apk`.

**Option B: Gradle CLI (with configured signingConfigs)**
```powershell
cd android
.\gradlew.bat assembleRelease
# Output: android/app/build/outputs/apk/release/app-release-unsigned.apk (or signed)
```

---

## 9. Troubleshooting & FAQ

### 1. Build Fails: `Missing NEXT_PUBLIC_SUPABASE_URL`
- **Cause**: Next.js App Router attempts to statically render pages at build time.
- **Fix**: Ensure `.env.local` contains valid HTTPS `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` before running `npm run build`.

### 2. Android WebView Blank Screen or Network Errors
- **Cause**: Insecure HTTP schemes or missing CORS headers.
- **Fix**: Verified Capacitor configuration enforces `androidScheme: 'https'` in `capacitor.config.ts`, ensuring the WebView runs under secure `https://localhost` context.

### 3. Status Bar & Gesture Bar Overlapping UI
- **Cause**: Hardcoded padding failing on devices with display notches or edge-to-edge gesture bars.
- **Fix**: The application uses `SystemBars: { insetsHandling: 'css' }` in `capacitor.config.ts` combined with standard CSS safe-area variables (`env(safe-area-inset-top)` and `env(safe-area-inset-bottom)`).

### 4. Biometric Authentication Does Not Trigger on Emulator
- **Cause**: Android Emulator has no enrolled fingerprint.
- **Fix**: In emulator settings, configure a screen lock PIN and add a virtual fingerprint in **Settings → Security → Fingerprint**.

### 5. Gradle Build Fails with `Unsupported class file major version`
- **Cause**: Java runtime version is incompatible with the Gradle wrapper.
- **Fix**: Ensure `JAVA_HOME` points to JDK 17 or JDK 21.

---

## 10. Security & Privacy Notes

- **Zero Third-Party Financial Trackers**: No third-party analytical SDKs (Google Analytics, Mixpanel, Facebook Pixel) are present.
- **User-Scoped Isolation**: IndexedDB cache keys and Supabase RLS policies are strictly partitioned by `user_id`.
- **Release Hardening**: Remote Chrome DevTools debugging is explicitly disabled on release builds (`webContentsDebuggingEnabled: false` in `capacitor.config.ts`).
- **App-Switcher Privacy Blur**: The application obscures the UI with a privacy overlay when backgrounded, preventing sensitive balances from being captured in the Android app switcher.

---

## 11. Known Limitations

1. **Manual Tracking Model**: The application is a personal financial ledger and tracker. It does **not** connect directly to banking APIs (Open Banking / Plaid) or automatically execute bank wire transfers.
2. **Unrated Foreign Currencies**: Foreign currencies lacking exchange rates in custom settings, live feeds, or the baseline table are excluded from consolidated base currency totals to prevent mathematical distortion. They are tracked and displayed in their native currency in `byCurrency`.
3. **Legacy Database Artifacts**: Empty legacy travel tables (`travel_trips`, `travel_expenses`) and obsolete WanderPlan routines remain in production pending manual verification of 0 rows and 0 dependencies before removal.
4. **CLI Migration Tracking**: Supabase CLI migration history is unpopulated due to dashboard-based SQL application; refer to `supabase/schema.sql` for authoritative database state.

---

## License

Private — all rights reserved.
