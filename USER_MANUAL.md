# User Manual — Tracker V4

Welcome to **Tracker** — your all-in-one expense tracker, asset vault, trading profit tracker, claims manager, and content radar. This guide covers everything you need to know.

---

## Getting Started

### Installation

1. Receive the APK file from the developer
2. Install it on your Android device (enable "Install from Unknown Sources" if prompted)
3. Open the app and create an account with your email and password

**That's it.** You never need to reinstall. Updates happen automatically in the background — no Play Store, no download prompts.

---

## The Offline Promise

This app works with **zero internet connectivity**. Here's what happens:

**When you have no signal:**
- The app opens normally — your data loads instantly from the device cache
- A brief "Loading Tracker..." screen appears while data hydrates (this is intentional — it prevents any zero-balance flashes)
- You can log expenses, and they save to your device immediately
- Your dashboard, balances, and history all include offline entries

**When your signal returns:**
- The app detects reconnection automatically
- All queued expenses upload to the cloud invisibly
- You see: *"3 offline expenses synced to cloud!"*
- The UI refreshes with server-confirmed data

**Bottom line:** Use the app identically whether you have signal or not. Log your coffee in the train tunnel, your lunch in the basement food court. Everything syncs when you surface.

---

## Dashboard

Your home screen shows at a glance:

- **Total Balance** — sum across all accounts (configurable to include/exclude savings)
- **Pending Income** — invoices sent but not yet received
- **Today's Spending** — total expenses since midnight
- **Weekly Spending** — Monday through Sunday
- **Spending Trend** — 7-day line chart
- **Pinned Goals** — savings goals you've pinned for quick visibility

---

## Logging Transactions

### Expense

1. Tap the center **+** button (works from any screen)
2. Enter the amount
3. Pick a category (Food, Transport, Entertainment, etc.)
4. Choose the account (Bank, Cash, eWallet)
5. Optionally toggle "Claimable / Split Bill" for reimbursable expenses
6. Save

### Income

1. Tap **+** → select **Income**
2. Enter the amount and receiving account
3. Optionally mark as **Pending** for unpaid invoices — it won't count toward your balance until cleared

### Transfer

1. Tap **+** → select **Transfer**
2. Enter amount, source account, and destination account
3. The source drops and the destination rises by the same amount

### Multi-Currency

The transaction modal lets you switch between your base currency (RM/MYR/$), USD, and JPY. When logging in a foreign currency, a conversion estimate appears automatically.

---

## History — Dual-Layer Filters

The History tab has **two filter rows** that stack with AND logic:

### Row 1: Time Filters
- **Today** — transactions from today only
- **This Week** — Monday through Sunday
- **Show All** — complete history

### Row 2: Category Filters
A horizontally scrollable row of category pills:
- **All Categories** (default)
- Food, Transport, Entertainment, Shopping, Bills, etc.

**Example:** Selecting "This Week" + "Food" shows only food transactions from this week. The subtitle updates to: *"This Week • Food — 3 transactions"*.

Tap **"Clear All Filters"** to reset both layers.

> All time filters use your device's local timezone — midnight means *your* midnight.

---

## Analytics (Stats)

### Spending Category Breakdown
A donut chart showing expense distribution by category with an interactive legend.

### Cash Flow
A stacked bar chart grouping expenses by category over time, respecting the Month/Year/All filter.

### Income by Account
A green bar chart showing total income grouped by account (Bank, eWallet, etc.) for the selected time period. Useful for tracking dividend income streams like TnG Go+.

### Spending Velocity
Available in the Month view. Shows:
- Your actual cumulative spending (solid line)
- Your projected end-of-month spend (dashed line)
- Daily pace: *"At your current pace of RM 42.50/day, you are projected to spend RM 1,275.00 this month."*

### Subscriptions & Utilities
Track recurring payments with billing day, source account, and auto-deduct configuration.

---

## Savings Goals

1. Tap **+** on the Goals page to create a new goal with a title and target amount
2. Tap **+ Add Funds** to increment progress
3. **Pin** goals to show them on the Dashboard
4. Delete goals when completed

---

## Food Budget Tracker

**Setup:** Profile → Modules → Food Budget Tracker → set daily and monthly limits.

The Food Budget card appears on your Goals page showing:
- **Daily**: Remaining budget, progress bar, spent vs limit
- **Monthly**: Same breakdown for the calendar month

Any transaction categorized as "Food" automatically counts against these limits.

---

## Salary Planner

**Setup:** Profile → Modules → Salary Planner.

Pre-allocate your income to budget categories:
1. Add line items (Rent, Groceries, Savings, etc.) with amounts
2. The planner shows: Current Balance → Total Planned Reserves → **Available Cashflow**

---

## Asset Vault

Track the things you own and understand their true cost over time.

**Setup:** Profile → Modules → Asset Vault.

### Adding an Asset
1. Hub → Asset Vault → tap **+**
2. Pick an emoji icon, enter name, category, purchase date, and price
3. Tap **Add to Vault**

### Understanding Cost Per Day
**Cost / Day** = (Purchase Price + All Maintenance Costs) ÷ Days Since Purchase

A RM 350 pair of headphones owned for 100 days = RM 3.50/day. As time passes, the number drops.

### Maintenance Logs
Track cases, repairs, accessories:
1. Tap an asset to open its detail view
2. Tap **+** in the Maintenance Log section
3. Enter description, cost, and date
4. **True Total** and **Cost / Day** update instantly

---

## Trading / Flipping Tracker

For tracking buy-sell inventory — TCG cards, collectibles, electronics, anything you flip for profit.

**Setup:** Profile → Modules → Trading / Flipping.

### Adding Inventory
1. Hub → Trading → tap **+**
2. Enter item name (e.g. "Charizard VMAX"), buy price, and acquisition date
3. The item appears in **Active Inventory**

### Dashboard Metrics
- **Capital Invested**: Total buy price of all held items
- **Realized Profit**: Sum of (sell price − buy price) for all sold items — green if positive, red if negative
- **Active Inventory**: Count of items you currently hold

### Selling an Item
1. Tap **Mark Sold** next to any active item
2. A modal shows the item name and your buy price
3. Enter the sell price — a **live profit/loss preview** appears
4. Tap **Confirm Sale**
5. The item moves to the **Sold Items** section with the net profit displayed

### Sold Items History
Each sold item shows: buy price → sell price, date sold, and a bold profit/loss amount (green for profit, red for loss).

---

## Radar Tracker

A personal content feed — news, cinema, and streaming alerts.

**Setup:** Profile → Modules → Radar Tracker.

### Adding Sources
Open Radar → tap the ⚙️ gear icon → tap **+**:

- **RSS Feed**: Paste any blog's RSS URL. Optionally add keywords to filter
- **In Cinemas (MY)**: Pulls current Malaysian cinema listings
- **Streaming Drops**: Pick Netflix, Disney+, Amazon Prime, Apple TV+, HBO Go, or all platforms

Use filter pills on the feed to switch between sources.

---

## Claims & Splits

For company lunches, split bills, or any expense you expect to be reimbursed.

**Setup:** Profile → Modules → Claims & Splits.

### Workflow
1. When adding an expense, toggle **"Claimable / Split Bill"** on
2. The expense records normally (balance drops) but is flagged as pending reimbursement
3. Hub → Claims & Splits → find the claim under **Pending**
4. When reimbursed, tap **"Mark as Cleared"**
5. The app auto-generates a matching income entry — balance restores automatically

---

## Billing Cycle

Your billing cycle resets on a configurable day each month:
1. Profile → Billing Cycle → pick day 1–31
2. The Analytics page respects this setting for monthly views and velocity projections

---

## Settings & Security

All accessible from the **Profile** page:

- **Currency Format**: RM / MYR / $ — changes everywhere in the app
- **Dark Mode**: Toggle on/off
- **Accent Color**: Blue, Emerald, Yellow, Purple, or Rose
- **PIN Lock**: Set a 6-digit PIN required on every cold boot
- **Biometric Lock**: Use fingerprint/face instead of PIN (requires PIN enabled first)
- **Manage Categories**: Add, delete, or reorder expense categories (drag to reorder)
- **Manage Accounts**: Add, rename, reorder, or delete accounts
- **Daily Reminders**: Set a reminder time (custom time picker)
- **Include Savings**: Toggle whether savings accounts count toward total balance
- **Export to CSV**: Download all transactions as a spreadsheet
- **View Raw Data**: Inspect transactions, subscriptions, and goals in a database view
- **Clear All Data**: Password-protected nuclear option

---

## Troubleshooting

**App shows "Loading Tracker..." for too long:**
The app is trying to reach the server and falling back to cache. If this is your first-ever launch with no cached data, wait for connectivity and reopen.

**Offline expenses not syncing:**
They sync automatically on reconnection. If they haven't synced, fully close and reopen the app.

**Biometric prompt doesn't appear:**
Ensure biometrics are enrolled in your device's system settings, and that both PIN and Biometric are enabled in Profile → Security.

---

## The Key Thing to Remember

**Use this app exactly the same way whether you have internet or not.** Log expenses in a tunnel, check your stats on a plane, review your trades in a basement. Everything works. Everything syncs. No data is ever lost.

Happy tracking.
