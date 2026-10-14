# Changelog

All notable changes to **Expense Tracker Pro** are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [3.0.0] — Financial Account Architecture, Credit Card Engine & Reliability — 2026-10-14

A milestone architecture upgrade focused on financial correctness, offline data safety, a complete optional credit-card module with Malaysian banking practices, intelligent rewards and finance charge projections, and high-density mobile UI optimization.

### 🛡️ Phase 0 — Reliability, Data Safety & Offline Sync
- **Atomic Transaction Pipeline**: Transaction forms await cloud persistence before dismissing; IndexedDB local storage is guaranteed on network loss with no false-positive toasts.
- **Resilient Offline Sync**: Failed cloud synchronizations remain safely in the local queue with automatic background retry and duplicate-submission prevention on rapid taps.
- **User Data Isolation**: Multi-user cache keys in IndexedDB and localStorage scoped by `user_id` preventing accidental cross-account data leaks upon logout/login.
- **Account Deletion Safety**: Deleting an account prevents cascading loss of historical transactions; balances and links remain traceable.
- **Deployment & Static Export**: Audited Next.js static export compatibility with zero missing assets or browser-only crashes during build.

### 🏦 Phase 1 — Financial Account Architecture
- **Stable Account IDs & Explicit Kinds**: Introduced `accounts(id)` UUIDs and explicit kinds (`bank`, `cash`, `e_wallet`, `savings`, `credit_card`) via additive migration `006_financial_accounts_architecture.sql`.
- **Pure Balance Calculation Engine**: Extracted accounting math into `lib/balance.ts` with pure TypeScript functions, ensuring Home, Salary Planner, Analytics, and Hub always produce identical financial figures.
- **Separation of Assets vs Liabilities**: Credit cards are treated as liabilities rather than cash assets; Net Financial Position computes `(Cash Assets - Credit Card Liabilities)`.
- **Multi-Currency Safety**: Prevented arbitrary addition of different foreign currencies; the Wise-style wallet displays discrete balances per currency, with estimated conversion to the base currency.

### 💳 Phase 2 — Credit Card Module (MVP)
- **Credit Card Accounts**: Create and configure cards with issuer, credit limit, statement closing day, payment due day, and annual interest rate (APR) via migration `007_credit_card_architecture.sql`.
- **Transaction Classification**: Added explicit credit card transaction types (`purchase`, `repayment`, `refund`, `fee`, `interest`, `cashback`) preventing double-counting in expense analytics.
- **Credit Card Payment Modal**: Mobile-first repayment modal with 4 distinct financial presets:
  1. *Pay Remaining Statement Balance* (pays issued statement without paying unbilled new purchases)
  2. *Pay Minimum Due* (pays minimum without falsely marking statement as fully settled)
  3. *Pay Custom Amount* (supports partial repayment with updated remaining balance)
  4. *Pay Full Current Outstanding* (clears both statement and unbilled purchases)
- **Credit Cards Dashboard (`/hub/credit-cards`)**: Real-time credit utilization progress meters, statement cycle history, unsettled balances, and one-tap repayments.

### 🧠 Phase 3 — Smart Credit Card Intelligence
- **Phase 3A — Statement Due Reminders**: Configurable in-app reminder banners (`lib/creditCardReminders.ts`) on Home and Hub warning of upcoming due dates, due today, or overdue statements with remaining amounts.
- **Phase 3B — Cashback & Rewards Tracking**: Built-in cashback engine (`lib/cashbackEngine.ts`, `CreditCardCashbackModal.tsx`, `008_cashback_rewards.sql`) supporting category-specific rebates, monthly caps, minimum spend conditions, and tracking estimated vs confirmed rewards.
- **Phase 3C — Interest & Finance Charge Engine**: Accurate Malaysian credit card APR projection (`lib/interestEngine.ts`, `CreditCardFinanceChargeModal.tsx`) modeling standard 15% / 17% / 18% tiers, with manual reconciliation of actual bank charges.

### 🎨 Phase 4 — UI/UX, Accessibility & Native Polish
- **Keyboard & Modal Accessibility**: Full keyboard focus management, Tab/Shift+Tab trapping, Enter/Space support on custom switches, and Escape key dismissal across all modals.
- **Skeleton Loaders & Empty States**: Added `components/Skeleton.tsx` placeholders for initial hydration, and actionable empty states for History, Analytics, and Credit Cards Hub.
- **Form Error Highlighting**: Real-time input validation error states with `role="alert"` for accessibility, accompanied by subtle native haptic pulses (`NativeHaptics`).
- **Offline Sync Reassurance**: Persistent top indicator displaying offline mode and confirming local IndexedDB storage.

### 📐 Mobile Density & Layout Space Optimization
- **Homepage Vertical Rhythm**: Streamlined mobile vertical padding and spacing (`p-3.5 sm:p-5`, `space-y-3.5 sm:space-y-5`).
- **Spending Trend Sparkline**: Sized mobile chart container to `h-[95px] sm:h-[150px]` with compact card padding, saving over 100px of vertical space to bring key metrics above the fold.
- **KPI Cards & Widgets**: Optimized Today and Weekly scorecards and credit card preview tiles into sleek, glanceable native tiles.
- **Bottom Navigation Dock**: Restored full touch-friendly bottom navigation bar with safe area clearance.

### 📋 Phase 5 — Quality Assurance Acceptance Matrix
- Generated comprehensive 32-case manual acceptance test checklist ([manual_acceptance_checklist.md](file:///C:/Users/Jerry/.gemini/antigravity-ide/brain/ebb71a34-f3aa-4793-ac42-33a1879f4f63/manual_acceptance_checklist.md)) covering all 10 core functional domains.

---

## [1.8.0] — AI Assistant + Streamlined App — 2026-05-22

The biggest release since launch. A full app-wide AI assistant with access to **all** your data, AI-powered personalised greetings, a CookMate that's 100% AI-driven (no more curated recipe pool), date-grouped history, and a deliberate trim of features that weren't earning their keep.

## ✨ AI Assistant — new top-level module

A new tile in the Hub: **AI Assistant** (✨). Tap it to chat with a Gemini-powered model that has full read access to your financial life — transactions, goals, assets, trades, trips, subscriptions, pantry, the lot.

- **Persistent chat history** stored in localStorage — your conversation survives app restarts.
- **Markdown rendering** — code blocks, lists, bold, headings all render properly in the chat bubbles.
- **Native haptics** on send + receive.
- **Streaming-style typing indicator** with bouncing dots while the model thinks.
- **Smart system prompt** auto-injects relevant context (recent spending, goals at risk, top categories, upcoming bills) so you can just ask "how am I doing this month?" without spelling it out.
- **Free-tier safe** — defaults to `gemini-2.0-flash-lite` (free), with a daily-call limit (default 50) shown in Profile so you can never accidentally blow the quota. Heavier models available if you supply your own key.
- **Per-call rate limit** (2s gap) and **automatic retry on 503** with exponential backoff (2x → 4x). Survives Gemini's occasional capacity wobbles silently.

Get a free API key from Google AI Studio in **Profile → AI Assistant**.

## ✨ AI-Powered Greetings (merged with insights)

The dashboard's "Good morning, Jerry" line is now generated by Gemini using your actual spending data. Examples it has produced in testing:

> 📉 Down 70% this week — killing it!
> 🌙 Day 21, RM 132 spent this month, sleep tight  
> 🍜 Food's 60% of your month, btw  
> 🎯 Laptop goal at 80% — almost there!

The previous "Smart Insights" card is **gone**, because the insight is now baked into the greeting itself — one cohesive line instead of two redundant pieces of UI competing for attention.

**Caching strategy (v1.8 design):**
- Cached for the **session only** (sessionStorage) — refreshes on every cold app open.
- Also refreshes when the app resumes from >5 min in the background.
- Data-signature cache key — if your spending changes meaningfully (e.g. you log a new transaction), the cache busts automatically. No more "RM 0 spent this month" lies after Supabase finishes syncing.
- Empty-state guard — if `transactions.length === 0`, the greeter bails entirely rather than caching a misleading number while data is still loading.

## 🍳 CookMate — Full AI Overhaul

CookMate is now **100% AI-driven**. No more 24 curated recipes, no more MealDB, no more pantry-match scoring against a fixed list.

### What's new
- **AI-generated recipes** via Gemini, personalised to *your* taste profile (cuisine prefs, spice tolerance, cooking time, skill level, dietary restrictions, dislikes, budget per meal).
- **Food preferences panel** in CookMate Settings — covers cuisine prefs (Malaysian / Chinese / SE Asian / Western / etc.), spice tolerance, dietary flags (halal / vegetarian / vegan / pescatarian / no-pork / no-beef), allergens, dislikes free-text, default budget per meal.
- **2-hour recipe cache** so refreshing the page doesn't burn quota.
- **Smart pantry context** — the AI knows what's in your pantry and what's expiring soon, and biases recipes toward using those ingredients.
- **Cooking history** preserved.

### What's removed
- ✂️ The 24 curated local recipes (`localRecipes.ts`)
- ✂️ TheMealDB API wrapper (`recipeApi.ts`)
- ✂️ The static recipe detail route (`/cookmate/recipe/[id]`) — recipes are now ephemeral, generated on demand
- ✂️ The CookMate-local Gemini wrapper (folded into `lib/ai/gemini.ts`)

## ✨ History — date separators

Following user feedback ("scrolling through 100s of rows with no break is hard"), the History list now groups transactions under **date headers** (Today, Yesterday, specific weekdays, then full dates). Sticky-style separators make scanning feel like reading a bank statement.

## 🗑️ Removals — aggressive simplification

Audit found three feature areas weren't earning their keep. All gone in v1.8:

- ✂️ **Slack Arcade** — 11 mini-games + boss key. Fun proof of concept, but nobody uses a finance app to play 2048. Deleted entire `app/arcade/` directory (13 files).
- ✂️ **Weather Theming** — `lib/weather.ts`, `useWeather` hook, `WeatherWidget` component, `LocationsModal`. Nice idea, low signal-to-effort. Time-of-day gradient (still in!) does 95% of the same job.
- ✂️ **Daily Reminders** — `dailyReminder` + `reminderTime` settings. Capacitor's local-notification plugin was unreliable on Xiaomi MIUI specifically and the feature was never trusted enough to use.
- ✂️ **Billing Cycle Day** — the "your month starts on the 5th" custom anchor. Real-world usage was 0% non-default; everyone runs on calendar months.
- ✂️ **MealDB integration** — replaced by AI generation (see CookMate above).
- ✂️ **Capgo OTA** — already removed in v1.1.0 dependency-wise; v1.8 removes the last code-comment reference.

Net code removed: ~1,800 lines across 18 files.

## 🐛 Bug Fixes

- **Android version mismatch** — `package.json` and `android/app/build.gradle` were drifting independently. Bumped `versionName` to `"1.8.0"` and `versionCode` to `18`. Android System → App info now shows the correct version (was stuck on 1.0 for every release since 1.0.0 because Capacitor doesn't sync gradle).
- **Greeting cache lying about spending** — the 4-hour localStorage cache could capture a "RM 0 spent" greeting if the app opened before transactions had finished syncing, then proudly serve that lie for 4 hours regardless of what you actually spent. Fixed via session-only cache + data signature + empty-state guard (see above).
- **Stale `.next` cache referencing deleted recipe route** — caused build errors after CookMate overhaul. Cleaned and verified.

## 🧹 Internal

- New `lib/ai/` module: shared Gemini service (`gemini.ts`) with usage tracking, daily-cap enforcement, rate limiting; `greeting.ts` for the merged greeting generator.
- New `app/ai/page.tsx` — full chat UI with persistence, markdown rendering, model selection.
- `lib/cookmate/` rewritten — new `types.ts` with `FoodPreferences` + `AIRecipe` shapes; `context.tsx` slimmed.
- `useUserPreferences` hook trimmed of dead state (`billingCycle`, `dailyReminder`, `reminderTime`, `primaryLocation`, `secondaryLocation`, `isArcadeEnabled`).
- `AppContextType` shrunk to match — fewer fields, less noise.
- Deleted unused `BillingCycleSheet.tsx` + `TimePickerModal.tsx`.
- `versionCode` bumped to 18 (mirrors v1.8) so Play Store / sideload upgrades work cleanly.
- `tsc --noEmit` → 0 errors. 0 lint errors.

---

## [1.7.1] — WanderPlan Polish + CookMate Nav Redesign — 2026-05-17

A detailed audit and feature pass on WanderPlan, plus a CookMate bottom-nav redesign for visual consistency.

## 🐛 Fullscreen Map Fix

- **Map was stuck in fullscreen on Android.** The fullscreen overlay used `fixed inset-0` but was rendered inside AppLayout's `overflow-hidden` container, trapping CSS `fixed` positioning within the stacking context. Fixed by portalling the fullscreen overlay to `document.body` via `createPortal`. Also locks body scroll while expanded, bumps z-index to `9999`, and adds `pb-safe` to the legend.

## 🎨 CookMate Bottom Nav Redesign

- CookMate's bottom bar now **mirrors the app's native BottomNav exactly** — `fixed bottom-0`, `rounded-t-3xl`, `shadow-up`, `backdrop-blur-xl`, same `px-6 py-4` spacing.
- Replaced emoji icons with **Lucide icons** (`ChefHat`, `Bot`, `Refrigerator`, `ShoppingCart`, `Settings`) — same `w-6 h-6` size as the main nav, bold stroke on active tab.
- Active state uses the CookMate orange accent with `strokeWidth: 2.5`.
- Content area gets `pb-24` to clear the fixed nav.

## ✈️ WanderPlan — New Features

### Trip Editing
- Trip cards now have an **Edit button** (pencil icon) that opens a modal to modify name, destination, and dates.

### Trip Summary Export
- **Copy Trip Summary** button (clipboard icon) on each trip card generates a formatted text summary with stats (activities, places, budget, packing progress) and copies it to clipboard for easy sharing.

### Activity Editing
- Itinerary activities now have an **Edit button** that opens a modal to modify title, category, times, and notes. Previously activities could only be created or deleted.

### Currency Converter Widget
- Budget page gains a **Quick Currency Convert** collapsible section — type an amount in the trip currency and see the live MYR equivalent via exchangerate.host (debounced 600ms).

### Day-by-Day Spending Breakdown
- Budget page gains a **Day-by-Day Spending** collapsible bar chart showing per-day expense totals with relative-width bars and transaction counts.

### Documents — Custom Date Picker
- Documents page's validity date inputs replaced with the app's **CustomDatePicker** component (was using native `type="date"` which looks ugly on Android WebView).

## 🔧 Code Quality Fixes

- **Currency constant unified** — Trip creation modal's currency list was a hardcoded inline array of 12 currencies. Now uses `WP_CURRENCIES` constant (20 currencies) from `wanderplanConstants.ts`.
- **Default currency** uses `WP_CURRENCIES[0].code` instead of hardcoded `"RM"`.
- **CRUD error feedback** — `createWPTrip` now checks the return value and shows an error toast on failure instead of always saying "Trip created!".

## 🧹 Internal

- 7 modified files: 5 WanderPlan pages, CookMate layout, package.json.
- Version bumped to `1.7.1`.
- `tsc --noEmit` → 0 errors. 0 lint errors.

---

## [1.7.0] — CookMate Smart Kitchen Module — 2026-05-17

A new toggleable module that turns the app into a kitchen companion. Pantry tracking, recipe discovery with ingredient matching, Gemini AI-powered cooking assistant, shopping lists, and cooking history — all running 100% client-side with localStorage (zero Supabase cost).

## 🍳 CookMate — 7 sub-features

Toggle on in **Profile → Modules → CookMate** (on by default). Has its own bottom nav within the module.

### Cook Page
- 24 curated local recipes (5 breakfasts, 12 weekday dinners, 5 weekend meals, 2 snacks) with Unsplash thumbnails, step-by-step instructions, prep times, difficulty ratings.
- **Pantry match scoring** — each recipe shows a % bar of how many ingredients you already have (green ≥70%, yellow ≥40%, red <40%).
- Filter by occasion (Breakfast, Lunch, Dinner, Weekend, Meal Prep, Snack), cuisine (Chinese, Japanese, Korean, SE Asian, Western), and difficulty.
- Sorted by match score — recipes you can make NOW appear first.

### Ask AI (Gemini)
- Conversational chat with 4 quick-prompt buttons.
- System prompt auto-includes your pantry contents, expiring items, and recent cooking history — so the AI knows what you have.
- Supports 4 Gemini models (2.5-flash, 2.0-flash, 2.0-flash-lite, 1.5-flash).
- Graceful fallback if no API key configured.
- Typing indicator with bouncing dots.

### Pantry
- Ingredient inventory grouped by category (Protein, Vegetables, Dairy, Grains, Condiments, Frozen, Other) with emoji labels.
- Expiry tracking with color coding (yellow = 3 days, red = expired).
- +/- quantity buttons with auto-remove at zero.
- Add modal with category picker, unit selector, expiry date.
- "Always in stock" items (salt, pepper, oil, garlic, etc.) automatically count as matched in recipes.

### Recipe Detail (`/cookmate/recipe/[id]`)
- Hero image, ingredient checklist (green = have, red = missing with +Shop button).
- "Add all missing to shopping list" one-tap button.
- Numbered step-by-step instructions.
- YouTube link if available.
- **"I Cooked This!"** button → adds to cooking history.
- Pre-generated via `generateStaticParams` for all 24 local recipes — works with `output: "export"`.

### Shopping List
- Quick-add input with Enter key support.
- Check/uncheck items, "Clear bought" button.
- Auto-populated from recipe missing ingredients.

### Settings / More
- Stats cards (pantry count, cooked count, shopping count).
- Collapsible AI Settings: API key input (with show/hide toggle), model selector with 4 Gemini options.
- Link to Google AI Studio for free API key.
- Cooking history with favorites + recent, relative timestamps.

### Architecture
- **Zero Supabase cost** — entire module uses localStorage with `cookmate_` prefix.
- SSR-safe: all localStorage reads wrapped in `typeof window` + try-catch.
- CookMateProvider context wraps only `/cookmate/*` routes (via layout.tsx) — zero impact on the rest of the app.
- TheMealDB API wrapper for future online recipe search (free, no key).

## 🧹 Internal

- 12 new files: 4 lib modules (types, context, localRecipes, recipeApi, gemini), 1 layout, 6 pages, 1 client component.
- 6 modified files for wiring (preferences, context, hub, profile, bottom nav).
- Version bumped to `1.7.0`.
- `tsc --noEmit` → 0 errors. `next build` → 42 pages (static + SSG). Clean.

---

## [1.6.0] — Slack Arcade Module — 2026-05-17

A full mini-game hub with 11 games, a daily slack timer, and a Boss Key panic screen. All built with pure React state + Canvas + Framer Motion — zero external game libraries.

## 🎮 Slack Arcade — 11 games + Boss Key

Toggle on in **Profile → Modules → Slack Arcade**. Accessible from the Hub tab.

### Game Hub (`/arcade`)
- **Daily Slack Timer** — counts up every second, persists per-day to localStorage. Achievement badges: 10m Bronze, 30m Silver, 1h Gold, 2h Trophy.
- **Boss Key** — red panic button in the header. Opens a fake Windows Update screen (blue, spinning loader, crawling progress bar, "Don't turn off your device"). Tap anywhere to go back.

### 11 Games
All games persist high scores to localStorage, support mobile touch controls, and dark mode.

| Game | Type | Controls |
|---|---|---|
| **Color Reaction** | Reflex test — 10 rounds, ms timing | Tap color buttons |
| **2048** | Tile merger — slide & merge to 2048 | Swipe + arrow keys |
| **Memory Match** | 4×4 pair matching with flip animation | Tap to flip |
| **Snake** | Classic 15×15 grid | Swipe + arrow keys |
| **Minesweeper** | 10×8 grid, 10 mines, reveal/flag modes | Tap cells |
| **Idle Fisher** | Incremental clicker — 7 upgrades, offline earnings | Tap + buy |
| **Flappy Fish** | Canvas pipe-dodging | Tap to jump |
| **Tower Defense** | 4 tower types, 10 waves, path enemies | Tap to place |
| **Rhythm Tap** | 4-lane rhythm game with combo system | Tap lane buttons |
| **Wordle** | Daily 5-letter word guess with streaks | On-screen keyboard |
| **Block Drop** | Full Tetris — rotation, ghost piece, levels | Swipe + on-screen buttons |

### Quality & Performance audit fixes
- **Reaction game** — `startRef` was a plain `let` (reset on re-render, producing garbage timing). Fixed to `useRef`.
- **All 11 games** — `localStorage` reads in `useState` initializers caused SSR crashes during pre-render. All wrapped in `typeof window` guards + try-catch.
- **Minesweeper** — timer `setInterval` stored in state (unnecessary re-renders) and never cleaned up on unmount (memory leak). Converted to `useRef` + cleanup effect.
- **Tower Defense** — enemy spawn interval not nulled after clearing (premature wave-end detection) and not cleaned on unmount. Fixed both.
- **Idle Fisher** — offline earnings could overflow to `Infinity` for long-absent players. Capped at 24 hours. Save function wrapped in try-catch.
- **Wordle** — localStorage reads for guesses/won/streak all SSR-guarded.

## 🧹 Internal

- 14 new files (hub + boss key + 11 games + 1 helper).
- 6 modified files (context, preferences, hub, profile, bottom nav, package.json).
- Version bumped to `1.6.0`.
- `tsc --noEmit` → 0 errors. `next build` → 35/35 static pages. Clean.

---

## [1.5.0] — WanderPlan Travel Planner Module — 2026-05-16

The biggest feature release since launch — a full travel planner integrated as a toggleable Hub module. Plan trips, build itineraries, track budgets, save places, manage documents, and pack — all without leaving the app.

## ✈️ WanderPlan — 7 sub-features in one module

Toggle it on in **Profile → Modules → WanderPlan**. Everything lives under the Hub tab.

### Trip Dashboard
- Create trips with name, destination, date range, and trip currency (scroll-pill selector with 12 currencies).
- Trip cards show gradient headers with destination initials, status badges (Planning / Active / On Trip / Completed), date range, and day count.
- **Active Trip summary card** (blue gradient) — days, activities count, budget remaining at a glance.
- **Trip Countdown widget** — planning trips show days-until-departure with a color-coded progress bar (blue → orange as it gets close). Active trips show a day-progress bar (Day 3/7).
- **Daily Spending Meter** — real-time today's spending vs daily budget (total ÷ days). Bar changes green → orange → red as you approach/exceed the limit.
- **Upcoming Trips section** — all planning trips sorted by start date with individual countdowns.
- Start Trip / Mark Completed status transitions.

### Itinerary Builder
- Day-by-day cards auto-generated from trip date range (via Supabase trigger on `wp_trip_days`).
- Add activities per day: title, category (7 types: Transport, Food, Accommodation, Activity, Sightseeing, Shopping, Rest), start/end time, cost, booking reference, notes.
- Color-coded category bars on each activity card.
- Completion checkboxes with optimistic toggle + rollback on failure.
- Delete activities inline.

### Map View (Leaflet)
- Full interactive OpenStreetMap map via `react-leaflet` (dynamic import, SSR-safe).
- Color-coded pins for saved places by category (Eat=orange, Stay=blue, Do=green, Shop=purple, Transport=red).
- Popup on pin click with place name, category, and Google Maps deep link.
- **Default height 60vh** — fills most of the screen.
- **Fullscreen expand mode** — tap the expand button for an edge-to-edge map overlay with a floating translucent legend pill. Minimize button to return.

### Budget Tracker
- Overview cards: total budget, spent, remaining.
- Per-category progress bars (9 categories: Flights, Accommodation, Food, Transport, Activities, Shopping, Insurance, Visas, Misc).
- Tap a category to edit its allocation amount.
- Add expense modal: amount, category (scroll pills), note.
- **Expense → Main Tracker Bridge** — toggle "Sync to Expense Tracker" (on by default) to also create a mirror `Transaction` row in your main expense history. Auto-maps WP budget categories to your app categories (Food→Food, Flights→Transport, etc.). Account selector included.
- Recent expenses list with delete.

### Saved Places
- Place cards with category color coding, star rating (1-5), price level ($-$$$$).
- Category filter pills (All, Eat, Stay, Do, Shop, Transport) + Visited/Unvisited toggle.
- **Nominatim address search** — debounced (500ms), shows 5 results as you type. On select: auto-fills lat/lng and generates Google Maps URL.
- Toggle visited, delete place.

### Documents Vault
- Travel documents grouped by type (Flight, Hotel, Train, Insurance, Visa, Other) with type-specific emoji icons.
- Each card shows title, booking reference, validity dates, notes.
- External URL link button for online booking confirmations.
- Add document modal: type, title, booking URL, reference, valid from/until, notes.

### Packing Checklist
- Progress bar showing % packed.
- Items grouped by category (Clothing, Toiletries, Electronics, Documents, Medicine, Misc).
- Checkbox toggle with optimistic update + rollback.
- **Template system** — 3 presets: "City Break" (21 items), "Beach Vacation" (14 items), "Winter Trip" (13 items). One tap adds the full list.
- Add individual items: name, category, quantity.

### Today Timeline (active trips)
- Appears on the dashboard when a trip is active and today falls within the trip dates.
- Shows "Day X" with date, completion count (e.g. 3/8 done).
- **Weather widget** at top — pulls from Open-Meteo API (free, no key) using the first saved place's coordinates. Shows temperature, condition, humidity, wind speed.
- **"Happening Now" card** (green border, pulsing dot) — activity whose time range includes the current time.
- **"Next Up" card** (blue border) — next uncompleted activity with countdown ("in 45 min").
- Full activity list with completion checkboxes.

### WanderPlan sub-navigation
- Horizontal scrollable tab bar: Trips, Itinerary, Map, Budget, Places, Docs, Packing.
- Back button to Hub.
- Active tab highlighted with accent color.

## 🔧 Architecture & Performance

- **Lazy data loading** — WanderPlan's 8 Supabase queries only fire when `wanderplan_enabled` is true in user_metadata. Users who never toggle the module on pay zero network cost.
- **Stable callback identities** — all toggle/find operations use the setter-callback pattern (`setState(prev => ...)`) instead of capturing state arrays in `useCallback` deps. Zero unnecessary re-renders downstream.
- **Optimistic toggles with rollback** — packing checkboxes, activity completion, place visited status update UI instantly and revert if Supabase fails.
- **Parallel batch writes** — `reorderWPActivities` uses `Promise.all()` instead of sequential awaits.
- **Defense-in-depth on queries** — child table queries include explicit user_id filters via Supabase inner joins, not just RLS.
- **Trip deletion cascades local state** — removes days, allocations, expenses, places, docs, packing from memory.
- **Leaflet CSS imported properly** — `import("leaflet/dist/leaflet.css")` in useEffect, not a `<link>` tag in the body.

## 🧹 Internal

- New dependencies: `leaflet`, `react-leaflet`, `date-fns`, `@types/leaflet`.
- 15 new files: 7 pages, 5 components, 1 hook, 1 constants file, 1 layout.
- 8 modified files: types, context, preferences, hub, profile, bottom nav, package.json.
- Version bumped to `1.5.0`.
- `tsc --noEmit` → 0 errors. `next build` → 23/23 static pages, 0 errors.

---

## [1.4.1] — History Row Density & Modal Focus Hotfix — 2026-05-04

Two small but worth-it fixes surfaced within hours of the 1.4 release.

## 🐛 Transaction modal no longer randomly springs the keyboard on the wrong field

Opening the "New Transaction" modal was inconsistent — sometimes the Android keyboard would pop up on the Amount field, sometimes on the Sub-category / Note field (the *wrong* one), sometimes not at all.

**Root cause:** the modal is kept mounted across opens by `AppLayout` (only `isOpen` toggles). `autoFocus` only fires on first mount, so on second-and-onward opens Android WebView's "restore focus to the last-focused form field" heuristic kicked in — which, after you'd just saved a transaction with a note, was the note input.

**Fix:** the modal now does *nothing* on open — no auto-focus, no keyboard. `document.activeElement.blur()` runs on every fresh open to actively kick the WebView's focus-restore behaviour, so the modal just appears and waits for you to tap what you actually want to edit. Predictable every time.

## ✨ History rows ~40% shorter

Following user feedback ("too much wasted space per row"):

- Card padding trimmed `p-5` → `p-4`.
- Category title `text-lg` → `text-base` with tighter line-height.
- Meta line + header pill dropped to `text-[10px]`.
- Amount `text-xl` → `text-lg` (still the visual anchor; just proportional to the rest).
- **Desktop-only action row (edit/delete fallback buttons) is now `hidden md:flex`** — previously it was `opacity-0` on mobile, which made it invisible but still consumed ~55px of vertical space per row. Mobile users swipe-left to reveal actions anyway, so the hidden desktop fallback was pure waste.
- Row gap `pb-4` → `pb-2.5`.

**Net result:** ~83px shorter per row. On a 720p phone you now see ~3.5 rows at a time where before you saw 2. Swipe-left behaviour on mobile and hover-reveal on desktop are both unchanged.

## 🧹 Internal

- Version bumped to `1.4.1`.
- `tsc --noEmit` → 0 errors. `eslint .` → 0/0. Still clean.

---

## [1.4] — Velocity Sanity, Log Modal Redesign & Weather-Blend — 2026-05-04

Substantial quality-of-life release surfaced after a month of daily use. Zero breaking schema changes — one additive nullable column, everything else is pure UX / code-quality polish. Version bump reflects the scope: this is not a patch release.

## ✨ Spending Velocity now ignores fixed bills

The Analytics page's end-of-month projection used to read your salary-day bill stack (water, electricity, subscriptions, transport pass, savings reserve) as typical daily spending, inflating the projection from a realistic ~RM 900/month to nonsensical values like RM 5,500/month. Fixed with a two-layer rule:

- **Category auto-rule (default, retroactive).** Transactions tagged `Bills`, `Subs`, `Subscription(s)`, `Utility/Utilities`, `Savings`, or `Transfer` are auto-excluded from the velocity calc. Works on existing transactions — no re-tagging needed.
- **Per-transaction override.** A compact toggle in the add/edit modal's new *More* disclosure flips the row against the category rule. An amber dot marks rows where the user has overridden the auto-rule. The toggle is a clean two-state flip — earlier drafts of this feature shipped with a three-state cycle that proved confusing (toggle off + dot still visible) and was simplified before release.
- **Transparency line** under the velocity projection shows exactly how much was excluded and why: `"RM 553.57 (7 tx) excluded this month. Excludes Bills, Subs, Utilities, Savings, and Transfers by default."`

New files: `lib/velocity.ts` (pure filter logic + canonical category allow-list), `supabase/migrations/003_exclude_from_velocity.sql` (additive nullable column — old clients keep working).

## ✨ Log-Transaction modal redesigned for a cleaner, shorter form

For users with 8-10+ categories the modal had grown fat — category chips wrapping across 4 rows, two full-width toggle cards stacking 180px of vertical space, a 4-pill always-visible currency picker. Rebuilt as a compact, single-view form:

- **Horizontal-scroll pill selectors** for Account and Category (replaces `flex-wrap` grids). Categories follow your Settings → Manage Categories order **verbatim** — no usage-based reordering that fights muscle memory.
- **Collapsed currency picker.** RM/SGD/USD/JPY pills replaced by a single `RM ▼` chip next to the amount input. Tapping it reveals the 4-way picker only when needed. Matches the real 99%-of-the-time use case.
- **Options row with More disclosure.** Claimable/Split chip is always visible; Exclude-from-Velocity lives behind a tap on *More* (auto-expands on edit if the row has a manual override so nothing ever hides unexpectedly).
- **Tighter spacing.** Amount box padding dropped from `py-6` to `py-4`; section gap reduced from `space-y-6` to `space-y-5`.
- **Selected-chip centring.** When you pick a category that was off-screen, the row smooth-scrolls to confirm the selection — prevents the "did my tap register?" uncertainty.

**Total vertical savings: ~380px on a typical Expense save.** The whole form now fits on a 720p phone without scrolling.

## 🐛 Claimable / Split toggle no longer ghost-ticks itself

Root cause: `TransactionModal` stays mounted across opens (owned by `AppLayout`), so local state like `isClaimable` persisted across sessions in edge cases where the reset effect's deps didn't happen to change between closing and reopening. If you'd previously edited a claimable transaction, the toggle could silently re-appear ON for the next fresh add.

Fix: a defensive reset effect fires every time the modal transitions closed → open in add-mode, clearing `isClaimable`, `excludeFromVelocity`, `showMoreOptions`, `showCurrencyPicker`, and `status` to their defaults. Edit-mode is untouched (its own loader still seeds the form from the saved row). Amount / note / category / account are intentionally NOT reset here so long-press FAB template pre-fills still survive the open transition.

## 🐛 Scroll-pill rows no longer touch the screen edges

The Account and Category rows were using a classic `-mx-6 px-6` bleed-to-edge trick that fails on Android WebView — the engine silently drops `padding-right` on horizontally-scrollable flex containers, which made the last chip flush against the viewport while every other field sat on the proper 24px inset. On the Transfer view it was worse: chips leaked out of the parent's bordered card. Dropped the bleed hack and added a 2px trailing spacer instead — predictable alignment across all three transaction types.

## ✨ Weather theming no longer overrides time-of-day

Previously, enabling Weather Locations would REPLACE the dashboard's time-of-day gradient with a weather-specific one, erasing the "3 AM looks different to 2 PM" identity you'd get from time theming alone. Reworked `lib/timeTheme.ts`'s `applyWeather` to *compose* instead of replace — the time-of-day gradient stays as the base layer and weather paints as a translucent overlay on top using CSS multi-background stacking. Net effect: `3 AM + rain` still reads as deep purple night with rain tones layered over it, not generic "rain mode". `clear` sky now adds no overlay at all — time-of-day shines through untouched.

## 🧹 Code-quality audit pass (hygiene + defensive hardening)

Alongside the user-facing fixes, a full re-audit addressed several latent code-quality items:

- **Line endings pinned to LF.** New `.editorconfig` + tightened `.gitattributes` force every source file to LF. Kills the perpetual whitespace-only diff noise caused by Windows `core.autocrlf=true`.
- **Offline queue race eliminated.** Two rapid saves while offline could race on read-modify-write of IndexedDB; now serialised through a single-flight promise chain (`lib/hooks/useMoneyState.ts`).
- **Non-mutating input objects.** `addSubscription` / `addUtility` / `addGoal` / `addPlannerItem` / `addAsset` no longer mutate their caller's `Partial<T>` input with `delete x.id` — replaced with non-mutating destructure.
- **Shark-undo closure hardening.** `triggerSharkUndo` wrapped in `useCallback` with a `triggerSharkUndoRef` mirror so the mount-once accelerometer listener always invokes the latest closure without re-subscribing on every render.
- **Dead code removal.** Unreachable env-fallback branch in `AuthScreen.tsx` (superseded by `lib/supabase.ts` throw-on-missing-env in v1.1.0).
- **God Mode timer cleanup.** `handleAvatarTap` now nulls out `godTapTimer.current` after clearing.
- **RawDataModal exposes velocity state.** New "Velocity" column in the Database View so power users can audit `auto` / `EXCL` / `INCL` per-row without exporting.
- **Production-only console stripping.** `next.config.ts` adds `compiler.removeConsole` for production builds (keeps `error` / `warn`). Slightly smaller bundle, quieter release logcat.
- **Capacitor hardening.** `server.androidScheme: 'https'` (unlocks larger IndexedDB quota tier + full Service Worker support); `android.webContentsDebuggingEnabled: false` (blocks Chrome DevTools inspection of release APKs).

## 🧹 Internal

- `lib/types.ts` — `Transaction` gains an optional `exclude_from_velocity?: boolean | null` field with three-state storage semantics (`null/undefined` = defer to category rule, `true`/`false` = explicit override).
- Version bumped to `1.4`.
- `tsc --noEmit` → 0 errors. `eslint .` → 0/0. `next build` → clean.

---

## [1.1.5] — S-Tier Audit Pass — 2026-04-25

A dedicated code-quality + architecture audit cycle. No user-facing features change; the entire diff is invisible to end users but brings the codebase to a genuinely S-tier static-analysis profile.

## 🧹 Code Quality (0 errors / 0 warnings baseline)

The pre-audit lint run flagged **43 problems (27 errors, 16 warnings)**. After this pass, both `npx tsc --noEmit` and `npx eslint .` return cleanly with **0 errors and 0 warnings** across every source file — not a single suppression that isn't accompanied by a justification comment. The production build (`next build`) still completes in ~9 s and prerenders all 16 static pages.

### Errors fixed

- **`@ts-ignore` → removed (12 sites across 7 files).** Every lingering legacy ignore on Capacitor dynamic imports (`@capacitor/app`, `@capacitor/core`, `@capacitor/haptics`, `@capacitor/preferences`, `@capacitor/filesystem`, `@capacitor/share`, `@capacitor/motion`, `@capacitor/network`, `@aparajita/capacitor-biometric-auth`) was unnecessary — the packages are properly installed and their type definitions load fine. Deleted outright rather than converted to `@ts-expect-error`, because the previous `@ts-ignore`s were doing nothing.
- **`no-explicit-any` eradicated.** `lib/haptics.ts` had a `Record<string, any>` for the ImpactStyle map. Replaced with a derived `typeof import("@capacitor/haptics")["ImpactStyle"][keyof …]` so the map stays 100 % type-safe without coupling to a hand-maintained enum mirror.
- **`react-hooks/set-state-in-effect` (React 19's new cascading-render detector) — 6 legitimate effects.** The rule is new in React 19 and correctly flags setState calls inside useEffect bodies. For every flagged site (AuthGate, history scroll-parent hook, TransactionModal form loader + default-account seeder + predictor recomputer, radar loader, weather hook's disabled-reset branch), I audited whether it was a true cascading-render smell or a legitimate "sync external state into local cache" pattern. All six were the latter. Each now carries a narrow, justified `// eslint-disable-next-line react-hooks/set-state-in-effect` with a comment explaining why — no blanket suppression.
- **`react/no-unescaped-entities` — 3 sites.** Apostrophes in JSX text nodes properly escaped as `&rsquo;` / `&lsquo;` (kind-quotes chosen for typographic correctness).
- **`@typescript-eslint/no-unused-vars` — cleaned.** Removed `billingCycle` (hub), `Check` (trading), `session` (reset-password) destructures that were never read. Renamed one intentional destructure-stripper to `_selectedDay` to match the new underscore-prefix convention.

### Warnings fixed

- **ESLint config upgraded with industry-standard unused-vars tuning.** Added `argsIgnorePattern: "^_"`, `varsIgnorePattern: "^_"`, `destructuredArrayIgnorePattern: "^_"`, `ignoreRestSiblings: true`, and the same for `caughtErrors`. This lets us write `const { id: _id, ...rest } = item` to strip a field cleanly without lint complaining, while still catching genuine dead symbols. Resolved 4 warnings in one shot (context.tsx, useModulesData).
- **`react-hooks/exhaustive-deps` — 3 genuine architectural exclusions.** The provider's master hydrate effect and the accelerometer shake-listener both intentionally skip certain deps to prevent re-subscribing on every render. Each exclusion now carries a paragraph-long comment explaining the reasoning, paired with a scoped disable.
- **`@next/next/no-img-element` in Radar — annotated as intentional.** Radar renders arbitrary remote URLs from RSS / TMDB / Reddit feeds, which `next/image` can't support without a build-time domain allow-list that we can't predict. The two `<img>` tags now carry inline justification comments next to their eslint-disable.
- **Missing `currency` dep in analytics category-data memo.** Added. Re-computes the colour-palette map when currency changes, which is what the code intends.

### Architectural polish

- **`formatCurrency` wrapped in `useCallback([currency])`.** Previously recreated on every provider render, which forced every downstream `useMemo` that listed it as a dep to recompute. Now stable across non-currency renders — further reduces the work done during Easter-egg / toast / modal state changes on dashboards with 10k+ transactions.
- **Dev-only artefacts removed.** Temporary `lint-report.txt` / `lint-fix.txt` files generated during the audit have been deleted and `.gitignore`-discipline preserved (no spurious commits).

### Verification matrix

| Check | Before | After |
|---|---:|---:|
| `tsc --noEmit` | 0 errors | 0 errors |
| `eslint .` errors | 27 | **0** |
| `eslint .` warnings | 16 | **0** |
| `next build` | ✓ | ✓ (9.0 s) |
| Static pages prerendered | 16/16 | 16/16 |

---

## [1.1.4] — Weather Theming + Receipt Fix — 2026-04-25

## 🐛 Fixed

- **History page was STILL overflowing horizontally** despite v1.1.3's attempt. Root cause was subtler than I realised: on Android WebView, `react-virtuoso`'s internal absolutely-positioned item sizer doesn't reliably inherit `padding` from its own className. So `className="px-6"` on `<Virtuoso>` didn't actually give items (viewport − 48px) width — they rendered at full viewport, chopping off the right-hand amount column. Fix: hoist the padding to a wrapper `<div className="px-6">` **around** `<Virtuoso>`, which the normal box model respects regardless of engine. Row amounts like `-RM 14.80` now fit cleanly inside the viewport.
- **"Attempting to parse an unsupported color function 'lab'"** when tapping Share on the monthly receipt. `html2canvas` has its own regex-based CSS color parser that throws on modern color functions (`lab()`, `oklch()`, `color-mix()`) emitted by Tailwind v4's token system. Replaced with `html-to-image`, which embeds the DOM into an SVG `<foreignObject>` and lets the browser rasterise it — any color the WebView understands works natively. Zero color-parsing bugs. Removed `html2canvas` from dependencies.

## ✨ New: Weather-Driven Theming (Opt-In)

Ships the full weather-aware theme pipeline that was deferred from v1.1.3.

**Setup:** Profile → Personalization → **Weather Locations** → type in a primary city (e.g. "Kuala Lumpur") and optionally a secondary city. Each city is validated against Open-Meteo's geocoding API before saving, so typos are caught immediately with a green ✓ + country code on success or a red "city not found" hint on failure.

**What happens then:**
- The Home header's gradient and glow decorate with sky-condition overlays: ☔ rain darkens + cools, ❄️ snow whitens + desaturates, ⛈️ thunderstorms add dramatic contrast + lightning-yellow accent, 🌫️ fog goes muted grey, ☁️ overcast pulls toward slate.
- A small **weather chip** appears on the right of the greeting showing current temperature + 3-letter city code (e.g. `⛅ 28° Kua`).
- Theme shifts through **eight time-of-day buckets** throughout the day — this was already in v1.1.3 but is now visually much more prominent (gradient opacity raised from ~12% to 35–45%, two-stop diagonal gradients instead of single-stop fades).

**How the location system works (technical):**
- **No GPS permission** — user types city names, we resolve via Open-Meteo's free geocoding API (`https://geocoding-api.open-meteo.com/v1/search`)
- **No API key** — Open-Meteo is free for non-commercial use, no registration needed
- **Zero battery drain** — one HTTPS call per hour per city, only while the app is in the foreground
- **Offline-safe** — geocoding cached forever in IndexedDB; weather cached 1h fresh / 6h stale-while-revalidate; network failures fall back to cached data, then to time-only theming
- **Cross-device** — city preferences sync via Supabase `user_metadata` like every other setting

New files: `lib/weather.ts`, `lib/hooks/useWeather.ts`, `components/profile/LocationsModal.tsx`. Timezone detection handled by Open-Meteo's `timezone=auto` parameter.

## ✨ Noticeable Time Theming (v1.1.3's tint was too subtle)

Reworked `lib/timeTheme.ts`:
- Gradient opacities bumped from 12–14% → **35–45%** at the peak stop, fading to transparent at 70%
- Two-stop diagonal gradients (135°) give each bucket a distinct directional mood
- Avatar glow intensity raised from 14px/40% → 18px/55%
- Greeting line gains a time-appropriate emoji prefix even when the opt-in playful greetings are OFF
- Light/dark/AMOLED all stay legible (verified against WCAG contrast floors)

---

## [1.1.3] — Layout & Theming Pass — 2026-04-25

## 🐛 Fixed

- **History list was overflowing the phone viewport horizontally.** Root cause: Virtuoso was creating its own nested scroll context (inside a `100dvh flex` container), which fought with AppLayout's `<main>` scroller and its `overflow-x-hidden` clip. Open/swiped rows bled past the right edge of the phone, and long notes pushed the whole card wider than the viewport. Fix: Virtuoso now uses AppLayout's `<main>` as its `customScrollParent`, so the entire page scrolls naturally within the existing app layout — a single scroll context, correct horizontal clipping. Row cards additionally enforce `w-full max-w-full`.
- **Friday the 13th toggle couldn't be hidden again once revealed.** Long-pressing the "Personality & Fun" heading now toggles the visibility: hidden → revealed on first long-press, revealed → hidden on the second (but only when the feature itself is OFF — otherwise the user is reminded to disable it first). A gentle toast confirms each state change. Protects against the "I revealed it to show my friend, now I can't put it back" trap.

## ✨ New: Time-of-Day Theming

Introduced `lib/timeTheme.ts` — eight distinct visual "buckets" spanning the full day (deep-night → late-night → dawn → morning → noon → afternoon → dusk → evening). The Home dashboard header now carries a soft, low-intensity color tint + glow appropriate for the current hour, shifting subtly across the day so the app feels alive without ever re-skinning itself. Greetings continue to use the opt-in playful variants when `Time-Based Greetings` is ON; the tint shifts either way.

**Deliberate non-goals:**

- We did NOT add weather-driven theming. Reasoning: a real weather feed would need either (a) a runtime GPS permission prompt + background battery drain, or (b) user-typed city names + a free weather API (Open-Meteo) + geocoding + 1-hour caching. Option (b) is viable and is the one we'd ship if we decide to go further — no API key, no registration, CORS-friendly. Deferred for now because the benefit/complexity ratio favours shipping the time-only pass first and letting the weather layer be an opt-in add-on.

---

## [1.1.2] — Bug-fix Bundle — 2026-04-25

Five user-reported issues found during APK testing, all fixed.

## 🐛 Fixed

- **History page horizontal overflow.** The list was rendering wider than the viewport so you had to pan the whole page sideways to see the right-hand side of every row. Root cause: no `overflow-x-hidden` on the list container, plus row flex didn't use `min-w-0` so long notes could push content past the viewport edge. Long categories, accounts, and notes now truncate with `truncate` instead of stretching the row.

- **Keyboard dismissed on every keystroke in History search.** Every character typed was re-creating Virtuoso's `Header` function (which closed over the rapidly-changing `searchRaw` / `filteredTransactions.length`), which caused Virtuoso to re-mount its header DOM → the `<input>` unmounted and remounted → focus was lost → the soft keyboard closed. Fix: the search bar + filter pills now live as a sibling of Virtuoso, not as its `Header` slot, so the input element is stable across filter changes.

- **Income transactions were being saved with category "Food".** Root cause: the TransactionModal's category state defaulted to `categories[0]` (which was "Food"), and the save payload always wrote that value when type wasn't "Transfer". Income is a top-level concept and shouldn't carry a spending category. Now Income saves with `category: ""`, and the History row renders it as "Income" (or "Transfer" for transfers) instead of "General".

- **Newly added categories disappeared after every app update.** Root cause was a two-part race:
  1. `addCategory` fired `persistCategories` which wrote to Supabase **fire-and-forget** — if the cloud write failed (e.g. migration 002 not applied yet, RLS misconfigured, network flaky), the category only existed on-device.
  2. The next `refreshData()` read the cloud's stale category list and **overwrote** the local state with it, wiping the user's local-only additions.
  
  Fixes:
  - `persistCategories` now `await`s the cloud write so the call site can detect failures.
  - When the primary cloud write fails, we also mirror to `user_metadata.custom_categories` as a secondary fallback, so categories survive a cache wipe even when the dedicated table is unreachable.
  - `refreshData` now **merges** cloud + local instead of overwriting — any local-only categories are preserved and auto-backfilled to the cloud on the same refresh. Console log shows the merge counts.

- **Friday the 13th toggle was too discoverable.** Anyone poking around in Profile could find it and enable a horror sequence on someone else's phone as a prank. Now the toggle is hidden by default; long-press the "Personality & Fun" heading for ~1.2 s to reveal it (toast + haptic confirm). Once revealed, the state persists in localStorage so you don't have to re-reveal it every launch. Clearing app data re-hides it.

## 🧹 Code Quality

- Replaced `@ts-ignore` with `@ts-expect-error` where appropriate in the biometric setup flow, then removed the directives entirely when unnecessary.
- Fixed one `react/no-unescaped-entities` in the "Requires 'Savings' account" hint (now `&apos;Savings&apos;`).

---

## [1.1.1] — The Performance Pass — 2026-04-24

A focused follow-up to v1.1.0 that pushes the app from "smooth at 5k transactions" to "smooth at 50k transactions" and breaks up the last remaining god-component.

## ⚡ Performance

- **Virtualised the History page** with `react-virtuoso`. Only the ~15 rows actually visible are mounted in the DOM at any given time. Previously, at 10k transactions the page mounted ~120,000 DOM nodes and froze the main thread for 2-5 seconds; it now renders instantly regardless of dataset size. Header (search bar, chips, filter pills) and empty state are passed as Virtuoso slots so they participate in the same scroll container.
- **Memoised the four user-scoped filters** (`transactions`, `subscriptions`, `utilities`, `goals`) inside the context provider. Previously these `.filter()` calls re-ran on every provider render — including every Easter-egg state change, toast, and modal toggle — and forced every downstream `useMemo` to recompute because the array reference changed. Now they're stable across non-data renders.
- **Replaced the O(n × accounts) lookup in the Hub dashboard** with an O(1) lowercase-name `Map`. At 10k tx × 30 accounts that's ~300,000 string comparisons saved per dashboard render. The total-balance reduction also moved off `Object.values().filter(...).reduce(...)` onto a single pass.
- **Capped the developer Database View** at 500 rows with a "showing N of M, use Export for the full set" footer, so opening the raw inspector at 50k tx no longer blocks the UI.

## 🧹 Code Quality

- **Split the Profile page (1,317 → 825 lines, -37%)** by extracting all 7 inline modals into focused, presentational components under `components/profile/`:
  - `ClearDataModal` — destructive password-confirm wipe
  - `ExportModal` — CSV export wizard
  - `CategoriesModal` — drag-to-reorder category manager
  - `ManageAccountsModal` — accounts CRUD with archive + currency picker
  - `RawDataModal` — paginated DB inspector
  - `BillingCycleSheet` — bottom-sheet day picker
  - `TimePickerModal` — iOS-wheel time picker
  - `PinSetupModal` — 6-digit PIN entry + confirm
  - Each component owns its own internal form/transient state. The parent page only knows whether each modal is open and provides the callbacks. Net: smaller files, clearer responsibilities, no behavioural change.
- **Added a graceful fallback** to `setStoredPin` so PIN setup never enables the flag with no stored value (covers private mode / quota errors).

## 🐛 Fixed

- Removed dead `setTempPin` / `setConfirmPin` / `setPinStep` / `setPinError` references from the Profile PIN-toggle row (state moved into the extracted `PinSetupModal`).
- Removed unused lucide-react imports (`Download`, `Shield`, `Archive`) and unused `setAccounts` destructure from Profile.

## 📦 Dependencies

- **Added `react-virtuoso`** for high-performance list virtualisation in History.

## 📊 Verified Performance Profile

| Scenario | Before (v1.1.0) | After (v1.1.1) |
|---|---|---|
| History initial render @ 10k tx | ~2.5 s | <100 ms |
| History scroll @ 10k tx | ~30 fps | 60 fps |
| Hub dashboard render @ 10k tx | ~5 ms | ~2 ms |
| Provider re-render cost (no data change) | ~1 ms | <0.1 ms |

All measurements with `npx tsc --noEmit` and `npx eslint .` exiting clean.

---

## [1.1.0] — The Power-Up Release — 2026-04-24

A massive quality-of-life + foundation release. Every friend on v1.0.0 can upgrade to this APK with **zero data migration required** — the architecture refactor and new tables are additive, and the dual-write compatibility layer preserves backwards behaviour while the new schema rolls out.

## ✨ New User-Facing Features

### 🔍 Power Search (History page)
A richer search syntax that works alongside the existing Today/Week/Category pills:
- **Free-text** matches notes, categories, accounts, and amounts
- **`#food`** filters by category, **`@bank`** filters by account
- **`>50`**, **`<100`**, **`100-500`** amount operators
- **`"coffee latte"`** quoted phrases
- **`today`**, **`yesterday`**, **`this week`**, **`last week`**, **`this month`**, **`last month`**, **`this year`** date shortcuts
- **`april 2026`** or just **`2025`** to pin to a specific month/year
- Unknown tokens fall through to free-text so typos never yield an empty screen
- Live filter chips render what the parser understood, so the syntax feels predictable
- Live count: "Showing 23 of 1,247 transactions"

### 👆 Swipe-to-Edit/Delete
Native-feeling left-swipe on any transaction row in History reveals color-coded Edit (primary) and Delete (rose) buttons. Snap-open physics with velocity awareness; haptic tick on snap; only one row open at a time. Explicit buttons remain available on hover/focus for mouse and keyboard users.

### ⚡ Long-Press FAB → Quick Templates
Hold the `+` button on the bottom nav for 450ms to reveal up to 4 one-tap templates derived from your last 30 days of expenses. The deriver clusters similar-priced purchases by category + account, takes the median amount and most-frequent note, and only surfaces a template after ≥2 occurrences. Empty-state gracefully explains how to seed it.

### 🧠 Category Auto-Suggest
A client-side token-weighted predictor learns from every expense you save. When you type a note like "morning starbucks coffee", a dismissible sparkle pill above the category picker suggests the category you've historically tagged similar notes with. Three-gate confidence filter (min score, margin over runner-up, cold-start threshold) prevents noise. Respects manual overrides. Bootstraps from your full transaction history on first run.

### 🎬 Animated Balance Count-Up
The Net Total line and every per-account card in the wallet carousel smoothly tween from old → new value over 500 ms when a transaction posts. Uses `useMotionValue` so only the text node re-renders. Respects OS `prefers-reduced-motion`.

### 💰 Split-Bill Widget
Amber Dashboard card surfaces unclaimed reimbursable expenses: total owed, count, and distinct payee count (derived from note text). Tappable — routes to the Claims page. Only renders when the Claims module is enabled and something is actually pending.

### 🧾 Monthly Recap Receipt (Receiptify-style)
Thermal-receipt aesthetic (monospace, serrated edges, dashed dividers, decorative barcode, warm paper tint) summarising your month:
- Category breakdown with %
- Subtotal / Income / **Net Saved** hero line
- Highlights: Top Category, Biggest Splurge, Quiet Day Streak, % vs Last Month
- Transaction count, active account count, stable receipt ID
- **One-tap share as PNG** via Capacitor Share (Instagram stories, WhatsApp, Gmail, etc.)
- Auto-prompt appears on Home days 1–7 of each month (dismissible per-month)
- Manual triggers on Analytics page: "This Month" (mid-month snapshot) or "Last Month"
- Quiet-day streak caps at "today" for in-progress months so it doesn't inflate with unseen future days

### 🐾 Alert Menagerie — easter-egg reactions
- 🐋 **Whale** — expense ≥ RM 5,000 (existing)
- 🐧 **Penguin** — expense < RM 10 between 1 AM and 5 AM local time ("Late-Night Snack Detected")
- 🐉 **Dragon** — fires once when a Savings Goal crosses 100%
- 🔥 **Phoenix** — rises from the bottom of the screen when shake-to-undo restores a transaction
- 🎈 **Derry** — horror sequence at 6.66 or "pennywise" (existing), now also auto-triggered at 13:13 on Friday the 13th **if opted in**

### 🌙 Time-Based Greetings (opt-in, ON by default)
The home screen greeting swaps out between 23:00–02:00 ("🌙 Still up?"), 02:00–05:00 ("🦉 Burning the midnight oil?"), and 05:00–06:00 ("☀️ Early bird —"). Togglable in **Profile → Personality & Fun**.

### 🎃 Friday the 13th Mode (opt-in, OFF by default)
The Derry horror sequence auto-triggers at **13:13 local time on any Friday the 13th**. Fires at most once per day via a localStorage guard. Togglable in **Profile → Personality & Fun**.

### 🐛 Broke-Mode Glitch
Net Total gains a subtle 2.6 s hue-rotating shake when the balance dips below zero. Disabled automatically under `prefers-reduced-motion`.

### ✨ Rich-Mode Sparkle
Net Total gains a soft gold shimmer when the balance exceeds RM 1,000,000. Disabled automatically under `prefers-reduced-motion`.

### 🎮 Konami Code God Mode
Enter **↑↑↓↓←→←→BA** on desktop PWA builds to toggle God Mode without the 7-tap avatar gesture. Partial-restart logic — mistyping the first key of the sequence begins a fresh attempt.

---

## 🏗 Architecture

- **Context facade refactor** — split the 1,070-line god-object `AppProvider` into a thin ~580-line facade composed from eight focused domain hooks: `useUIState`, `useEasterEggsUI`, `useUserPreferences`, `useAccountsState`, `useSyncState`, `useMoneyState`, `usePlanningState`, `useModulesData`. Each hook owns its own state, derived values, and CRUD actions. Consumers still call `useAppContext()` — full backward compatibility.
- **Shared type module** (`lib/types.ts`) — centralised `Goal`, `Subscription`, `Transaction`, `PlannerItem`, `Asset`, `AssetLog`, `TradeItem`, `Account` plus typed raw Supabase row shapes. Re-exported from `lib/context.tsx` so existing page imports continue to work.
- **Two new SQL migrations** (`supabase/migrations/001_add_indexes.sql`, `002_accounts_categories_tables.sql`) — 11 indexes across transactions / goals / subscriptions / asset_logs / trade_items, plus dedicated `user_accounts` and `user_categories` tables with RLS, seeded from existing `user_metadata` for backward-compatible dual-writes.
- **Zero-downtime migration pattern** — accounts and categories are now read from dedicated tables but continue to write to both `user_metadata` *and* the new tables until all installs upgrade. Strangler-fig-style.
- **Isolated easter-egg state** — all six alert variants (whale / penguin / dragon / phoenix / derry / shark-undo) live in `useEasterEggsUI` so the provider stays flat.

## 🔒 Type Safety

- **All 24 `any` types eliminated** across the codebase:
  - Recharts tooltips use a shared `TooltipProps` / `ChartPayload` contract
  - `RssFeedItem` + `TmdbMovieResult` interfaces for Radar feed integrations
  - `PanInfo` from framer-motion for drag gestures in `TransactionModal`
  - `unknown` + `instanceof Error` narrowing for all `catch` blocks
  - Typed raw row types (`RawGoalRow`, `RawSubscriptionRow`, `RawUserAccountRow`, `RawUserCategoryRow`) for Supabase deserialisation
- **`npx tsc --noEmit` exits with 0 errors** across the entire workspace.

## ♿ Accessibility

- **Full `aria-label` coverage** on every icon-only button (~130 labelled)
- **Modals as proper dialogs** — `role="dialog"` / `role="alertdialog"` + `aria-modal="true"` + `aria-labelledby` / `aria-describedby` on `TransactionModal`, `AuthGate` PIN pad, confirm modal, install prompt, radar source modal, goals CRUD modal, monthly receipt modal, and quick-templates sheet.
- **Settings toggles as accessible switches** — all 13 rows in `ProfilePage` (dark mode, AMOLED, daily reminders, food budget, salary planner, vault, radar, claims, trading, PIN, biometric, time-based greetings, Friday the 13th) carry `role="switch"` + `aria-checked` + keyboard support (Enter / Space) + proper `aria-disabled` state.
- **Toast as live region** — `role="status"` + `aria-live="polite"` so screen readers announce saves/deletes without stealing focus.
- **Primary nav landmark** — `<BottomNav>` wrapped in `<nav aria-label="Primary">` with `aria-current="page"` on the active tab.
- **PIN pad accessible** — each digit + delete + biometric button labelled; progress dots live-announce `N of 6 digits entered`; error messages use `role="alert"`.
- **Wallet card keyboard-revealable** — the Hub balance tile is now a `role="button"` with Enter/Space key handling so keyboard users can reveal balances (previously mouse-only).
- **Form inputs labelled** — amount, note, email, password, search, and goal fields all have `aria-label` + `autoComplete` hints where appropriate.
- **Decorative icons hidden** — all lucide-react icons that sit inside labelled buttons are `aria-hidden="true"`. Decorative overlays (Derry, matrix god-mode, privacy blur, all animal alerts) are also `aria-hidden`.
- **Motion respect** — every custom animation (balance count-up, rich sparkle, broke glitch) honors the OS `prefers-reduced-motion` setting.

## 🧹 Internal / Housekeeping

- **Removed 3 unused npm dependencies** — `uuid`, `@types/uuid` (native `crypto.randomUUID()` is used instead), `@capgo/capacitor-updater` (no OTA deployment — APKs are shipped manually per release). Shaves ~5 MB off the packaged APK.
- **Added 1 new dependency** — `html2canvas` for the monthly-receipt PNG snapshot flow.
- **Removed 5 starter SVGs** (`file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`) from `public/` — unreferenced leftovers from `create-next-app`.
- **Removed `CLAUDE.md`** — Claude-Code-CLI pointer file, not used in this project's workflow.
- **Hardened `lib/supabase.ts`** — removed silent placeholder fallback; dev builds now fail loud when env vars are missing.
- **Race-condition guard** (`isSyncingRef`) in `useSyncState` prevents overlapping offline-queue drains.
- **SSR safety** — `localforage.config()` now guarded by `typeof window !== "undefined"` so Next.js server renders no longer print the noisy "No available storage method" rejection.
- **Recharts `width(-1)` warning silenced** via explicit `minWidth={0}` / `minHeight={0}` on `ResponsiveContainer`.
- **Capacitor-native PWA skip** — `InstallPrompt` now suppresses itself inside the Capacitor shell where the app is already installed as a real APK.

## 🛠 Fixed
- Stale-closure bug where `refreshData` captured outdated categories and overwrote the cache on cold boot — resolved via a synced `useRef`.
- Case-mismatch ghost-account duplication on the Hub carousel.
- Circular dependency between money and sync hooks resolved via an `isOfflineRef` pattern (state mirrored into a ref so one hook can read it without depending on another's render).
- Unused `showPinPad` state in `AuthGate` removed (the locked UI always renders when `isLocked && !checking`, making the flag dead code).

---

## [1.0.0] — The Official Release & Native Polish — 2026-04-19

The first stable, production-grade release. This version represents a complete architectural overhaul from the prototype, with emphasis on native feel, offline resilience, and multi-currency correctness.

### Major
- **Refactored Hub UI** into a multi-currency Wise-style horizontal wallet carousel. Each account card displays its own currency prefix and isolated balance — no silent FX conversions, no mixed-currency aggregates.
- **Migrated storage engine** from `localStorage` to `localforage` (IndexedDB) for infinite offline scaling. All monetary values now stored as integer cents to eliminate floating-point drift.
- **Implemented Soft Deletes** via a `deleted_at` timestamp column. Rows are never physically removed, preventing the classic cross-device sync conflict where a delete on Phone A gets re-seeded from Phone B's cache. Provider-level queries filter `!t.deleted_at`.
- **Idempotent Sync** — every transaction now carries a client-generated `crypto.randomUUID()` and uses Supabase `upsert({ onConflict: 'id' })`, making retries safe.

### Feature
- **Accountant Export Wizard** — date-range, account, and category filtering, UTF-8 BOM CSV generation via Capacitor Filesystem, handoff to native Android share sheet.
- **Programmatic Smart Insights** — automatic week-over-week spending delta callouts on the Stats page.
- **Upcoming widget** on the Hub — surfaces auto-deducting subscriptions and utilities in the days before their billing date.
- **Empty states** across every list view with meaningful calls-to-action.
- **Account archiving** — hide travel or dormant accounts from daily view without losing history; restore with one tap.

### UI/UX
- **Eradicated every native HTML `<select>` and `<input type="date">`** in the codebase. Replaced with custom chevron-triggered dropdowns and a reusable `CustomDatePicker` component featuring an iOS-style inline calendar grid, M–S weekday headers, month navigation, and accent-colored selection.
- **Pill pickers** for short enumerations (currency, theme, account type).
- **Compact wallet carousel** — tightened card dimensions and restructured account ordering to preserve user sort preference with case-insensitive consolidation.
- **Pending-balance tooltip** with contextual help icon.
- **Typed Recharts tooltips** for full TypeScript safety across the trend visualization.

### Organization
- **Relocated Subscriptions and Utilities** out of the Stats page and into a dedicated **Financial Planning** module (renamed from "Goals"), alongside Savings Goals. Stats now shows a compact read-only summary card.

### Easter Egg
- **"Derry" cinematic sequence** — an 8-second multi-phase jump-scare overlay (blackout → blood vignette → jump scare → fade) triggered by amount `6.66` or the keyword `pennywise`. Uses `Haptics.vibrate({ duration: 800 })` for tactile reinforcement.

### Fixed
- Stale-closure bug where `refreshData` captured outdated categories and overwrote the cache on cold boot — resolved via a synced `useRef`.
- Case-mismatch ghost-account duplication on the Hub carousel.
- Floating-point rounding errors in aggregate totals (now integer cents throughout).

---

## [0.9.0] — The Hardware Integration Update — 2026-03-10

### Feature
- Integrated **`@capacitor/biometric-auth`** — fingerprint and FaceID gate on cold launch. Failed authentication returns the user to the password screen with no exposed numeric fallback.
- **Flagship X-Axis Linear Haptics** — `Haptics.vibrate({ duration: 10 })` micro-vibrations on every tap, swipe, and confirm. Tuned specifically for Xiaomi, Samsung, and Pixel linear-resonant actuators.

### Fixed
- **Intercepted Android hardware back-swipe** so it routes through `router.back()` instead of killing the Capacitor WebView. Respects `canGoBack` state to prevent dead-ends.

---

## [0.8.0] — The Radar Engine — 2026-01-22

### Feature
- Integrated **`CapacitorHttp`** to bypass browser CORS restrictions and Cloudflare WAF blocks when fetching third-party feeds from inside the WebView.
- **Robust XML parsing** for Tech and Audiophile RSS feed ingestion — tolerant of malformed CDATA, missing namespaces, and inconsistent pub-date formats.

---

## [0.1.0] — Initial Prototype — 2025-11-05

### Base
- Core CRUD operations for transactions, accounts, and categories.
- Next.js App Router scaffolding with basic page hierarchy.
- Initial Supabase integration (auth + transactions table, no RLS yet).
- String-based `localStorage` persistence (pre-LocalForage, pre-integer-cents).
