# WanderPlan Module Integration Prompt

Paste this ENTIRE prompt into your Expense Tracker Pro project's CodeBuddy chat.

---

## Task

Integrate a full WanderPlan travel planner module into this app as a toggleable module. The WanderPlan Supabase tables (all prefixed `wp_`) have already been created in the same Supabase project. All tables have RLS enabled with the standard `auth.uid() = user_id` pattern. The `wp_trips` table has a trigger that auto-generates `wp_trip_days` rows on insert.

This is a LARGE feature. Implement it completely — all pages, all hooks, all components. Follow the exact same patterns used by the existing vault/trading/claims modules.

## Architecture Overview

WanderPlan is a travel planner with 7 sub-features: Trip Dashboard, Itinerary Builder, Map View (Leaflet), Budget Tracker, Saved Places, Documents Vault, and Packing Checklist. It also has an on-trip "Today View" with weather (Open-Meteo API, free, no key) and Nominatim geocoding (free, no key).

## Step 1: Install new dependencies

```bash
npm install leaflet react-leaflet date-fns
npm install -D @types/leaflet
```

## Step 2: New types — add to `lib/types.ts`

Add these types at the bottom of the existing `lib/types.ts`:

```typescript
// ═══════════════════════════════════════════════════════════════
// WanderPlan Types
// ═══════════════════════════════════════════════════════════════

export type WPTripStatus = 'planning' | 'active' | 'completed';
export type WPActivityCategory = 'transport' | 'food' | 'activity' | 'shopping' | 'rest' | 'accommodation' | 'sightseeing';
export type WPBudgetCategory = 'flights' | 'accommodation' | 'food' | 'transport' | 'activities' | 'shopping' | 'insurance' | 'visas' | 'misc';
export type WPPlaceCategory = 'eat' | 'stay' | 'do' | 'shop' | 'transport';
export type WPDocumentType = 'flight' | 'hotel' | 'train' | 'insurance' | 'visa' | 'other';
export type WPPackingCategory = 'clothing' | 'toiletries' | 'electronics' | 'documents' | 'medicine' | 'misc';

export type WPTrip = {
  id: string;
  user_id: string;
  name: string;
  destination: string;
  start_date: string;
  end_date: string;
  cover_image_url: string | null;
  currency_code: string;
  status: WPTripStatus;
  settings: Record<string, unknown>;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WPTripDay = {
  id: string;
  trip_id: string;
  date: string;
  day_number: number;
  notes: string | null;
  deleted_at: string | null;
};

export type WPActivity = {
  id: string;
  trip_day_id: string;
  title: string;
  category: WPActivityCategory;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  place_id: string | null;
  location: { lat: number; lng: number; name?: string; address?: string } | null;
  cost_amount: number | null;
  cost_currency: string | null;
  notes: string | null;
  booking_ref: string | null;
  links: { title: string; url: string }[];
  order_index: number;
  is_completed: boolean;
  deleted_at: string | null;
};

export type WPBudgetAllocation = {
  id: string;
  trip_id: string;
  category: WPBudgetCategory;
  allocated_cents: number;
  spent_cents: number;
  deleted_at: string | null;
};

export type WPTripExpense = {
  id: string;
  trip_id: string;
  activity_id: string | null;
  budget_category: WPBudgetCategory;
  amount_cents: number;
  currency_code: string;
  note: string | null;
  date: string;
  transaction_id: string | null;
  deleted_at: string | null;
};

export type WPSavedPlace = {
  id: string;
  trip_id: string;
  name: string;
  category: WPPlaceCategory;
  sub_category: string | null;
  location: { lat: number; lng: number; address?: string } | null;
  google_maps_url: string | null;
  website_url: string | null;
  rating: number | null;
  price_level: number | null;
  notes: string | null;
  tags: string[];
  opening_hours: Record<string, string> | null;
  is_visited: boolean;
  deleted_at: string | null;
};

export type WPDocument = {
  id: string;
  trip_id: string;
  type: WPDocumentType;
  title: string;
  file_url: string | null;
  file_type: 'pdf' | 'image' | 'link' | null;
  external_url: string | null;
  booking_ref: string | null;
  valid_from: string | null;
  valid_until: string | null;
  notes: string | null;
  deleted_at: string | null;
};

export type WPPackingItem = {
  id: string;
  trip_id: string;
  category: WPPackingCategory;
  item_name: string;
  quantity: number;
  is_packed: boolean;
  deleted_at: string | null;
};

export type WPWeatherData = {
  temperature: number;
  description: string;
  icon: string;
  humidity: number;
  wind_speed: number;
};
```

## Step 3: Feature flag — modify `lib/hooks/useUserPreferences.ts`

Add alongside the existing vault/radar/claims/trading flags:

```typescript
// In state declarations:
const [isWanderPlanEnabled, setIsWanderPlanEnabledRaw] = useState(false);

// In toggle functions:
const toggleWanderPlan = useCallback(async (val: boolean) => {
  setIsWanderPlanEnabledRaw(val);
  await persist({ wanderplan_enabled: val });
}, [persist]);

// In hydrateFromMetadata:
setIsWanderPlanEnabledRaw(meta.wanderplan_enabled === true);

// Return both from the hook
```

## Step 4: Thread through `lib/context.tsx`

Add `isWanderPlanEnabled` and `toggleWanderPlan` to `AppContextType`, and also add the WanderPlan hook state (see Step 6). Add a new `useWanderPlanState` hook composition in the provider.

## Step 5: Hub tile — modify `app/hub/page.tsx`

Add to the `modules` array:

```typescript
{
  href: "/wanderplan",
  icon: "✈️",
  title: "WanderPlan",
  description: "Trip planner, itinerary, budget & on-trip companion",
  color: "bg-sky-500/10",
  enabled: isWanderPlanEnabled,
},
```

## Step 6: Create `lib/hooks/useWanderPlanState.ts`

Create a new hook following the EXACT same patterns as `useModulesData.ts` / `usePlanningState.ts`. This hook manages ALL WanderPlan state:

- `wpTrips`, `wpTripDays`, `wpActivities`, `wpAllocations`, `wpExpenses`, `wpPlaces`, `wpDocuments`, `wpPackingItems` — all as useState arrays
- CRUD functions for each entity (add, update, soft-delete)
- All mutations do optimistic local state update + async Supabase write
- All Supabase table names are prefixed with `wp_` (e.g., `wp_trips`, `wp_activities`)
- `wpActiveTripId` persisted to localStorage key `wanderplan_active_trip`
- `loadWanderPlanData(userId)` function that loads all WP data from Supabase in parallel
- When creating a trip, insert into `wp_trips` then fetch the auto-generated `wp_trip_days`
- Trip expenses can optionally bridge to the main `transactions` table via `transaction_id`

Key functions needed:
```
createWPTrip(data, userId) → async, returns trip id
updateWPTrip(id, data)
deleteWPTrip(id) → soft delete
setWPTripStatus(id, status)
getWPTripDays(tripId) → filtered + sorted
createWPActivity(dayId, data)
updateWPActivity(id, data)
deleteWPActivity(id)
toggleWPActivityCompleted(id)
reorderWPActivities(dayId, orderedIds)
setWPAllocation(tripId, category, cents)
addWPExpense(tripId, data)
deleteWPExpense(id)
createWPPlace(tripId, data)
deleteWPPlace(id)
toggleWPPlaceVisited(id)
createWPDocument(tripId, data)
deleteWPDocument(id)
addWPPackingItem(tripId, data)
addWPPackingItems(tripId, items[]) → batch from templates
toggleWPPacked(id)
deleteWPPackingItem(id)
```

## Step 7: Update `BottomNav.tsx`

In the `isHub` detection, add:
```typescript
const isHub = pathname.startsWith("/hub") || pathname.startsWith("/vault") || pathname.startsWith("/goals") || pathname.startsWith("/wanderplan");
```

## Step 8: Create the WanderPlan pages

Create these pages under `app/wanderplan/`:

### `app/wanderplan/page.tsx` — Trip Dashboard
- Shows all trips as cards (gradient cover with destination initials)
- Active trip summary card (blue gradient) with stats: duration, days until/progress, activities count, budget total
- Status badges (Planning/Active/Completed)
- Create trip modal with: name, destination, date range (custom date picker), currency (dropdown), cover image URL
- Delete trip with confirmation dialog
- "Start Trip" / "Mark Completed" buttons on active trip
- When trip is active, show TodayTimeline component below the summary

### `app/wanderplan/itinerary/page.tsx` — Itinerary Builder
- Day-by-day cards, each showing its activities sorted by order_index
- Add activity button per day
- Activity cards showing: colored category bar, title, time range, cost, notes, completion checkbox
- Activity modal for create/edit with: title, category dropdown, start/end time, duration, cost (integer cents), notes, booking ref
- Delete activity with swipe or hover button

### `app/wanderplan/map/page.tsx` — Map View
- Full Leaflet map (OpenStreetMap tiles) using dynamic import with `ssr: false`
- Color-coded pins for each saved place by category (eat=orange, stay=blue, do=green, shop=purple, transport=red)
- Custom SVG marker icons
- Popup on pin click with place name + "Navigate" link (Google Maps deep link)
- Import leaflet CSS: `import 'leaflet/dist/leaflet.css'`

### `app/wanderplan/budget/page.tsx` — Budget Tracker
- Overview cards: total budget, spent, remaining
- Per-category progress bars (colored by category)
- Click category to edit allocation amount
- Add expense modal: amount (cents), category, currency, date, note
- Recent expenses list with delete

### `app/wanderplan/places/page.tsx` — Saved Places
- Place cards with category color coding, rating stars, price level ($-$$$$)
- Category filter pills (All, Eat, Stay, Do, Shop, Transport)
- Visited/Unvisited filter
- Add place modal with:
  - Name, category, sub-category
  - **Nominatim address search** (debounced, 500ms): as user types in location field, call `https://nominatim.openstreetmap.org/search?q={query}&format=json&limit=5` with `User-Agent: WanderPlan/1.0` header. Show results in dropdown. On select, auto-fill lat/lng and Google Maps URL
  - Rating (1-5), price level (1-4)
  - Notes, tags (add/remove)
- Toggle visited, delete place

### `app/wanderplan/documents/page.tsx` — Documents Vault
- Document cards by type (flight, hotel, train, insurance, visa, other)
- Type icon, title, booking reference, validity dates
- External URL link button
- Add document modal: type, title, booking URL, booking ref, valid from/until, notes

### `app/wanderplan/packing/page.tsx` — Packing Checklist
- Progress bar showing % packed
- Items grouped by category (clothing, toiletries, electronics, documents, medicine, misc)
- Checkbox toggle for packed status
- Add item modal: name, category, quantity
- Template system: "City Break", "Beach Vacation", "Winter Trip" — each adds a preset list of items
- Delete items

### `app/wanderplan/layout.tsx` — WanderPlan sub-navigation
- Create a simple tab bar or top nav for switching between: Dashboard, Itinerary, Map, Budget, Places, Documents, Packing
- Back button to return to Hub

## Step 9: Weather Widget component

Create `components/wanderplan/WeatherWidget.tsx`:
- Fetch from Open-Meteo API: `https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lng}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=auto`
- Display: temperature, weather description, humidity, wind speed
- Weather code mapping: 0=Clear, 1-3=Cloudy, 45-48=Fog, 51-55=Drizzle, 61-65=Rain, 71-77=Snow, 80-82=Showers, 95-99=Thunderstorm
- SVG weather icons matching each condition

## Step 10: Today Timeline component

Create `components/wanderplan/TodayTimeline.tsx`:
- Shows on the dashboard when trip status is 'active'
- Header: "Day X" with date, completion count (e.g., 3/8 activities done)
- Weather widget at top (using first saved place's coordinates)
- "Happening Now" card (green border, pulsing dot) — activity whose time range includes current time
- "Next Up" card (blue border) — next uncompleted activity with countdown ("in 45 min")
- Full activity list for the day with completion checkboxes

## Step 11: Trip expense → main transaction bridge (optional but powerful)

When adding a trip expense, optionally also create a main `transactions` row:
```typescript
// In addWPExpense, after inserting into wp_trip_expenses:
if (bridgeToMainTracker) {
  await addTransaction({
    type: 'Expense',
    amount: amountCents / 100,
    category: mapWPCategoryToMainCategory(budgetCategory),
    account: selectedAccount,
    date: expenseDate,
    note: `[Trip: ${tripName}] ${expenseNote}`,
  });
}
```
This makes trip expenses appear in the main expense history, analytics, and monthly receipts.

## Step 12: WanderPlan constants

Create `lib/wanderplanConstants.ts` with:
- Activity category colors: transport=#ef4444, food=#f97316, accommodation=#3b82f6, activity=#22c55e, sightseeing=#22c55e, shopping=#a855f7, rest=#9ca3af
- Budget category colors and labels
- Place category colors: eat=#f97316, stay=#3b82f6, do=#22c55e, shop=#a855f7, transport=#ef4444
- Document type labels and icons
- Packing category labels
- Currency list (USD, EUR, GBP, JPY, CNY, KRW, THB, RM, SGD, etc.)
- Packing templates: "City Break" (21 items), "Beach Vacation" (14 items), "Winter Trip" (13 items)

## Step 13: Profile module toggle

In the Profile page's modules section (where vault/radar/claims/trading toggles live), add:
```
WanderPlan — Trip planner, itinerary & on-trip companion
[toggle: isWanderPlanEnabled / toggleWanderPlan]
```

## Design Notes

- Follow the EXACT same visual language as the rest of the app: rounded-3xl cards, same text sizes, same spacing, same color tokens
- Use the existing CustomDatePicker and CustomDropdown components — do NOT create new ones
- Use the existing toast system (`triggerToast`) — do NOT create a separate one
- Use the existing confirm dialog (`confirmAction`) for destructive actions
- All animations should use Framer Motion and respect `prefers-reduced-motion`
- The Leaflet map MUST use dynamic import with `{ ssr: false }` to avoid SSR crashes
- Dark mode must work — use the existing `dark:` Tailwind classes
- Mobile-first, same bottom nav

## Supabase Table Names (all prefixed wp_)

- `wp_trips` — trips with user_id, status, dates, currency
- `wp_trip_days` — auto-generated by trigger on trip insert
- `wp_activities` — itinerary items linked to days
- `wp_budget_allocations` — per-category budget limits
- `wp_trip_expenses` — expense records with optional `transaction_id` bridge
- `wp_saved_places` — places with geocoding data, tags, ratings
- `wp_documents` — travel documents with booking refs and URLs
- `wp_packing_lists` — packing items with packed status

All tables have `deleted_at` for soft deletes. Filter with `!deleted_at` in all queries.

Now implement ALL of this. Create every file, every component, every page. Follow the existing app patterns exactly. Make sure `tsc --noEmit` passes and `next build` succeeds before declaring done.
