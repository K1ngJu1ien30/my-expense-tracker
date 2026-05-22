# Expense Tracker Pro — User Manual

Welcome. This guide walks you through every feature of the app, from first launch to power-user tricks. No jargon, no fluff.

> **What's new in v1.8.0 (May 2026):** **AI Assistant** — a new tile in the Hub powered by Google Gemini that has read access to all your data (transactions, goals, assets, trades, trips, subscriptions, pantry). Ask anything: *"how am I doing this month?"*, *"which subscription should I cancel first?"*, *"plan a budget trip to Penang in July"*. Free tier (50 calls/day) by default. Plus: **AI-powered greetings** on the Home screen replace the old "Good morning" + insights card with one cohesive AI line that doubles as a smart insight ("📉 Down 70% this week — killing it!"). **CookMate is now fully AI-driven** — recipes are generated to your taste preferences, no more 24-recipe pool. **History page** now groups transactions under date headers (Today / Yesterday / etc). **Removed for focus:** Slack Arcade (11 games), Weather Theming, Daily Reminders, Billing Cycle Day, MealDB. The app feels *lighter* now.
>
> **What's new in v1.7.1 (May 2026):** WanderPlan audit + polish: fullscreen map bug fixed (was stuck on Android), trip editing, activity editing, trip summary copy-to-clipboard, currency converter widget on budget page, day-by-day spending breakdown, documents now use custom date picker. CookMate's bottom nav redesigned to match the app's native nav bar exactly (Lucide icons, rounded-t-3xl, fixed positioning).
>
> **What's new in v1.7.0 (May 2026):** **CookMate Smart Kitchen** — recipe discovery, Gemini AI cooking assistant, ingredient pantry with expiry tracking, shopping list, and cooking history. Enable in Profile → Modules (on by default). *(Recipe pool was overhauled to AI-only in v1.8.)*
>
> **What's new in v1.5.0 (May 2026):** Massive new module — **WanderPlan Travel Planner**. Enable in Profile → Modules. Plan trips with itineraries, interactive maps (Leaflet + fullscreen mode), per-category budget tracking with expense-to-main-tracker bridge, saved places with Nominatim geocoding, travel document vault, packing checklists with templates, daily spending meter, and trip countdown widgets.
>
> **What's new in v1.4.1 (May 2026 — hotfix):** Two quick polish fixes on top of v1.4 — (1) **History rows are ~40% shorter** so you see more transactions per screen without scrolling. (2) **Transaction modal no longer randomly pops up the keyboard on the wrong field** — it now does nothing on open so you tap what you want to edit; predictable every time.
>
> **What's new in v1.4 (May 2026):** Big quality-of-life release. (1) **Spending Velocity** no longer counts your fixed bills on salary day, so the end-of-month projection finally matches reality. It auto-ignores transactions tagged Bills, Subs, Utilities, Savings, or Transfer; a compact per-transaction toggle (behind "More" in the add modal) lets you override either direction. (2) **Log-transaction modal is ~40% shorter** — horizontal-scroll category/account rows, a collapsed currency picker, and tighter spacing. Categories follow your Settings order exactly. (3) Fixed a bug where the **Claimable/Split** toggle could silently stay ON between sessions. (4) Fixed scroll rows touching the screen edges on Expense / Income / Transfer. (5) **Weather theming** now layers on top of time-of-day instead of replacing it — 3 AM rain still looks like 3 AM night with a rain veil, not generic "rain mode".

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

### Time-Based Greetings + AI Greetings
The Home screen greeting is now AI-generated from your real spending data when you have a Gemini key set up — *"📉 Down 70% this week — killing it!"* or *"🌙 Day 21, RM 132 spent this month, sleep tight"*. It refreshes on every cold app open (or when you've been away for 5+ minutes), and auto-busts whenever your spending changes meaningfully.

If no API key is configured (or you've hit your daily quota), it falls back to time-based greetings: 🦉 owl at 2–5 AM, 🌙 moon at 23:00–02:00, ☀️ early-bird sun at 05:00, etc. Want the classic "Good morning / afternoon / evening" every time? Turn it off under **Profile → Personality & Fun → Time-Based Greetings**.

Independent of the greeting text, the home screen carries a **bold color gradient** that shifts gently across the day — warm orange at dawn, sky blue at noon, rose at dusk, deep indigo at night. This runs regardless of the greetings toggle (it's background mood, not a loud theme change). Respects your dark-mode setting.

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

## 7. AI Assistant (v1.8+)

The **AI Assistant** is a Gemini-powered chat that has read access to *all* your app data — transactions, goals, assets, trades, trips, subscriptions, pantry. It lives as a tile in the Hub (✨ icon).

### Setup (one-time, ~30 seconds)
1. Get a free API key from [Google AI Studio](https://aistudio.google.com/apikey) — no credit card required.
2. In the app: **Profile → AI Assistant → Gemini API Key** → paste the key.
3. Pick a model. Default is `gemini-2.0-flash-lite` (free tier, fast, plenty smart for this use case).
4. Daily call limit defaults to **50/day** — protects you from accidentally blowing the free quota. Bump it if you have a paid key.

### What you can ask
The assistant has the full context of your finances built into its system prompt — recent transactions, all your goals and progress, subscription totals, trip budgets, what's in your pantry. So you can just ask naturally:

- *"How am I doing this month?"*
- *"Which subscription should I cancel first?"*
- *"What's my biggest spending category and what should I cut?"*
- *"Plan a budget trip to Penang in July under RM 800"*
- *"What can I cook tonight with what I have?"*
- *"Did I overspend on food last week?"*
- *"How much closer am I to my laptop goal?"*

### Features
- **Persistent chat history** — your conversation survives app restarts.
- **Markdown rendering** — code blocks, bullet lists, bold, headings render properly.
- **Haptic feedback** on send + receive.
- **Auto-retry on rate limit** — if Gemini is briefly overloaded (503), the app retries with exponential backoff. You'll never see a raw error message.
- **Daily call counter** in Profile → AI Assistant so you can see usage at a glance.

### Personalised Greetings
The greeting line at the top of your Home screen ("Good morning, Jerry") is also AI-generated when you have a key set up — but it pulls from your real spending data and produces things like:

> 📉 Down 70% this week — killing it!
> 🌙 Day 21, RM 132 spent this month, sleep tight  
> 🍜 Food's 60% of your month, btw

It refreshes on every cold app open or when you've been away for 5+ minutes. If no key is configured, falls back gracefully to static time-based greetings.

### CookMate AI Recipes
CookMate is fully AI-driven in v1.8 — recipes are generated to match your food preferences (cuisine prefs, spice tolerance, dietary flags, allergens, dislikes, budget per meal) and what's currently in your pantry. Set your preferences once in **CookMate → Settings → Food Preferences**, then tap **Cook** for fresh recipe suggestions. Cached for 2 hours so refreshing the page doesn't burn quota.

---

## 8. WanderPlan Travel Planner

Enable in **Profile → Modules → WanderPlan**. The entire module lives under the Hub tab with its own 7-tab navigation.

### Creating & Managing Trips
1. Open **Hub → WanderPlan** (or tap the WanderPlan tile).
2. Tap **New Trip** — enter name, destination, date range, and trip currency (20 currencies available).
3. Trip cards show status badges (Planning / Active / On Trip / Completed).
4. **Edit** a trip by tapping the pencil icon — change name, destination, or dates.
5. **Copy summary** by tapping the clipboard icon — generates a formatted text summary with all your trip stats and copies it to clipboard.
6. **Start Trip** to mark it active. **Complete** when you're done.

### Itinerary Builder
- Days are auto-generated from your trip date range.
- Add activities per day: title, category, times, cost, booking reference, notes.
- **Edit activities** by tapping the pencil icon — modify title, category, times, and notes.
- Tap the circle to mark activities complete (optimistic toggle — instant feedback).

### Map View
- Interactive map showing all your saved places as color-coded pins.
- Tap the expand button for **fullscreen mode** — edge-to-edge map with a floating legend.
- Tap the minimize button to return to normal view.

### Budget Tracker
- Set budget allocations per category (9 categories: Flights, Accommodation, Food, etc.).
- Add expenses — optionally bridge them to your main expense tracker.
- **Quick Currency Convert** — collapsible widget converts amounts between trip currency and MYR.
- **Day-by-Day Spending** — collapsible bar chart showing how much you spent each day of the trip.

### Saved Places
- Save restaurants, hotels, attractions with Nominatim address search (auto-geocoding).
- Rate places (1-5 stars), set price level ($-$$$$), add notes.
- Filter by category or visited/unvisited status.

### Documents Vault
- Store travel documents grouped by type (Flight, Hotel, Train, Insurance, Visa).
- Add booking references, validity dates (using the custom date picker), and external URLs.

### Packing Checklist
- Track what you've packed with a progress bar.
- Use **Templates** (City Break, Beach Vacation, Winter Trip) for quick-start lists.
- Add individual items with category and quantity.

### Dashboard Widgets (Active Trips)
- **Trip Countdown** — days-until-departure or day-progress bar.
- **Daily Spending Meter** — today's spending vs daily budget limit.
- **Today Timeline** — current activity, next up, weather widget, and completion tracker.

---

## 9. Tips for Daily Use

- **Long-press** the + FAB for instant one-tap repeats of your most common expenses
- **Swipe left** on any row in History to edit or delete without tapping the card first
- **Shake your phone** after deleting a transaction to undo — the 🦈 shark confirms it worked
- **Tap the big balance** on the Hub to reveal/hide it (Zen Mode); it auto-hides again after 5 seconds
- **Hold the + FAB** to skip the form when you're just logging "the usual"
- The app works **fully offline**. Log transactions on a plane; they'll sync when you land.

---

## Need Help?

If something breaks, your data is safe — it's stored both locally on your device and in the cloud. A fresh reinstall with the same login will restore everything. For bugs or feedback, message the developer directly.
