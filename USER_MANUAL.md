# User Manual — Tracker App

Welcome to **Tracker** — your personal expense tracker, claims manager, asset vault, and content radar, built as a native Android app with full offline support.

---

## Getting Started

### Installation

1. Install the APK on your Android device (one-time only).
2. Open the app and create an account with your email and password.
3. You're ready to go.

> **Updates are automatic.** After this one-time install, the app updates itself silently in the background. You will never need to visit the Play Store or reinstall the APK. Just use the app — new features and fixes appear on their own.

---

## The Offline Promise

This app was built for people on the move. Train tunnels, basement food courts, underground parking, airplane mode — **none of it matters**. Here's what happens:

### When You Have No Signal

- The app opens normally using cached data from your last session.
- A brief "Loading Tracker..." screen appears while your data loads from the device — this is intentional and prevents any zero-balance flashes.
- You can log expenses, and they save instantly to your device.
- You'll see: *"No connection. Expense saved offline."*
- Your dashboard, balances, and history all include these offline entries.

### When Your Signal Returns

- The app detects the reconnection automatically.
- All queued expenses upload to the cloud in the background.
- You'll see: *"3 offline expenses synced to cloud!"*
- The UI refreshes with confirmed data from the server.

**You never need to press a sync button.** It's completely invisible.

---

## Core Features

### Dashboard

Your home screen shows:
- **Total Balance** — across all your accounts
- **Today's Spending** — what you've spent since midnight
- **This Week** — Monday through Sunday totals
- **Spending Trend** — a visual chart of your recent activity

### Logging an Expense

1. Tap the **+** button in the center of the bottom navigation (works from any screen).
2. Enter the amount.
3. Pick a category (Food, Transport, Entertainment, etc.).
4. Choose the account (Bank, Cash, eWallet).
5. Tap **Save**.

That's it — three seconds. The dashboard updates instantly.

### Transfers Between Accounts

1. Tap **+** → select **Transfer** as the type.
2. Enter the amount, source account, and destination account.
3. Save. The source balance drops and the destination rises by the same amount.

### Income

1. Tap **+** → select **Income**.
2. Enter the amount and which account received it.
3. Optionally mark as **Pending** for invoices you've sent but haven't been paid yet.

---

## Stats & History

### Spending Velocity (Stats Page)

When viewing the **Month** filter on the Stats page, you'll see a **Spending Velocity** chart:

- **Solid line** = your actual cumulative spending this month.
- **Dashed line** = where you're headed at your current pace.

Above the chart: *"At your current pace of RM 42.50/day, you are projected to spend RM 1,275.00 this month."*

This recalculates every time you add an expense.

### History Filters

The History page has three filter buttons:
- **Today** — transactions from today only.
- **This Week** — Monday through Sunday.
- **Show All** — your complete history.

> All time filters use your device's local timezone.

---

## Claims & Split Bills

For company lunches, split bills, or any expense you expect to be reimbursed.

### Setup

Profile → Modules → turn on **Claims & Splits**. It appears in the Hub.

### Marking an Expense as Claimable

When adding an expense, toggle **"Claimable / Split Bill"** on before saving. The expense records normally (balance drops), but it's flagged as pending reimbursement.

### Getting Reimbursed

1. Hub → Claims & Splits → find the claim under **Pending**.
2. Tap **"Mark as Cleared"**.
3. The app automatically creates a matching income entry, restoring your balance by exactly the right amount.

You never need to manually add a reimbursement income entry — the accounting is automatic.

---

## Asset Vault

Track the things you own and understand their true cost over time.

### Setup

Profile → Modules → turn on **Asset Vault**. It appears in the Hub.

### Adding an Asset

1. Hub → Asset Vault → tap **+**.
2. Pick an emoji (📱 💻 🎧 👟).
3. Enter name, category, purchase date, and price.
4. Save.

### Cost Per Day

The vault calculates: **Cost / Day = Total Investment ÷ Days Since Purchase**

A RM 350 pair of headphones owned for 100 days = RM 3.50/day. The longer you keep it, the lower the number — proof that quality purchases pay for themselves.

### Maintenance Logs

Real ownership costs more than the sticker price. Track cases, screen protectors, repairs:

1. Tap an asset to open its detail view.
2. In Maintenance Log, tap **+**.
3. Enter description, cost, and date.
4. The **True Total** and **Cost / Day** update instantly:

> **True Total** = Purchase Price + All Maintenance Costs

---

## Radar Tracker

A personal content feed — news, cinema, and streaming alerts in one place.

### Setup

Profile → Modules → turn on **Radar Tracker**. It appears in the Hub.

### Adding Sources

Open Radar → tap the ⚙️ gear icon → tap **+**:

- **RSS Feed** — paste any blog's RSS URL (e.g., `https://www.theverge.com/rss/index.xml`). Optionally add keywords to filter.
- **In Cinemas (MY)** — pulls current Malaysian cinema listings automatically.
- **Streaming Drops** — pick Netflix, Disney+, Amazon Prime, Apple TV+, HBO Go, or all platforms.

Use the filter pills on the feed to switch between sources.

---

## Food Budget

Track daily and monthly food spending against limits you set.

### Setup

Profile → Modules → turn on **Food Budget**. Set your daily and monthly limits.

The Food Budget card appears on your Goals page, showing real-time progress against your limits.

---

## Salary Planner

Pre-allocate your income to budget categories before you spend it.

### Setup

Profile → Modules → turn on **Salary Planner**. It appears on your Goals page.

Add line items (Rent, Groceries, Savings, etc.) with amounts. The planner shows how much of your income is allocated vs. remaining.

---

## Settings & Security

All accessible from the **Profile** page (bottom-right tab):

- **Dark Mode** — toggle on/off.
- **Accent Color** — Blue, Emerald, Yellow, Purple, or Rose.
- **PIN Lock** — set a 6-digit PIN that's required every time you open the app.
- **Biometric Lock** — use your fingerprint instead of (or in addition to) PIN.
- **Export to CSV** — download all transactions as a spreadsheet.
- **Account Management** — add, rename, reorder, or delete accounts (Bank, Cash, eWallet, etc.).
- **Categories** — add or remove expense categories.

---

## Troubleshooting

**App shows "Loading Tracker..." for too long:**
This means the app is trying to reach the server and falling back to cache. If you have no cached data yet (first-ever launch with no network), wait for connectivity and reopen.

**Offline expenses not syncing:**
They sync automatically when the network reconnects. If they haven't synced after reconnecting, fully close and reopen the app.

**Balance seems wrong after syncing:**
After sync, the app does a full data refresh from the server. If the numbers still look off, pull down to refresh or close and reopen.

---

## The Key Thing to Remember

**Use this app exactly the same way whether you have internet or not.** Log your expenses in a tunnel, review your stats on a plane, check your claims in a basement. Everything works. Everything syncs. No data is ever lost.

Happy tracking.
