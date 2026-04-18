# User Manual — Tracker V5

Welcome to **Tracker** — your all-in-one expense tracker, multi-currency wallet, asset vault, trading profit tracker, claims manager, and content radar. This guide covers everything you need to know as a user.

---

## Getting Started

### Installation

1. Receive the APK file from the developer
2. Install it on your Android device (enable "Install from Unknown Sources" if prompted)
3. Open the app and create an account with your email and password
4. Set up a PIN and optionally enable fingerprint/face unlock

**That's it.** You never need to reinstall. Updates happen automatically in the background — no Play Store, no download prompts. The next time you open the app after an update, it just works.

### Navigating the Hub

The app has five main tabs at the bottom:

| Tab | What It Does |
|---|---|
| **Dashboard** | Your financial overview — wallet balances, today's spending, weekly trends |
| **History** | Full transaction history with powerful filters |
| **+ (Center)** | Quick-log a new expense, income, or transfer |
| **Analytics** | Charts, breakdowns, spending velocity, subscriptions |
| **Profile** | Settings, modules, security, data management |

Additional modules (Vault, Trading, Radar, Claims) are accessible from the **Hub** page.

---

## Managing Wallets (Multi-Currency)

### Your Wallet Dashboard

The Dashboard shows a **horizontal carousel** of all your active accounts. Each card displays the account name and its current balance. Swipe left/right to see all accounts. Below the carousel, a subtle **Net Total** shows your combined balance across all accounts.

**Tap anywhere on the wallet card** to reveal your actual balances. They auto-hide after 5 seconds for privacy (Zen Mode).

### Adding Accounts

1. Go to **Profile** → **Manage Accounts**
2. Type a name in the text field (e.g., "SGD Savings", "TnG eWallet", "Cash USD")
3. Tap the **+** button

**Currency Detection**: If your account name contains "SGD", "USD", or "JPY", the dashboard automatically displays balances with the correct currency prefix. All other accounts use your base currency (e.g., RM).

### Reordering Accounts

In the Manage Accounts modal, **drag accounts** up and down to set your preferred order. The Dashboard carousel respects this exact order.

### Archiving Accounts

For travel wallets or temporary accounts you no longer use daily:

1. Go to **Profile** → **Manage Accounts**
2. Tap the **Archive** icon (📦) next to any account
3. The account disappears from all dropdowns and the Dashboard carousel
4. Its transaction history is fully preserved
5. To restore it, scroll to the **"Archived"** section at the bottom and tap **Restore**

This is perfect for accounts like "Holiday SGD" that you only need occasionally.

### Setting Your Base Currency

Go to **Profile** → **Base Currency** and choose from: **RM**, **SGD**, **USD**, or **JPY**.

---

## Logging Transactions

### Quick-Log (3 seconds)

1. Tap the center **+** button from any screen
2. Enter the amount
3. Pick a category and account
4. Tap **Save**

### Expense

Select **Expense** → enter amount → choose category (Food, Transport, etc.) → choose account → optionally toggle **"Claimable / Split Bill"** for reimbursable expenses → Save.

### Income

Select **Income** → enter amount → choose receiving account → optionally mark as **Pending** (won't count toward balance until cleared) → Save.

### Transfer

Select **Transfer** → enter amount → choose source and destination accounts. The source drops and destination rises by the same amount.

### Multi-Currency Logging

The transaction modal shows currency toggle buttons: **RM, SGD, USD, JPY**. When logging in a foreign currency, a live conversion estimate appears automatically using cached exchange rates.

---

## Exporting Data — Accountant Export

Generate professional CSV reports to share with your accountant, spouse, or for your own records.

1. Go to **Profile** → **Accountant Export**
2. Choose **Current Month** or **All Time**
3. The app generates a CSV file and opens your device's **share sheet**
4. Send via **WhatsApp**, **Email**, **Google Drive**, or save to device

The CSV includes: Date, Type, Category, Sub-Category, Amount, Account, To Account, Note, Status.

---

## History — Dual-Layer Filters

The History tab has **two filter rows** that stack with AND logic:

### Row 1: Time Filters
- **Today** — transactions from today only
- **This Week** — Monday through Sunday
- **Show All** — complete history

### Row 2: Category Filters
Horizontally scrollable pills: All Categories, Food, Transport, Entertainment, Shopping, Bills, etc.

**Example:** Selecting "This Week" + "Food" shows only food transactions from this week. The subtitle updates: *"This Week • Food — 3 transactions"*.

Tap **"Clear All Filters"** to reset both layers.

---

## Offline Mode — The Promise

**Use this app identically whether you have internet or not.**

- Open the app in Airplane Mode — your data loads instantly from device cache
- Log expenses normally — they save to your device immediately
- When signal returns, everything syncs automatically
- Toast confirms: *"3 offline expenses synced to cloud!"*

Log your coffee in the train tunnel. Check your stats on a plane. No data is ever lost. No sync button to press.

---

## Hidden Features

### Zen Mode (Tap-to-Reveal Balance)

By default, your wallet balances are hidden behind `•••••` dots for privacy. **Tap the wallet card** to reveal all balances for 5 seconds, then they auto-hide again. Perfect for checking your balance in public without leaving it on screen.

### AMOLED Pitch Black Theme

For OLED screens that physically turn off black pixels to save battery:

1. **Profile** → Enable **Dark Mode** first
2. Then toggle **AMOLED Black**
3. Every background becomes pure `#000000` — pixels literally turn off

> Disabling Dark Mode automatically disables AMOLED mode too.

### God Mode

Tap your avatar in the top-right corner of the Dashboard **7 times within 3 seconds**. A matrix-green flash confirms activation. All savings goals show as complete, and balances display as `99,999,999.00`. Tap 7 times again to deactivate. Persists across sessions.

### The Derry Easter Egg 🎈

Log a transaction with an amount of exactly **6.66** or include the word **"pennywise"** in the note field. We won't spoil what happens — but you might want to make sure your volume is off and your screen is facing you.

---

## Settings & Security

All accessible from the **Profile** page:

| Setting | Description |
|---|---|
| **Base Currency** | RM / SGD / USD / JPY — changes everywhere |
| **Billing Cycle** | Day 1–31 — analytics monthly view respects this |
| **Dark Mode** | Toggle dark theme |
| **AMOLED Black** | Pure black for OLED screens (requires Dark Mode) |
| **Accent Color** | Blue, Emerald, Yellow, Purple, or Rose |
| **PIN Lock** | 6-digit PIN on every cold boot |
| **Biometrics** | Fingerprint/Face unlock (requires PIN first) |
| **Manage Categories** | Add, delete, drag-to-reorder expense categories |
| **Manage Accounts** | Add, rename, reorder, archive, or delete accounts |
| **Include Savings** | Toggle whether savings accounts count toward total balance |
| **Daily Reminders** | Set a custom reminder time |
| **Accountant Export** | Generate and share CSV reports |
| **View Raw Data** | Inspect your database in a table view |
| **Clear All Data** | Password-protected wipe (irreversible) |

### Modules (Enable/Disable in Profile)

- Food Budget Tracker
- Salary Planner
- Asset Vault
- Radar Tracker
- Claims & Splits
- Trading / Flipping

---

## Troubleshooting

**App shows "Loading Tracker..." for too long:**
The app is trying to reach the server and falling back to cache. If this is your first-ever launch with no cached data, wait for connectivity and reopen.

**Offline expenses not syncing:**
They sync automatically on reconnection. If they haven't synced, fully close and reopen the app.

**Biometric prompt doesn't appear:**
Ensure biometrics are enrolled in your device's system settings, and that both PIN and Biometric are enabled in Profile → Security.

**An account disappeared from the dropdown:**
It may have been archived. Go to Profile → Manage Accounts → scroll to the "Archived" section → tap Restore.

**Balance shows wrong amount:**
Ensure all pending income is accounted for (shown as amber "Pending" badge on Dashboard). Check that "Include Savings" is toggled correctly in Profile.

---

Happy tracking. 🚀
