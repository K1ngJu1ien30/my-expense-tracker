# Expense Tracker Pro — User Manual

Welcome. This guide walks you through every feature of the app, from first launch to power-user tricks. No jargon, no fluff.

---

## 1. Getting Started

### Installing the App
1. Download the `app-release.apk` file (shared with you via WhatsApp or Drive).
2. On your Android phone, tap the file. You may need to allow "Install from unknown sources" for your browser or file manager — this is a one-time prompt.
3. Tap **Install**. The app will appear on your home screen as **Expense Tracker**.

### Creating Your Account
1. Open the app. You'll land on the sign-in screen.
2. Tap **Sign Up**, enter your email and a password, and confirm.
3. Check your inbox for the verification email, tap the link, then return to the app and sign in.

### The Biometric Lock
After your first successful sign-in, the app will ask permission to use your fingerprint or face unlock. Approve this — from now on, every time you open the app, a quick biometric check is all that stands between you and your dashboard. If biometrics fail, you'll be sent back to the password screen.

### Navigating the Hub
The **Hub** is your home screen. At a glance, you'll see:
- **Your total balance** at the top (tap it to hide/show — see Zen Mode below)
- **Wallet carousel** — a horizontal scroll of every account you own, each showing its own currency and balance
- **Today** and **This Week** spending cards
- **Trend chart** — a 7-day visualization of your cash flow
- **Upcoming** — subscriptions or utilities billing in the next few days

Use the bottom navigation to jump between Hub, Stats, Planning, Vault, and Profile.

---

## 2. Managing Wallets (Multi-Currency)

The app is built around the idea that your RM account and your USD travel card are *different things*. They never get averaged or auto-converted.

### Adding a New Account
1. Go to **Profile → Manage Accounts**.
2. Tap **+ Add Account**.
3. Enter a name (e.g., "Maybank", "DBS SGD", "Japan Cash").
4. **Select its currency** using the four pills: **RM**, **SGD**, **USD**, or **JPY**.
5. Tap **Save**.

The account now appears in the Hub carousel with its currency prefix (e.g., `SGD 1,240.00`).

### How the Hub Separates Balances
The Hub carousel shows one card per account. Each card:
- Displays only that account's currency
- Sums only transactions tagged to that account
- Updates instantly when you log a new transaction

There is **no mixed total** across currencies — the "total balance" at the top sums only your primary-currency (RM) accounts by default.

### Archiving Accounts
Going on a trip to Japan and don't want your JPY wallet cluttering the daily view? Archive it.

1. Go to **Profile → Manage Accounts**.
2. Tap the account you want to hide.
3. Tap **Archive**.

The account disappears from the Hub and from transaction dropdowns — but all its history is preserved. To bring it back, scroll to the **Archived** section at the bottom of the Manage Accounts screen and tap **Restore**.

---

## 3. Financial Planning

The **Planning** tab (bottom nav) is your long-term financial command center. It houses three modules under one roof:

### Savings Goals
Set aside money toward named targets (e.g., "New Laptop", "Emergency Fund"). Each goal shows a progress ring, target amount, and current saved total. Tap **+ Add Goal** to create one.

### Subscriptions
Track recurring monthly charges like Spotify, Netflix, YouTube Premium. For each:
- Name, amount, and icon
- Billing day of the month
- Source account
- **Auto-deduct toggle** — when on, the subscription appears in the Hub's "Upcoming" widget for the days leading up to its billing date

### Utilities
Same structure as subscriptions, but for bills that *vary* month-to-month (electricity, water, internet). Log the amount when the bill arrives; the app tracks your historical averages.

### Why They're Here Together
Goals, subscriptions, and utilities are all *forward-looking* commitments. Grouping them separates "planning your future money" from "analyzing your past spending" (which lives in Stats).

---

## 4. Exporting Data

When tax season rolls around — or your accountant asks for numbers — use the export wizard.

### Accountant Export Wizard
1. Go to **Stats → Export** (or **Profile → Export Data**).
2. Choose your date range (e.g., "Last 3 months", "Year to date", or a custom range via the date picker).
3. Optionally filter by **account** or **category**.
4. Tap **Generate CSV**.

The app will:
1. Write a UTF-8 encoded CSV file to your device's app storage
2. Open the native Android share sheet

### Sharing the CSV
From the share sheet, pick your target:
- **WhatsApp** — send directly to your accountant's chat
- **Gmail / Outlook** — attach to a new email
- **Drive / OneDrive** — upload to cloud
- **Files** — save locally

The CSV opens cleanly in Excel, Google Sheets, or Numbers with columns for date, account, category, note, amount, and currency.

---

## 5. Hidden Features

### Zen Mode (Balance Hiding)
Feeling self-conscious about flashing your balance in public? Tap the large balance number at the top of the Hub. It blurs instantly. Tap again to reveal. The setting persists across launches.

### AMOLED Pitch Black Theme
If you have an OLED screen (most flagship Android phones do), switching to true-black pixels saves battery and looks stunning.

1. Go to **Profile → Appearance**.
2. Ensure **Dark Mode** is enabled.
3. Toggle **AMOLED Pitch Black**.

The entire app shifts from dark gray to `#000000`, letting your OLED pixels switch off entirely. Note: this toggle auto-disables itself if you turn Dark Mode off — it only works in conjunction with dark mode.

### The Derry Easter Egg
Some things are best discovered. If you ever log a transaction with the amount `6.66` or write `pennywise` in the note field… you'll know.

---

## 6. Tips for Daily Use

- **Swipe right** on the Hub to quickly reach any account's full transaction list.
- **Long-press** a transaction to edit it; swipe left to soft-delete (recoverable for 30 days).
- **Pull to refresh** on any page to force a Supabase sync.
- The app works **fully offline**. Log transactions on a plane; they'll sync when you land.

---

## Need Help?

If something breaks, your data is safe — it's stored both locally on your device and in the cloud. A fresh reinstall with the same login will restore everything. For bugs or feedback, message the developer directly.
