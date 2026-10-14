# Expense Tracker Pro — User Manual (v3.0.0)

Welcome to **Expense Tracker Pro**. This comprehensive manual guides you through every feature of the app, from day-one setup to advanced multi-currency financial accounting, credit card lifecycle management, automated reward optimizations, and power-user workflows.

---

## What's New in Version 3.0.0

Version 3.0.0 represents a major architectural milestone, elevating Expense Tracker Pro from a simple expense logger into a native-grade, enterprise-accurate financial operating system:

1. **Financial Account Architecture**: Full separation of liquid assets and credit liabilities. Supports 5 explicit account kinds (`bank`, `cash`, `e_wallet`, `savings`, `credit_card`) with exact net-worth math.
2. **Complete Credit Card Suite**: Dedicated Credit Cards Hub (`/hub/credit-cards`), card limit tracking, real-time credit utilization gauges with color-coded safety badges, statement closing countdowns, and due date tracking.
3. **Smart 4-Preset Repayment System**: Mobile-first repayment workflow supporting Statement Balance, Minimum Due, Custom Partial, and Full Outstanding clearing with atomic cross-account transfers.
4. **Statement Due Reminder Banners**: Proactive in-app reminder banners alerting you 5 days, 3 days, 1 day before due date, on due day, or if overdue.
5. **Cashback & Rewards Engine**: Define category-specific reward rules (e.g., 5% Dining, 3% Petrol), set monthly rebate caps, configure minimum spend conditions, and preview cashback live as you log expenses.
6. **Finance Charge & APR Projection Engine**: Malaysian bank tiered interest simulation (15% per annum standard tier) comparing the true cost of carrying a balance vs. paying in full.
7. **High-Density Mobile UI**: Vertical padding, compact sparkline charts, and streamlined KPI cards tuned for seamless one-handed operation across all screen sizes without unnecessary scrolling.
8. **Offline-First & Integer Cents Reliability**: Dual-layer architecture with IndexedDB caching and Supabase synchronization, eliminating float-precision drift through integer-cent calculations.

---

## 1. Getting Started

### Installation
- **Android APK**: Download and open `app-release.apk`. If prompted by Android, grant permission to "Install from unknown sources" (a standard one-time Android security prompt). Tap **Install**.
- **Desktop / Web PWA**: Navigate to the web deployment in Chrome, Edge, or Safari, and click **Install App** in the address bar.

### Authentication & Cloud Sync
1. Open the app and tap **Sign Up** (or **Sign In** if you have an existing account).
2. Enter your email and password.
3. Once authenticated, the app automatically provisions your user space in Supabase and seeds your default accounts and categories.
4. All data is cached locally on your device via **IndexedDB** — you have full access to your finances even in airplane mode or underground transit.

### Biometric Security & PIN Lock
- **Biometric Unlock**: On your first login on a supported Android or iOS device, the app requests permission to enable Fingerprint or Face ID unlock.
- **PIN Passcode**: If your device lacks biometrics or you prefer a numeric code, go to **Profile → Security & Privacy → App Lock PIN** to configure a 4-digit or 6-digit PIN.
- **Biometric Prompt on Wake**: Whenever the app resumes from the background, biometrics protect your private financial data from shoulder surfers.

### Navigating the App
The primary interface is anchored by a persistent, touch-friendly bottom dock:
- **Hub**: Your executive financial command center (net total balance, wallet carousel, credit card alerts, today's spending, trend sparkline, and upcoming bills).
- **Stats**: In-depth analytics, monthly spending velocity, category breakdowns, and export wizard.
- **Planning**: Forward-looking financial tools (Savings Goals, Recurring Subscriptions, Utilities).
- **Vault**: Asset registry, flip trading logs, and warranty tracking.
- **Profile**: Security settings, account management, categories, appearance, and AI assistant settings.

---

## 2. Financial Accounts & Multi-Currency Architecture

Expense Tracker Pro treats every wallet as a real financial instrument. Foreign currencies are kept distinct to prevent misleading conversions, and debts are segregated from liquid cash.

### The 5 Account Kinds
When creating or editing an account (**Profile → Manage Accounts**), you specify its kind:
- 🏦 **Bank (`bank`)**: Chequing or current accounts used for daily operations and salary deposits.
- 💵 **Cash (`cash`)**: Physical cash in your wallet or home emergency reserves.
- 📱 **E-Wallet (`e_wallet`)**: Digital stored-value wallets (e.g., Touch 'n Go eWallet, GrabPay, Boost).
- 🐷 **Savings (`savings`)**: High-yield savings accounts, fixed deposits, or emergency funds.
- 💳 **Credit Card (`credit_card`)**: Revolving credit lines treated as liabilities.

### Net Worth Calculation
Your top-level **Net Worth** is computed using strict double-entry principles:
$$\text{Net Position} = \sum(\text{Bank} + \text{Cash} + \text{E-Wallet} + \text{Savings}) - \sum(\text{Credit Card Outstanding})$$

- Liquid assets increase your total balance.
- Credit card purchases reduce your net position immediately when spent, keeping you aware of your true balance.
- Paying off a credit card transfers funds from your Bank to the Card, reducing both your cash asset and your card liability with zero duplicate expense counting.

### Multi-Currency Wallets
- Supported currencies include **RM (MYR)**, **SGD**, **USD**, **JPY**, **EUR**, and **GBP**.
- Each wallet card in the Hub carousel clearly indicates its native currency (e.g., `SGD 1,450.00`).
- The primary header total sums your primary currency accounts by default, protecting you from artificial inflation caused by currency mixing.

### Archiving Accounts
To hide a seasonal travel wallet (such as a JPY travel card):
1. Navigate to **Profile → Manage Accounts**.
2. Tap the account card and select **Archive**.
3. The account will disappear from active pickers and the Hub carousel while completely preserving its historical transaction integrity.
4. You can restore archived accounts at any time from the bottom of the Manage Accounts screen.

---

## 3. The Credit Card Management Suite

Access the dedicated Credit Cards interface via the **Credit Cards** card on the Hub or directly at `/hub/credit-cards`.

### Setting Up a Credit Card
1. Go to **Profile → Manage Accounts → + Add Account**.
2. Select **Account Kind: Credit Card**.
3. Configure your card specifications:
   - **Card Name & Issuer**: e.g., "Maybank 2 Gold", "CIMB Cash Rebate".
   - **Credit Limit**: e.g., `RM 10,000.00`.
   - **Statement Closing Day**: The day of the month your bank issues the monthly bill (e.g., 15th).
   - **Payment Due Day**: The deadline by which payment must be received (e.g., 5th of next month).
   - **Annual Percentage Rate (APR)**: Default is 15.00% (the standard Bank Negara Malaysia Tier-1 rate).
   - **Minimum Payment %**: Default is 5.00% (or minimum RM 50.00).

### Credit Utilization Tracking & Safety Badges
Maintaining a healthy credit utilization ratio is vital for credit scoring. The app calculates your real-time utilization:
$$\text{Utilization} = \frac{\text{Current Outstanding Balance}}{\text{Total Credit Limit}} \times 100\%$$

Each card displays a visual progress gauge and status badge:
- 🟢 **Safe (< 30%)**: Optimal credit standing.
- 🟡 **Moderate (30% – 70%)**: Balanced usage.
- 🟠 **High (70% – 99%)**: Approaching credit limit; flagged to prioritize repayment.
- 🔴 **Over Limit (≥ 100%)**: Critical warning badge; card has exceeded limit.

### In-App Due Date Reminders
The app proactively tracks your statement deadlines and displays an alert card on the Hub:
- **5 to 2 Days Before**: ℹ️ "Due in X days — RM XXX.XX remaining on [Card Name]"
- **1 Day Before**: ⚠️ "Payment due tomorrow!"
- **On Due Day**: 🚨 "Payment due TODAY!"
- **Overdue**: 🔴 "Overdue by X days — pay immediately to avoid late fees!"

---

## 4. Credit Card Repayments (The 4 Presets)

To make a payment, open the card in the Credit Cards Hub and tap **Pay Bill**. The modal offers 4 intelligent financial presets:

1. 📄 **Pay Remaining Statement Balance** *(Recommended)*:
   - Pays the exact amount billed on your latest statement minus any partial payments already made.
   - Clears your debt obligation to maintain a 100% interest-free grace period without prematurely spending cash on unbilled transactions.
2. ⚡ **Pay Minimum Due**:
   - Calculates 5% of your statement balance (minimum RM 50.00).
   - Protects your credit report from late marks when short on liquid cash, while warning you of interest consequences.
3. ✏️ **Pay Custom Amount**:
   - Allows you to enter any partial repayment amount (e.g., RM 500.00).
   - Live recalculates the remaining unpaid statement balance.
4. 🏁 **Pay Full Current Outstanding**:
   - Clears every single sen owed, including both billed statement charges and recent unbilled swipes.
   - Restores available credit to 100%.

### How Repayments Are Recorded
When you submit a repayment:
- You choose the **Source Account** (e.g., Maybank Savings).
- The system generates an atomic **Transfer** transaction.
- The source account balance decreases, and the credit card outstanding balance decreases simultaneously.
- Repayments are strictly classified as financial settlements and will never be miscounted as personal consumption expenses in your monthly stats.

---

## 5. Cashback & Rewards Engine

Maximize your card benefits by setting automated cashback rules (**Credit Cards → Card Details → Rewards & Cashback**).

### Configuring Cashback Rules
You can set multiple category-specific rebate percentages:
- **Dining**: 5.0%
- **Groceries**: 3.0%
- **Petrol**: 4.0%
- **General / Other**: 0.5%

### Monthly Caps & Spend Thresholds
- **Monthly Cap**: e.g., Maximum RM 50.00 rebate per monthly cycle.
- **Minimum Monthly Spend**: e.g., Requires at least RM 1,000.00 monthly card spend before cashback activates.

### Live Cashback Preview
When you log an expense using a credit card that has active reward rules, the transaction dialog shows an instant estimate:
> ✨ *Estimated Cashback: +RM 6.50 (5% Dining)*

### Reconciling Rewards
When your monthly bank statement applies the cash rebate:
1. Tap **Record Reward / Statement Credit**.
2. Select whether it applies as a **Card Statement Credit** (reduces card balance) or **Bank Deposit**.
3. Enter the confirmed amount. The app updates your rewards ledger and tracks actual vs. estimated returns.

---

## 6. Interest & Finance Charges (Malaysian APR Standards)

Expense Tracker Pro implements the statutory interest calculation model used by Malaysian retail banks:

### Grace Period Mechanics
- If you pay **100% of your Statement Balance** on or before the Payment Due Date, interest is **RM 0.00**.
- If you pay less than the full statement balance (even by RM 1.00), you lose the grace period. Finance charges accrue on each transaction from the day it was posted until repayment.

### Tiered APR Structure
The app models the three-tier structure standard across Malaysian issuers:
- **Tier 1 (15.0% p.a.)**: Prompt payment for 10 or 12 consecutive months.
- **Tier 2 (17.0% p.a.)**: Prompt payment for 8 to 9 consecutive months.
- **Tier 3 (18.0% p.a.)**: Accounts with missed payments or irregular history.

### The Finance Charge Calculator
Use the built-in interest simulator before deciding your payment:
- Compare the exact cost of paying **Minimum Due vs Full Balance**.
- View the estimated daily compounding finance charge.
- Enter the exact bank finance charge from your PDF bill when reconciling.

---

## 7. Daily Transaction Logging & Velocity

### Logging Expenses & Income
Tap the floating **`+`** button to open the fast transaction logger:
- **Amount**: Integer cent accuracy (type `25.5` for RM 25.50).
- **Type**: Expense, Income, or Transfer.
- **Account**: Pick the paying account. If a credit card is selected, card limit indicators show available balance.
- **Category & Sub-Category**: Dynamically sorted by your most frequent usage.
- **Date & Time**: Defaults to now; easily adjust for past expenses.
- **Note**: Free-text field supporting smart tag auto-detection.

### Spending Velocity Engine
In the **Stats** screen, the Spending Velocity meter estimates your projected month-end spend. To keep projections realistic:
- The engine automatically **excludes fixed bills** (tagged Bills, Subscriptions, Utilities, Savings, or Transfers).
- Rent, insurance, and salary day lump-sums will not artificially trigger an "overspending" panic on day one of the month.
- You can manually toggle "Exclude from Velocity" on any specific transaction under the More options drawer.

### Claimable & Split Bills
If you front the bill for friends or work:
1. Turn on the **Claimable / Split Bill** toggle in the transaction modal.
2. Enter the payer or names in the Note field (e.g., "Dinner with Kevin and Sarah").
3. The expense appears on your Home dashboard under the **Claims & Splits** widget.
4. When reimbursed, tap **Mark Settled** — the app records the incoming funds and clears the pending claim.

---

## 8. Financial Planning

The **Planning** tab consolidates your forward commitments:

### Savings Goals
- Create named savings goals (e.g., "Emergency Fund", "Japan Trip", "New Car Downpayment").
- Set a target amount and deadline.
- Deposit money toward a goal to watch the progress ring advance. Crossing 100% unleashes the celebratory Dragon animation!

### Recurring Subscriptions & Utilities
- Track monthly recurring commitments (Netflix, Spotify, Gym, Cloud storage, TNB, Water).
- Set the billing day and source account.
- The Hub automatically highlights any bills due in the next 7 days in the **Upcoming** widget.

---

## 9. Power User Features

### 🔍 Power Search Query Syntax
In the **History** tab, the search bar supports powerful search operators:

| Operator | Syntax Example | What It Matches |
|---|---|---|
| Category | `#food`, `#transport` | Only transactions in that category |
| Account | `@maybank`, `@cash` | Only transactions in matching account |
| Greater Than | `>50` | Transactions with amount > RM 50 |
| Less Than | `<100` | Transactions with amount < RM 100 |
| Amount Range | `50-150` | Transactions between RM 50 and RM 150 |
| Date Window | `today`, `yesterday` | Transactions on specific calendar days |
| Relative Period | `last week`, `this month` | Transactions within relative window |
| Specific Month | `june 2026`, `2025` | Transactions within specific month or year |
| Exact Phrase | `"Grab Car"` | Exact match for note content |

*Example Query:* `#food @maybank >30 last week` — finds all dining expenses above RM 30 paid via Maybank in the past 7 days.

### 👆 Swipe Gestures (History Screen)
- **Swipe Row Left**: Reveals quick action buttons — **Edit** (blue) and **Delete** (red).
- **Long Swipe**: Snaps the action drawer open for one-handed operation.
- **Shake to Undo**: Accidentally deleted a transaction? Simply shake your phone within 5 seconds to restore it immediately (accompanied by the Shark animation).

### ⚡ Quick Templates (Long-Press FAB)
- **Press and hold** the floating `+` button for 500ms.
- A quick menu displays your top 4 most repeated transactions (e.g., "Kopi O RM 3.50", "Lunch RM 12.00").
- Tap any template to log the transaction instantly without opening the modal.

### 🧾 Monthly Thermal Receipt Generator
- Access via **Stats → View Monthly Receipt**.
- Renders your month's finances as a vintage thermal register receipt with category breakdowns, savings rates, and top splurge items.
- Tap **Share as PNG** to generate a clean 9:16 high-resolution image ready for Instagram Stories, WhatsApp, or personal archiving.

---

## 10. AI Assistant (Gemini)

Expense Tracker Pro includes a privacy-preserving financial copilot powered by Google Gemini:

### Setup
1. Obtain a free API key from [Google AI Studio](https://aistudio.google.com/apikey).
2. Go to **Profile → AI Assistant → Gemini API Key** and paste your key.
3. Select your model (default: `gemini-2.0-flash-lite` for high speed and generous free-tier limits).
4. Set a daily call cap (default: 50 calls/day) to prevent unintended usage.

### Financial Queries
The assistant has secure, read-only access to your active financial context. Ask questions naturally:
- *"How does my dining spending this month compare to last month?"*
- *"Am I on track to hit my RM 10,000 emergency fund goal by December?"*
- *"Which credit card should I use for petrol to maximize my rebates?"*
- *"What is my highest recurring subscription cost?"*

### AI Spending Greetings
When enabled, the top of your Hub presents dynamic, personalized financial insights on wake:
- *"📉 Spending down 35% compared to this time last week — looking great!"*
- *"💡 3 subscriptions billing over the next 4 days (RM 114 total)."*

---

## 11. Security, Offline Integrity & Export

### Offline-First Architecture
The app operates with zero internet connectivity:
- All additions, edits, and deletions persist instantly to local **IndexedDB** storage.
- A background worker quietly syncs mutations with Supabase when a connection is restored.
- An offline indicator confirms your offline status and verifies that your records are safe.

### Accountant Export Wizard
When you need to file taxes or review spending with an advisor:
1. Go to **Stats → Export Data** (or **Profile → Export Data**).
2. Select your date range (Custom, This Month, Year-to-Date, or All Time).
3. Filter by specific accounts or categories if required.
4. Tap **Generate CSV**.
5. The native Android/iOS share sheet opens, allowing one-tap sharing to WhatsApp, Google Drive, Gmail, or local storage.

---

## 12. Themes, Visual Polish & Easter Eggs

### AMOLED Pitch Black Mode
For OLED devices, turn on **Profile → Appearance → AMOLED Pitch Black** (requires Dark Mode). Every surface turns to pure `#000000`, turning off pixels to save battery and reduce eye strain.

### Zen Privacy Mode
Tapping the large net balance figure on the Hub instantly blurs all numbers on screen. Tap again to reveal. Ideal when glancing at your phone in public spaces.

### Animated Menagerie
The app celebrates financial moments with fluid micro-animations:
- 🐋 **Whale**: Triggers when logging any single purchase ≥ RM 5,000.
- 🐧 **Penguin**: Detects late-night food runs (< RM 10 between 1:00 AM and 5:00 AM).
- 🐉 **Dragon**: Flies across screen when a Savings Goal hits 100%.
- 🦈 **Shark**: Swims across the bottom when an undo action successfully restores a deleted entry.
- 🔥 **Phoenix**: Rises upon phone-shake undo triggers.

### God Mode (Easter Egg)
- **Mobile**: Tap the user avatar on the Hub 7 times in 3 seconds.
- **Desktop**: Input the Konami code (`↑ ↑ ↓ ↓ ← → ← → B A`).
- Activates temporary fantasy figures across all cards. Repeat to toggle off.

---

## Need Assistance?
If you encounter unexpected behavior or have feedback during testing, your data is completely secure in local device storage and cloud snapshots. Contact the developer directly or submit an issue in the project repository.
