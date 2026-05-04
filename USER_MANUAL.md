# Expense Tracker Pro — User Manual

Welcome. This guide walks you through every feature of the app, from first launch to power-user tricks. No jargon, no fluff.

> **What's new in v1.1.6 (May 2026):** Big quality-of-life release. (1) **Spending Velocity** no longer counts your fixed bills on salary day, so the end-of-month projection finally matches reality. It auto-ignores transactions tagged Bills, Subs, Utilities, Savings, or Transfer; a compact per-transaction toggle (behind "More" in the add modal) lets you override either direction. (2) **Log-transaction modal is ~40% shorter** — horizontal-scroll category/account rows, a collapsed currency picker, and tighter spacing. Categories follow your Settings order exactly. (3) Fixed a bug where the **Claimable/Split** toggle could silently stay ON between sessions. (4) Fixed scroll rows touching the screen edges on Expense / Income / Transfer. (5) **Weather theming** now layers on top of time-of-day instead of replacing it — 3 AM rain still looks like 3 AM night with a rain veil, not generic "rain mode".

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

If you're feeling extra brave, there's a hidden **Friday the 13th Mode** — press and hold the **"Personality & Fun"** heading in Profile for about a second to reveal it. Once enabled, on any Friday the 13th at 13:13 local time the horror sequence triggers on its own. Fires at most once per day. Hidden by default so nobody can flip it on your phone while borrowing it.

**To hide it again:** turn the Friday the 13th toggle OFF first, then long-press the same "Personality & Fun" heading a second time. The option tucks itself away.

### The Animal Menagerie
The app reacts to unusual money moves with themed animations:
- 🐋 **Whale** — any expense ≥ RM 5,000
- 🐧 **Penguin** — any expense < RM 10 between 1 AM and 5 AM ("Late-Night Snack Detected")
- 🐉 **Dragon** — the moment a Savings Goal crosses 100%
- 🔥 **Phoenix** — rises when you shake your phone to undo a just-deleted transaction
- 🦈 **Shark** — swims across on every successful undo

### Time-Based Greetings
If you open the app between 02:00–05:00 you'll get a 🦉 instead of "Good morning." Burning the midnight oil at 23:00–02:00 gets you a 🌙. Want the classic "Good morning / afternoon / evening" every time? Turn it off under **Profile → Personality & Fun → Time-Based Greetings**.

Independent of the greeting text, the home screen carries a **bold color gradient** that shifts gently across the day — warm orange at dawn, sky blue at noon, rose at dusk, deep indigo at night. This runs regardless of the greetings toggle (it's background mood, not a loud theme change). Respects your dark-mode setting.

### Weather-Aware Theming (opt-in)
Want the dashboard to react to what it's actually doing outside? Go to **Profile → Personalization → Weather Locations** and type in a primary city (e.g. "Kuala Lumpur") and optionally a secondary city. The app will:

- Show a **weather chip** on the Home greeting with current temperature and a 3-letter city code
- Decorate the gradient with weather-specific overlays: 🌧️ rain goes cooler/darker, ❄️ snow whitens, ⛈️ thunderstorms pump up the contrast, 🌫️ fog mutes everything
- Refresh quietly every hour while the app is open

**Privacy note:** we never ask for GPS permission. Cities are resolved on-device via Open-Meteo's free API; coordinates are cached forever so repeated lookups are instant. If you leave the location blank, weather theming is simply off.

### Broke & Rich Moods
- If your Net Total dips below zero, the number **subtly glitches** — a gentle reminder. It stops the moment you're back in the black.
- If your Net Total ever exceeds RM 1,000,000, the number gains a **soft gold shimmer**. Yes, we know you made it.

### Konami God Mode (Desktop only)
On desktop PWA builds, press **↑ ↑ ↓ ↓ ← → ← → B A** on the keyboard. On mobile, tap the avatar on the Hub 7 times in 3 seconds. Either way, god mode activates and your Hub transforms into a fake-rich fantasy across the UI. Re-enter the sequence to disable.

---

## 6. Power Features (v1.1+)

### 🔍 Power Search (History page)
The search bar in **History** understands more than plain text. Combine any of these with a space between them — they AND together:

| What you type | What it does |
|---|---|
| `coffee` | Matches "coffee" anywhere in your notes, categories, or accounts |
| `"morning coffee"` | Quoted phrase — matched as a single exact token |
| `#food` | Category filter — only show Food-tagged transactions |
| `@bank` | Account filter — only show transactions in an account named "Bank…" |
| `>50` | Amount greater than 50 |
| `<100` | Amount less than 100 |
| `100-500` | Amount between 100 and 500 (inclusive) |
| `today`, `yesterday` | Single-day window |
| `last week`, `this month`, `last month` | Calendar-relative windows |
| `april 2026`, `2025` | Specific month or year |

**Example:** `#food @bank >50 last week` → Food expenses above RM 50, paid from a "Bank"-labelled account, in the last 7 days.

Unknown tokens just become free-text — don't worry about getting the syntax perfect. The chips under the search bar show exactly what the app understood.

### 👆 Swipe-to-Edit/Delete (History)
Slide any transaction row **to the left** to reveal Edit (blue) and Delete (red) buttons. Let go and it snaps shut; slide past the halfway mark and it stays open until you tap away. Tapping Delete goes through the usual confirmation step — nothing destructive happens by accident.

Prefer buttons? They still appear when you hover or keyboard-focus a row.

### ⚡ Quick Templates (Long-press FAB)
Press and **hold** the `+` button at the bottom of the screen for about half a second. A small card pops up with up to 4 of your most-repeated expenses from the last 30 days — tap one to instantly log a transaction with that amount, category, account, and note. No modal, no typing.

If you don't see any templates, log a few expenses first — the feature auto-learns from repetition and needs at least 2 occurrences of a similar purchase to surface it.

### 🧠 Category Auto-Suggest
As you type the Note field in the transaction modal, the app watches for patterns from your history. If what you're writing looks like something you've always tagged as "Food", a little **✨ Looks like Food?** pill appears above the category picker. Tap it to accept; tap the × to dismiss it for this note only. The app never picks a category behind your back.

The first 5 transactions you save don't trigger suggestions (cold-start protection). After that, it learns with every save and gets better over time.

### 💰 Split-Bill Widget
If you enable **Claims & Splits** in Profile, any expense you mark as claimable shows up on an amber card on your Home screen:

> **Unclaimed** RM 240.00
> 5 expenses · 3 payees
> **Review →**

Tap it to jump straight to the Claims tracker. The "payees" count is inferred from your note text — if you write "Dinner with Alex" as the note, Alex becomes a payee.

### 🧾 Monthly Recap Receipt
On the **1st through 7th** of each month, your Home screen shows a small "Your monthly receipt is ready" card. Tap it to see last month's recap rendered as an old-school thermal receipt — category breakdown, net saved, top splurge, quiet-day streak, vs-last-month delta, all the stats.

The **Share as PNG** button on the receipt hands it off to WhatsApp, Instagram stories, Gmail, or anything else on your share sheet. It's a perfect 2× retina PNG that fits an Instagram story at 9:16.

You can also generate a receipt manually any time:
1. Open **Stats**
2. Scroll to the two receipt cards: **This Month** (mid-month snapshot) or **Last Month**
3. Tap either to open the receipt viewer

---

## 7. Tips for Daily Use

- **Long-press** the + FAB for instant one-tap repeats of your most common expenses
- **Swipe left** on any row in History to edit or delete without tapping the card first
- **Shake your phone** after deleting a transaction to undo — the 🦈 shark confirms it worked
- **Tap the big balance** on the Hub to reveal/hide it (Zen Mode); it auto-hides again after 5 seconds
- **Hold the + FAB** to skip the form when you're just logging "the usual"
- The app works **fully offline**. Log transactions on a plane; they'll sync when you land.

---

## Need Help?

If something breaks, your data is safe — it's stored both locally on your device and in the cloud. A fresh reinstall with the same login will restore everything. For bugs or feedback, message the developer directly.
