# User Manual — Tracker Super App v2.0

Welcome to **Tracker** — your all-in-one expense tracker, claims manager, asset vault, and content radar. This guide walks you through every feature so you can get the most out of the app from day one.

---

## Welcome to Your Hub

The **Hub** is your home base. Every time you open it, you'll see a **Morning Briefing** card right at the top — think of it as your financial weather report for the day.

### The Briefing Card

- **Today's Velocity** — This is the total amount you've spent *today*. It updates in real time as you add expenses. If it says "RM 0.00" in the morning, you're starting fresh.
- **Radar Alert** — If you've set up content sources (more on that below), you'll see a small purple badge like "📡 3 New" showing how many new articles or movies dropped today. Tap it to jump straight to your feed.

### Quick Log Expense

See that big button that says **"+ Quick Log Expense"**? That's your best friend during a commute or a coffee run.

1. Tap it
2. Enter the amount
3. Pick a category
4. Hit save

Done. Three seconds. Your briefing card and dashboard update instantly.

> **Tip:** You can also tap the round **+** button in the center of the bottom navigation bar — it does the same thing from any screen.

---

## Tracking Your Wealth (Stats & History)

### The Predictive Velocity Chart

Tap **Stats** in the bottom navigation. When you're viewing the **Month** filter, you'll see a special chart called **Spending Velocity**.

- The **solid line** shows your actual cumulative spending so far this month
- The **dashed line** shows where you're *headed* if you keep spending at the same pace

Above the chart, you'll see a projection like:

> *"At your current pace of RM 42.50/day, you are projected to spend RM 1,275.00 this month."*

**What this means for your budget:**
- If the projected number is way above your comfort zone, it's a signal to slow down
- If it's comfortably below your income, you're in great shape
- The projection recalculates every time you add a new expense, getting more accurate as the month goes on

### Filtering Your History

Tap the **History** tab to see your transaction list. At the top, you'll find three filter buttons:

- **Today** — Shows only transactions from today. Perfect for reviewing what you've spent since this morning.
- **This Week** — Shows Monday through Sunday of the current week. Great for a weekly spending review.
- **Show All** — Clears the filter and shows your complete history.

The counter below the title tells you exactly how many transactions match: *"Today — 3 transactions"*.

> **Note:** These filters use your device's local time, so midnight means *your* midnight — not some server's midnight on the other side of the world.

---

## Managing Claims & Split Bills

Ever paid for a company lunch and needed to claim it back? Or split a Mamak bill with friends? The **Claims & Splits** module handles this cleanly.

### How to Enable It

1. Go to **Profile** (bottom right)
2. Scroll to **Modules**
3. Turn on **Claims & Splits**
4. It will now appear in your **Hub**

### Marking an Expense as Claimable

When you're adding a new expense (via the + button or Quick Log):

1. Enter the amount and category as normal
2. Below the category, you'll see a toggle: **"Claimable / Split Bill"**
3. Turn it on
4. Save the expense

That's it. The expense is recorded normally (your balance drops), but it's now flagged as "pending reimbursement."

### Viewing Your Pending Claims

Open the **Hub** → tap **Claims & Splits**. You'll see:

- **Total Pending** — The total amount you're owed
- **Pending Count** — How many claims are outstanding
- Two tabs: **Pending** and **Cleared**

### Getting Your Money Back

When you've actually been reimbursed (your friend Grabbed you the money, or HR deposited the claim):

1. Find the claim in the **Pending** tab
2. Tap **"Mark as Cleared"**
3. Confirm

**Here's the magic:** The app automatically creates a matching income entry in your account — so your total balance goes back up by exactly the right amount. You don't need to manually add an "Income" transaction. The math stays perfect.

The claim moves to the "Cleared" tab with a green "Reimbursed" badge, and you can see the full history of everything you've ever claimed.

---

## The Asset Vault

The Asset Vault helps you track the things you own — phones, laptops, headphones, shoes, cameras — and understand their true cost over time.

### How to Enable It

1. Go to **Profile** → **Modules** → Turn on **Asset Vault**
2. It will now appear in your **Hub**

### Adding Your First Asset

1. Open the **Hub** → tap **Asset Vault**
2. Tap the **+** button
3. Pick an emoji icon (📱 for phone, 👟 for shoes, etc.)
4. Enter the name, category, purchase date, and price
5. Tap **Add to Vault**

### Understanding Cost Per Day

This is where it gets interesting. The Vault calculates:

> **Cost / Day** = Total Investment ÷ Days Since Purchase

So if you bought headphones for RM 350 and you've had them for 100 days, your cost per day is RM 3.50. As time passes, that number keeps dropping — proof that quality purchases pay for themselves.

The dashboard shows the **combined Cost / Day** across all your tracked items. Use the category filter pills to see the cost per day for just your electronics, or just your audio gear.

### Maintenance Logs — Track the True Cost

Real ownership costs more than the sticker price. That phone case, screen protector, or repair bill — it all adds up.

**To add a maintenance log:**

1. Tap any asset card to open its detail view
2. In the **Maintenance Log** section, tap **+**
3. Enter a description (e.g., "Bought silicone case"), cost, and date
4. Tap **Save Log Entry**

The **True Total** and **Cost / Day** numbers update instantly:

> **True Total** = Purchase Price + All Maintenance Costs
>
> **Cost / Day** = True Total ÷ Days Active

You can also edit or delete any log entry using the pencil and trash icons next to it.

---

## The Radar Tracker

The Radar is your personal content feed — news websites, movie trackers, and streaming alerts, all in one place.

### How to Enable It

1. Go to **Profile** → **Modules** → Turn on **Radar Tracker**
2. It will appear in your **Hub**

### Setting Up Your Sources

Open **Radar Tracker** from the Hub, then tap the **⚙️ gear icon** to open **Radar Sources**. Tap **+** to add a new source.

#### Adding a Website (RSS Feed)

1. Select **RSS Feed**
2. Give it a name (e.g., "Photography")
3. Paste the RSS URL (e.g., `https://petapixel.com/feed/`)
4. Optionally add **keywords** to filter results (e.g., "sony, fujifilm")
5. Tap **Add Source**

> **How to find an RSS URL:** Most blogs have one. Try adding `/feed/` or `/rss` to the website's URL, or search "[website name] RSS feed" online.

**Popular feeds to get started:**
- Tech: `https://www.theverge.com/rss/index.xml`
- Photography: `https://petapixel.com/feed/`
- Gaming: `https://kotaku.com/rss`

#### Tracking Cinema Releases

1. Select **In Cinemas (MY)**
2. Give it a name (e.g., "Now Showing")
3. Tap **Add Source**

The app pulls current Malaysian cinema listings automatically, complete with poster images and release dates.

#### Tracking Streaming Drops

1. Select **Streaming Drops**
2. Give it a name (e.g., "Netflix")
3. Pick your platform: Netflix, Disney+, Amazon Prime, Apple TV+, HBO Go, or All Major Platforms
4. Tap **Add Source**

> **Tip:** Add multiple sources — one for Netflix, one for Disney+ — and use the filter pills on the feed to switch between them.

### Reading Your Feed

All your sources combine into one feed, sorted newest first. Use the filter pills at the top to view just one source, or "All" for everything. Tap any card to open the full article or movie page.

---

## Offline Mode (LRT Mode)

Lost signal on the train? Stuck in a tunnel? Underground parking? **Don't worry.**

### What Happens When You Go Offline

The app detects the moment you lose your connection. Here's what changes:

- **You can still add expenses normally.** Tap Quick Log, enter your coffee, hit save. It works exactly the same way.
- Instead of sending to the cloud, your expense is saved safely on your device.
- You'll see a small notification: *"No connection. Expense saved offline."*

### What Happens When You Come Back Online

The moment your signal returns, the app automatically:

1. Detects the reconnection
2. Uploads all your queued expenses to the cloud
3. Shows a confirmation: *"3 offline expenses synced to cloud!"*

You don't need to do anything. No "sync" button to press, no manual upload. It just works.

### What About the Dashboard?

While offline, your dashboard still shows all the expenses you've added (including the offline ones). The totals, the velocity, the charts — they all include your offline entries. When you reconnect and sync, the cloud catches up to what you already see.

> **Bottom line:** Use the app exactly the same way whether you have signal or not. The sync happens invisibly in the background.

---

## Tips & Tricks

- **Dark Mode**: Profile → toggle Dark Mode. Everything adapts beautifully.
- **Accent Colors**: Profile → Accent Color — pick from Blue, Emerald, Yellow, Purple, or Rose. Changes the entire look of the app.
- **Pending Income**: When adding income, mark it as "Pending" for invoices you've sent but haven't been paid yet. It won't count toward your balance until you mark it cleared.
- **Export Your Data**: Profile → Export to CSV downloads all your transactions as a spreadsheet.
- **PIN & Biometric Lock**: Profile → Security — set up a 6-digit PIN or fingerprint lock for privacy.

---

That's everything. The app is designed to be intuitive — the best way to learn is to start using it. Add your first expense, flag your first claim, track your first asset, and build your first radar feed. Everything else will click naturally.

Happy tracking.
