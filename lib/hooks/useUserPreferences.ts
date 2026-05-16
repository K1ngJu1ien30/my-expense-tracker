"use client";

import { useState, useCallback } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../supabase";

/**
 * useUserPreferences — owns every user-scoped setting and feature flag stored
 * in Supabase `auth.users.user_metadata`.
 *
 * Groups three categories:
 *   1. Profile preferences — userName, currency, billingCycle, reminders.
 *   2. Money behaviour flags — includeSavings, foodBudget, salaryPlanner.
 *   3. Security flags — isPinEnabled, isBiometricEnabled.
 *   4. Module flags — vault / radar / claims / trading.
 *
 * Every setter writes to Supabase IFF a session is provided. The caller (the
 * provider) passes the current `session` down so this hook stays decoupled
 * from session management itself.
 *
 * Hydration from session metadata is the caller's responsibility — they call
 * `hydrateFromMetadata(session.user.user_metadata)` after login.
 */
export function useUserPreferences(session: Session | null) {
  // ─── Profile ────────────────────────────────────────────────────────────
  const [userName, setUserNameRaw] = useState("User");
  const [currency, setCurrency] = useState("RM");
  const [billingCycle, setBillingCycle] = useState("1");
  const [dailyReminder, setDailyReminder] = useState(false);
  const [reminderTime, setReminderTime] = useState("20:00");
  const [accentColor, setAccentColor] = useState("#3b82f6");

  // ─── Money behaviour ────────────────────────────────────────────────────
  const [includeSavings, setIncludeSavingsRaw] = useState(true);
  const [enableFoodBudget, setEnableFoodBudgetRaw] = useState(false);
  const [enableSalaryPlanner, setEnableSalaryPlannerRaw] = useState(false);
  const [foodDailyLimit, setFoodDailyLimitRaw] = useState(0);
  const [foodMonthlyLimit, setFoodMonthlyLimitRaw] = useState(0);

  // ─── Security ───────────────────────────────────────────────────────────
  const [isPinEnabled, setIsPinEnabledRaw] = useState(false);
  const [isBiometricEnabled, setIsBiometricEnabledRaw] = useState(false);

  // ─── Module flags ───────────────────────────────────────────────────────
  const [isVaultEnabled, setIsVaultEnabledRaw] = useState(false);
  const [isRadarEnabled, setIsRadarEnabledRaw] = useState(false);
  const [isClaimsEnabled, setIsClaimsEnabledRaw] = useState(false);
  const [isTradingEnabled, setIsTradingEnabledRaw] = useState(false);
  const [isWanderPlanEnabled, setIsWanderPlanEnabledRaw] = useState(false);
  const [isArcadeEnabled, setIsArcadeEnabledRaw] = useState(false);
  const [isCookMateEnabled, setIsCookMateEnabledRaw] = useState(true);

  // ─── Easter-egg flags ───────────────────────────────────────────────────
  // Greeting-line swap at different hours (2 AM owl, 5 AM early-bird, etc.).
  // ON by default — it's a gentle UX touch, not an intrusive animation.
  const [enableTimeBasedGreeting, setEnableTimeBasedGreetingRaw] = useState(true);
  // Auto-trigger the Derry horror sequence at 13:13 on any Friday the 13th.
  // OFF by default because horror is not for everyone.
  const [enableFridayThe13th, setEnableFridayThe13thRaw] = useState(false);

  // ─── Weather-driven theming ─────────────────────────────────────────────
  // User-typed city names (free-text — geocoded client-side via Open-Meteo).
  // Blank strings = feature disabled. Kept separate (primary + secondary)
  // so users on holiday can pin their home city + current city and see
  // both. Stored in user_metadata so it syncs across devices.
  const [primaryLocation, setPrimaryLocationRaw] = useState("");
  const [secondaryLocation, setSecondaryLocationRaw] = useState("");

  // ─── Setters that dual-write local state + Supabase user_metadata ───────

  type Metadata = Record<string, string | number | boolean>;

  /** Internal helper — updates local state and persists to Supabase if logged in. */
  const persist = useCallback(
    async (data: Metadata) => {
      if (session?.user) {
        await supabase.auth.updateUser({ data });
      }
    },
    [session]
  );

  const setUserName = useCallback(
    async (newName: string) => {
      setUserNameRaw(newName);
      await persist({ display_name: newName });
    },
    [persist]
  );

  const toggleIncludeSavings = useCallback(
    async (val: boolean) => {
      setIncludeSavingsRaw(val);
      await persist({ include_savings: val });
    },
    [persist]
  );

  const toggleFoodBudget = useCallback(
    async (val: boolean) => {
      setEnableFoodBudgetRaw(val);
      await persist({ enable_food_budget: val });
    },
    [persist]
  );

  const toggleSalaryPlanner = useCallback(
    async (val: boolean) => {
      setEnableSalaryPlannerRaw(val);
      await persist({ enable_salary_planner: val });
    },
    [persist]
  );

  const setFoodDailyLimit = useCallback(
    async (val: number) => {
      setFoodDailyLimitRaw(val);
      await persist({ food_daily_limit: val });
    },
    [persist]
  );

  const setFoodMonthlyLimit = useCallback(
    async (val: number) => {
      setFoodMonthlyLimitRaw(val);
      await persist({ food_monthly_limit: val });
    },
    [persist]
  );

  /**
   * Combined PIN toggle. When disabling, also clears biometric (biometric
   * requires PIN to be enabled).
   */
  const togglePin = useCallback(
    async (val: boolean) => {
      setIsPinEnabledRaw(val);
      if (!val) setIsBiometricEnabledRaw(false);
      const data: Metadata = { pin_enabled: val };
      if (!val) data.biometric_enabled = false;
      await persist(data);
    },
    [persist]
  );

  const toggleBiometric = useCallback(
    async (val: boolean) => {
      setIsBiometricEnabledRaw(val);
      await persist({ biometric_enabled: val });
    },
    [persist]
  );

  const toggleVault = useCallback(
    async (val: boolean) => {
      setIsVaultEnabledRaw(val);
      await persist({ vault_enabled: val });
    },
    [persist]
  );

  const toggleRadar = useCallback(
    async (val: boolean) => {
      setIsRadarEnabledRaw(val);
      await persist({ radar_enabled: val });
    },
    [persist]
  );

  const toggleClaims = useCallback(
    async (val: boolean) => {
      setIsClaimsEnabledRaw(val);
      await persist({ claims_enabled: val });
    },
    [persist]
  );

  const toggleTrading = useCallback(
    async (val: boolean) => {
      setIsTradingEnabledRaw(val);
      await persist({ trading_enabled: val });
    },
    [persist]
  );

  const toggleWanderPlan = useCallback(
    async (val: boolean) => {
      setIsWanderPlanEnabledRaw(val);
      await persist({ wanderplan_enabled: val });
    },
    [persist]
  );

  const toggleArcade = useCallback(
    async (val: boolean) => {
      setIsArcadeEnabledRaw(val);
      await persist({ arcade_enabled: val });
    },
    [persist]
  );

  const toggleCookMate = useCallback(
    async (val: boolean) => {
      setIsCookMateEnabledRaw(val);
      await persist({ cookmate_enabled: val });
    },
    [persist]
  );

  const toggleTimeBasedGreeting = useCallback(
    async (val: boolean) => {
      setEnableTimeBasedGreetingRaw(val);
      await persist({ enable_time_based_greeting: val });
    },
    [persist]
  );

  const toggleFridayThe13th = useCallback(
    async (val: boolean) => {
      setEnableFridayThe13thRaw(val);
      await persist({ enable_friday_the_13th: val });
    },
    [persist]
  );

  const setPrimaryLocation = useCallback(
    async (val: string) => {
      setPrimaryLocationRaw(val);
      await persist({ primary_location: val });
    },
    [persist]
  );

  const setSecondaryLocation = useCallback(
    async (val: string) => {
      setSecondaryLocationRaw(val);
      await persist({ secondary_location: val });
    },
    [persist]
  );

  /**
   * Hydrate all preferences from a logged-in user's user_metadata blob.
   * Call this once after sign-in / session restore.
   */
  const hydrateFromMetadata = useCallback(
    (meta: Record<string, unknown> | undefined, email: string | undefined) => {
      if (!meta) {
        setUserNameRaw(email?.split("@")[0] || "User");
        return;
      }

      const metaName = meta.display_name as string | undefined;
      const emailName = email?.split("@")[0];
      setUserNameRaw(metaName || emailName || "User");

      setIncludeSavingsRaw((meta.include_savings as boolean | undefined) ?? true);
      setEnableFoodBudgetRaw(meta.enable_food_budget === true);
      setEnableSalaryPlannerRaw(meta.enable_salary_planner === true);
      setFoodDailyLimitRaw((meta.food_daily_limit as number | undefined) ?? 0);
      setFoodMonthlyLimitRaw((meta.food_monthly_limit as number | undefined) ?? 0);
      setIsPinEnabledRaw(meta.pin_enabled === true);
      setIsBiometricEnabledRaw(meta.biometric_enabled === true);
      setIsVaultEnabledRaw(meta.vault_enabled === true);
      setIsRadarEnabledRaw(meta.radar_enabled === true);
      setIsClaimsEnabledRaw(meta.claims_enabled === true);
      setIsTradingEnabledRaw(meta.trading_enabled === true);
      setIsWanderPlanEnabledRaw(meta.wanderplan_enabled === true);
      setIsArcadeEnabledRaw(meta.arcade_enabled === true);
      setIsCookMateEnabledRaw(meta.cookmate_enabled !== false);
      // Greeting is ON by default unless user explicitly opted out.
      setEnableTimeBasedGreetingRaw(
        meta.enable_time_based_greeting === false ? false : true
      );
      // Horror flag is OFF by default — only ON if user explicitly opted in.
      setEnableFridayThe13thRaw(meta.enable_friday_the_13th === true);
      // Weather locations — blank strings = disabled.
      setPrimaryLocationRaw((meta.primary_location as string | undefined) || "");
      setSecondaryLocationRaw((meta.secondary_location as string | undefined) || "");
    },
    []
  );

  /** Reset all preferences to defaults (called on logout). */
  const resetPreferences = useCallback(() => {
    setUserNameRaw("User");
    setIncludeSavingsRaw(true);
    setEnableFoodBudgetRaw(false);
    setEnableSalaryPlannerRaw(false);
    setFoodDailyLimitRaw(0);
    setFoodMonthlyLimitRaw(0);
    setIsPinEnabledRaw(false);
    setIsBiometricEnabledRaw(false);
    setIsVaultEnabledRaw(false);
    setIsRadarEnabledRaw(false);
    setIsClaimsEnabledRaw(false);
    setIsTradingEnabledRaw(false);
    setIsWanderPlanEnabledRaw(false);
    setIsArcadeEnabledRaw(false);
    setIsCookMateEnabledRaw(true);
    setEnableTimeBasedGreetingRaw(true);
    setEnableFridayThe13thRaw(false);
    setPrimaryLocationRaw("");
    setSecondaryLocationRaw("");
  }, []);

  return {
    // Profile
    userName,
    setUserName,
    currency,
    setCurrency,
    billingCycle,
    setBillingCycle,
    dailyReminder,
    setDailyReminder,
    reminderTime,
    setReminderTime,
    accentColor,
    setAccentColor,
    // Money behaviour
    includeSavings,
    toggleIncludeSavings,
    enableFoodBudget,
    toggleFoodBudget,
    enableSalaryPlanner,
    toggleSalaryPlanner,
    foodDailyLimit,
    setFoodDailyLimit,
    foodMonthlyLimit,
    setFoodMonthlyLimit,
    // Security
    isPinEnabled,
    togglePin,
    isBiometricEnabled,
    toggleBiometric,
    // Module flags
    isVaultEnabled,
    toggleVault,
    isRadarEnabled,
    toggleRadar,
    isClaimsEnabled,
    toggleClaims,
    isTradingEnabled,
    toggleTrading,
    isWanderPlanEnabled,
    toggleWanderPlan,
    isArcadeEnabled,
    toggleArcade,
    isCookMateEnabled,
    toggleCookMate,
    // Easter-egg flags
    enableTimeBasedGreeting,
    toggleTimeBasedGreeting,
    enableFridayThe13th,
    toggleFridayThe13th,
    // Weather locations
    primaryLocation,
    setPrimaryLocation,
    secondaryLocation,
    setSecondaryLocation,
    // Lifecycle
    hydrateFromMetadata,
    resetPreferences,
  };
}
