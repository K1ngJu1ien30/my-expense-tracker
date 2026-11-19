# Expense Tracker Pro — User Manual (v3.5.0)

Welcome to **Expense Tracker Pro**. This user manual provides complete documentation of the application's interface, accounting principles, navigation workflows, and financial features.

---

## Important Notice: Manual Financial Ledger

> [!IMPORTANT]
> **Expense Tracker Pro is an offline-first personal financial ledger, not a banking client.**
> - The application does **not** connect to bank APIs (e.g. Open Banking, Plaid) and does **not** initiate or execute real money transfers between bank accounts.
> - When you record an "Expense", "Income", "Transfer", or "Credit Card Repayment", you are recording a bookkeeping ledger entry reflecting real-world actions you have taken with your financial institutions.
> - Projected interest charges, estimated cashback, and statement due alerts are **analytical simulations and reminders** to help you make informed financial decisions. They are not bank-cleared debits until you explicitly record them as transactions.

---

## 1. Application Navigation Architecture

The application interface is anchored by a persistent, touch-friendly bottom dock available across mobile and desktop views:

```
┌────────────────────────────────────────────────────────┐
│  [ Home ]    [ Stats ]    ( + )    [ Hub ]   [ Profile ]│
└────────────────────────────────────────────────────────┘
```

1. **Home (`/`)**: Your financial dashboard. Displays active wallet accounts in a horizontal carousel, Available Cash, Savings, Net Total, Outstanding Credit Card Balance, Net Financial Position, spending trend sparklines, proactive statement due alerts, and daily/weekly KPI scorecards.
2. **Stats (`/analytics`)**: Deep financial analytics, spending velocity projections (excluding fixed bills), category donut breakdowns, month-over-month comparisons, the monthly thermal receipt generator, and the accountant CSV export wizard.
3. **Add Transaction (Center `+` FAB)**:
   - **Tap**: Opens the full transaction modal (Expense, Income, Transfer) with integer-cent accuracy, category auto-suggest, and claimable split-bill toggles.
   - **Press and Hold (450ms)**: Opens the **Quick Add** sheet featuring your top 4 repetitive spending patterns from the last 30 days for one-tap logging.
4. **Hub (`/hub`)**: Central command center for dedicated workspace modules:
   - **Heatmap Calendar (`/calendar`)**: Visual spending intensity grid with date-by-date expense drill-down.
   - **Financial Planning (`/goals`)**: Pinned savings goals, recurring subscriptions, utility bills, food budget, and salary planner.
   - **Credit Cards (`/hub/credit-cards`)**: Multi-card credit limits, utilization meters, statement cycle tracking, unbilled swipes, atomic 4-preset repayments, cashback rewards, and finance charge / APR simulator.
   - **Asset Vault (`/vault`)**: Physical gear registry, serial numbers, warranties, and maintenance logs.
   - **Claims & Splits (`/hub/claims`)**: Reimbursable company claims and shared split-bills.
   - **Statement Import (`/hub/statement-import`)**: AI-powered parsing of PDF and image bank statements.
5. **Profile (`/profile`)**: Account management, custom categories, biometric/PIN security, dark/AMOLED themes, AI Assistant setup (Google Gemini API key), and backup/reset tools.

---

## 2. Financial Accounts & Core Accounting Principles

Expense Tracker Pro maintains strict double-entry accounting integrity across all accounts, separating liquid cash assets from credit liabilities.

### The 5 Account Kinds

When creating or editing an account in **Profile → Manage Accounts**, you designate its kind:
- 🏦 **Bank (`bank`)**: Daily operating bank accounts, checking accounts, and salary deposit accounts.
- 💵 **Cash (`cash`)**: Physical cash in your wallet, purse, or emergency cash box.
- 📱 **E-Wallet (`e_wallet`)**: Digital prepaid stored-value wallets (e.g. Touch 'n Go eWallet, GrabPay, Boost, Apple Cash).
- 🐷 **Savings (`savings`)**: High-yield savings accounts, fixed deposits, or emergency funds.
- 💳 **Credit Card (`credit_card`)**: Revolving credit cards treated strictly as financial liabilities.

### Key Financial Terminology

To avoid ambiguity, the application uses standardized financial terminology throughout the user interface:

| Term | Definition & Formula |
|---|---|
| **Available Cash** | Total liquid operational funds: `Bank + Cash + E-Wallet`. If the user preference *"Include Savings"* is enabled, dedicated `Savings` accounts are also included. |
| **Savings** | Sum of dedicated savings and fixed deposit accounts. |
| **Net Total** | Operational spending power displayed on the main dashboard: `Available Cash - Outstanding Credit Card Balance`. |
| **Net Financial Position** | True comprehensive net worth: `(Available Cash + Savings + Investments + Credit Assets) - Liabilities`. Dedicated savings are **always** included in this figure regardless of the *"Include Savings"* toggle. |
| **Outstanding Credit Card Balance** | Total current debt owed across credit card accounts (negative card balances). |
| **Statement Balance** | The total billed amount due on the latest closed monthly bank statement. |
| **Statement Remaining** | The unpaid portion of an issued statement after subtracting repayments: `Statement Balance - Allocated Repayments`. |
| **Payment Due** | The amount required by the bank on the due date (either the Minimum Due or the full Statement Remaining). |
| **Confirmed Cashback** | Cashback officially credited to your statement or bank account and recorded in your ledger. |
| **Estimated Interest** | Simulated finance charges calculated based on your card's APR and revolving balance. |

---

## 3. Practical Financial Workflows & Examples

### A. Recording Daily Expenses and Income

1. Tap the center **`+`** button in the bottom dock.
2. Select **Expense** or **Income**.
3. Enter the amount (e.g. `24.50`). The app calculates with integer cents (`2450`) to eliminate floating-point rounding errors.
4. Select the **Account** (e.g. *Maybank Current* or *GrabPay*).
5. Choose a **Category** (e.g. *Food & Dining*). As you type a note, the on-device category predictor suggests likely categories cleanly after a brief pause without interrupting typing.
6. Optional: Enter a note (e.g. `"Chicken rice and iced lemon tea"`). Your in-progress amount and note are draft-protected and will never be cleared by background cloud syncing or startup hydration.
7. Tap **Save Transaction**. The entry is saved durably to your device first, closes the form instantaneously, updates your balances immediately, and syncs to Supabase in the background (or stays safely queued if you are offline).

### B. Account Transfers

When moving money between your own accounts (e.g. withdrawing ATM cash from your bank):
1. Tap the **`+`** button and select the **Transfer** tab.
2. Enter the amount: `RM 200.00`.
3. Select **From Account**: *Maybank Current*.
4. Select **To Account**: *Cash Wallet*.
5. Tap **Save Transfer**.
6. **Result**: *Maybank Current* balance decreases by RM 200.00, and *Cash Wallet* increases by RM 200.00. Because this is an internal transfer, your total Available Cash and Net Financial Position remain unchanged, and the transfer is **not** counted as an expense in monthly analytics.

### C. The "Include Savings" Toggle in Action

Consider an individual with:
- Maybank Current (`bank`): RM 5,000.00
- Cash (`cash`): RM 200.00
- Emergency Fund (`savings`): RM 20,000.00
- Maybank 2 Gold (`credit_card`): -RM 1,200.00 (debt)

**Scenario 1: "Include Savings" is OFF (Default — Recommended for Daily Budgeting)**
- **Available Cash**: `RM 5,000 + RM 200 = RM 5,200.00` (liquid operational spending money).
- **Savings**: `RM 20,000.00`.
- **Net Total**: `RM 5,200 - RM 1,200 = RM 4,000.00`.
- **Net Financial Position**: `(RM 5,200 + RM 20,000) - RM 1,200 = RM 24,000.00` (true total net worth).

**Scenario 2: "Include Savings" is ON (In Profile → Preferences)**
- **Available Cash**: `RM 5,000 + RM 200 + RM 20,000 = RM 25,200.00`.
- **Net Total**: `RM 25,200 - RM 1,200 = RM 24,000.00`.
- **Net Financial Position**: `RM 24,000.00`.

---

## 4. Credit Card Lifecycle: Purchases, Statements & Repayments

Credit cards in Expense Tracker Pro are treated as revolving liabilities. Swiping a card increases debt, while repaying it transfers cash to clear the liability.

### A. Credit Card Purchases

When you buy groceries with your credit card:
1. Tap **`+`**, select **Expense**, amount `RM 150.00`.
2. Select Account: *CIMB Cash Rebate* (`credit_card`).
3. Category: *Groceries*.
4. **Immediate Impact**:
   - The card's outstanding debt increases by RM 150.00.
   - The card's visual credit utilization meter updates in real time.
   - Your liquid bank accounts remain untouched (cash is preserved).
   - Your Net Financial Position immediately drops by RM 150.00, reflecting the newly incurred debt obligation.

### B. Statement Generation & Cycles

Every month, banks issue a statement summarizing transactions between the previous statement date and the current closing date.
1. Open **Hub → Credit Cards → [Select Your Card]**.
2. Tap **Add Statement** (or review automatically generated cycle statements).
3. Specify:
   - **Statement Date**: e.g. `2026-10-15` (closing date).
   - **Payment Due Date**: e.g. `2026-11-04` (usually 20 days after closing).
   - **Statement Balance**: e.g. `RM 1,500.00`.
   - **Minimum Due**: Defaults to 5% (`RM 75.00`) or minimum floor (`RM 50.00`).
4. **Statement Remaining**: Billed statements track allocations. If you haven't paid yet, Statement Remaining is `RM 1,500.00`.

### C. The 4 Repayment Presets

When it is time to pay your bill, tap **Pay Bill** on the card overview card or in the Credit Cards Hub. The modal provides 4 distinct presets:

```
┌────────────────────────────────────────────────────────┐
│  (•) 1. Statement Balance    RM 1,500.00  (Recommended)│
│  ( ) 2. Minimum Due          RM 75.00                  │
│  ( ) 3. Custom Amount        [ RM ______ ]             │
│  ( ) 4. Full Outstanding     RM 1,850.00               │
└────────────────────────────────────────────────────────┘
```

#### Preset 1: Statement Balance (RM 1,500.00) — *Recommended*
- **Purpose**: Clears 100% of the issued monthly statement balance.
- **Why use it**: Retains your **100% interest-free grace period**. Any new purchases made *after* the statement closing date (the unbilled RM 350.00) remain in your card debt and will be billed on next month's statement without accruing interest today.

#### Preset 2: Minimum Due (RM 75.00)
- **Purpose**: Pays only the bank's minimum threshold (5% of statement or RM 50).
- **Consequence**: Keeps your credit account in good standing with the bank, but forfeits the interest-free grace period. Interest will begin accruing on the remaining RM 1,425.00 statement balance and all subsequent purchases.

#### Preset 3: Custom Amount (e.g. RM 500.00)
- **Purpose**: Partial repayment when cash is tight.
- **Allocation**: The backend atomically applies the RM 500.00 against the oldest open statement. The statement's remaining balance decreases to `RM 1,000.00`.

#### Preset 4: Full Outstanding Balance (RM 1,850.00)
- **Purpose**: Completely zeroes out the credit card debt, clearing both the RM 1,500.00 statement balance and the RM 350.00 of unbilled purchases made since the closing date. Restores 100% of your credit limit.

### D. Concurrency Locking & Atomic Repayments

When you submit a repayment:
1. You select the source payment account (e.g. *Maybank Current*).
2. The client submits a unique `operationId` UUID.
3. The database executes the atomic PostgreSQL RPC `record_credit_card_repayment`:
   - **Row-Level Locking**: Locks both the source account and card account rows `FOR UPDATE` to serialize concurrent requests.
   - **Debt Validation**: Verifies that the payment amount does not exceed the card's live outstanding debt.
   - **Ledger Transfer**: Deducts RM 1,500.00 from *Maybank Current* and credits RM 1,500.00 to *CIMB Cash Rebate*.
   - **Statement Allocation**: Deducts from the statement remaining balance in `credit_card_payment_allocations` and marks the statement as `is_settled = TRUE`.
4. If a network timeout occurs during submission, tapping **Retry** reuses the identical `operationId`. The server detects the existing record and returns success without double-deducting your cash.

---

## 5. Cashback & Rewards Engine

Expense Tracker Pro includes a configurable rebate calculator tailored to credit card reward programs.

### Configuring Cashback Rules

Navigate to **Hub → Credit Cards → [Select Card] → Rewards & Cashback**:
- Add category rebate percentages (e.g. `5.0%` for *Groceries*, `3.0%` for *Petrol*, `0.5%` for *General*).
- Set a **Monthly Rebate Cap** (e.g. `RM 50.00`).
- Set a **Minimum Spend Floor** (e.g. requires `RM 1,000.00` total card spend during the month before cashback activates).

### Estimated vs. Confirmed Cashback

- **Estimated Cashback**: When you record an expense, the app displays a preview (e.g. `✨ +RM 7.50 Cashback`). This is an analytical estimation and does not alter account balances.
- **Recording Confirmed Cashback**:
  When your bank issues your cashback credit on your monthly statement or deposits it into your account:
  1. Open the card's Cashback modal and tap **Record Confirmed Cashback**.
  2. Select the distribution method:
     - **Card Statement Credit**: Deducts directly from your card's outstanding debt.
     - **Bank Deposit**: Credits the cash to a designated bank account.
  3. Enter the confirmed amount (e.g. `RM 42.50`) and date.
  4. The system executes the atomic RPC `post_credit_card_cashback`, ensuring the cashback is recorded with a distinct `cashback` transaction type so it is **never** miscounted as salary income or consumption expense in your analytics.

---

## 6. Interest & Finance Charge Estimation

Expense Tracker Pro models the standard retail banking annual percentage rate (APR) tiers used in Malaysia and regional markets:
- **Tier 1 (15.0% p.a.)**: Cardholders with consistent prompt repayments over 10–12 consecutive months.
- **Tier 2 (17.0% p.a.)**: Cardholders with prompt repayments in 8–9 months out of 12.
- **Tier 3 (18.0% p.a.)**: Cardholders with irregular payment history.

### How Interest is Estimated

- If you pay **100% of your Statement Balance** on or before the due date, interest is **RM 0.00** (grace period honored).
- If you revolve a balance (e.g. pay only the Minimum Due), finance charges accrue daily:
  $$\text{Daily Interest} = \text{Remaining Balance} \times \left(\frac{\text{APR}}{365}\right)$$
- The **Finance Charge Simulator** in the Credit Cards Hub allows you to simulate the true compounding cost of carrying a balance over 30, 60, or 90 days, encouraging you to prioritize clearing high-interest revolving balances.

---

## 7. Recurring Bills & Forward Commitments

In **Hub → Financial Planning (`/goals`)**, you can schedule forward-looking commitments:
- **Subscriptions**: Fixed recurring costs (e.g. Netflix RM 45/mo, Spotify RM 16.90/mo, iCloud RM 11.90/mo).
- **Utility Bills**: Variable recurring bills (e.g. Electricity, Water, Internet).
- **7-Day Upcoming Alert**: The Home dashboard scans your scheduled subscriptions and utilities and displays an **Upcoming Bills** alert if any bill is due within the next 7 days.
- **Recording Scheduled Bills**: Scheduled bills are forward commitments, not transactions. When you pay a bill, tap **Mark as Paid** to generate a real expense transaction deducting from your specified account.

---

## 8. Spending Velocity & Monthly Analytics

The **Stats (`/analytics`)** page provides objective financial analysis:

### Spending Velocity Meter

The velocity gauge estimates your projected month-end expenditure based on the current burn rate:
$$\text{Projected Spend} = \frac{\text{Month-to-Date Spend}}{\text{Days Elapsed}} \times \text{Days in Month}$$

To keep this projection realistic:
- **Exclusion of Fixed Bills**: Transactions categorized as *Bills, Subscriptions, Utilities, Rent, or Insurance* are automatically excluded from the daily burn rate calculation and added back as a fixed sum at the end. This prevents a large rent payment on Day 1 from triggering false overspending alarms.
- **Manual Velocity Toggle**: On any irregular one-off purchase (e.g. a flight ticket or laptop replacement), you can toggle **"Exclude from Velocity"** in the transaction modal drawer.

### Monthly Recap Receipt

On days 1 through 7 of every month, a dismissible banner appears on Home offering a **Monthly Recap Receipt**:
- Renders a vintage thermal-receipt graphic summarizing total expenses, income, top spending categories, biggest splurge, and savings rate.
- Tap **Share as PNG** to generate a high-resolution 9:16 image ready to share via WhatsApp, Instagram Stories, or save to your device storage.

---

## 9. Offline Operation & Data Synchronization

Expense Tracker Pro was engineered from the ground up for high reliability in low-connectivity environments (such as underground MRT transit or flight travel):

1. **Instant Local-First Startup**: On launch, Expense Tracker Pro loads your cached balances, accounts, and transaction history immediately from device IndexedDB storage so you can start browsing or logging expenses right away while fresh cloud data syncs silently in the background.
2. **Durable Mutation Queues**:
   - If the network is unavailable, transactions are enqueued to `offline_tx_queue`.
   - Failed credit card statement creations are safely captured in `offline_statement_queue`.
   - Both queues operate under strict mutex locks (`withQueueLock`) to prevent race conditions during rapid entry.
3. **Batched Automatic Cloud Sync**: As soon as internet connectivity is restored, the application uploads queued transactions in idempotent batches, isolates any malformed record so valid items still sync, and merges confirmed records directly into your local ledger without stalling the UI.
4. **Visual Status Indicators**: A discreet amber badge notifies you when operating offline (confirming changes are saved locally), and a subtle non-blocking `Syncing…` pill appears briefly while background cloud updates are in flight.

---

## 10. Account Archiving vs. Account Deletion

Expense Tracker Pro provides two distinct methods to manage old or unused accounts:

### Archiving an Account (Recommended)

When you finish a vacation and want to hide a foreign currency travel card (e.g. *Wise JPY Wallet*):
1. Go to **Profile → Manage Accounts**.
2. Tap the account card and toggle **Archive Account**.
3. **Result**: The account is hidden from the Home wallet carousel and transaction entry pickers, but **100% of its historical transactions remain preserved** in your analytics, search, and CSV exports. You can unarchive it at any time.

### Safe Account Deletion (Hard Removal)

If you created a test account and wish to delete it permanently:
1. Go to **Profile → Manage Accounts → [Select Account] → Delete Account**.
2. **Dependency Protection**: The application calls the backend RPC `check_account_dependencies`.
   - If the account has existing transactions, credit card statements, or transfer records, deletion is **blocked**. A dialog displays the exact number of linked transactions and advises you to archive the account instead.
   - If the account has zero dependencies, the backend RPC `delete_user_account` safely purges the account record. Unsafe direct table deletion fallbacks are permanently disabled.

---

## 11. Data Export & Backup

To create an external backup or provide records to your accountant:
1. Navigate to **Stats → Export Data** (or **Profile → Export Data**).
2. Configure your export criteria:
   - **Date Range**: *This Month, Last Month, Year-to-Date, All Time, or Custom Date Range*.
   - **Account Filter**: Export all accounts or isolate a specific credit card or bank wallet.
   - **Category Filter**: Filter by specific expense categories.
3. Tap **Generate CSV**.
4. The application generates a standards-compliant UTF-8 BOM CSV file (compatible with Microsoft Excel, Apple Numbers, and Google Sheets) and summons the native system share sheet (WhatsApp, Gmail, Google Drive, or device filesystem).
