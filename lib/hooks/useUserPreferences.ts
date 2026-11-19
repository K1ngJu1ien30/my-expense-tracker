"use client";

import { useState, useCallback } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../supabase";

/**
 * useUserPreferences — owns every user-scoped setting and feature flag stored
 * in Supabase `auth.users.user_metadata`.
 *
 * Groups three categories:
 *   1. Profile preferences — userName, currency, accent.
 *   2. Money behaviour flags — includeSavings, foodBudget, salaryPlanner.
 *   3. Security flags — isPinEnabled, isBiometricEnabled.
 *   4. Module flags — vault / claims.
 *
 * Every setter writes to Supabase IFF a session is provided. The caller (the
 * provider) passes the current `session` down so this hook stays decoupled
 * from session management itself.
 *
 * Hydration from session metadata is the caller's responsibility — they call
 * `hydrateFromMetadata(session.user.user_metadata)` after login.
 */
export function useUserPreferences(session: Session | null) {
  const userId = session?.user?.id ?? null;

  const getScopedKey = useCallback(
    (base: string, explicitUserId?: string | null) => {
      const uid = explicitUserId ?? userId;
      return uid ? `${base}_${uid}` : base;
    },
    [userId]
  );

  // ─── Profile ────────────────────────────────────────────────────────────
  const [userName, setUserNameRaw] = useState("User");
  const [currency, setCurrencyRaw] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("pref_currency") || "RM";
    }
    return "RM";
  });
  const [accentColor, setAccentColorRaw] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("pref_accent_color") || "#3b82f6";
    }
    return "#3b82f6";
  });

  // ─── Money behaviour ────────────────────────────────────────────────────
  const [includeSavings, setIncludeSavingsRaw] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("include_savings");
      if (saved !== null) return saved === "true";
    }
    return true;
  });
  const [enableFoodBudget, setEnableFoodBudgetRaw] = useState(false);
  const [enableSalaryPlanner, setEnableSalaryPlannerRaw] = useState(false);
  const [foodDailyLimit, setFoodDailyLimitRaw] = useState(0);
  const [foodMonthlyLimit, setFoodMonthlyLimitRaw] = useState(0);

  // ─── Security ───────────────────────────────────────────────────────────
  const [isPinEnabled, setIsPinEnabledRaw] = useState(false);
  const [isBiometricEnabled, setIsBiometricEnabledRaw] = useState(false);

  const [isVaultEnabled, setIsVaultEnabledRaw] = useState(false);
  const [isClaimsEnabled, setIsClaimsEnabledRaw] = useState(false);

  // ─── Easter-egg flags ───────────────────────────────────────────────────
  const [enableTimeBasedGreeting, setEnableTimeBasedGreetingRaw] = useState(true);
  const [enableFridayThe13th, setEnableFridayThe13thRaw] = useState(false);

  // ─── Setters that dual-write local state + Supabase user_metadata ───────

  type Metadata = Record<string, string | number | boolean>;

  /** Internal helper — safely persists to Supabase user_metadata without throwing offline. */
  const persist = useCallback(
    async (data: Metadata) => {
      if (!userId) return;
      try {
        const { error } = await supabase.auth.updateUser({ data });
        if (error) {
          console.warn("[useUserPreferences] Failed to persist metadata:", error.message);
        }
      } catch (err) {
        console.warn("[useUserPreferences] Offline/network error persisting metadata:", err);
      }
    },
    [userId]
  );

  const setUserName = useCallback(
    async (newName: string) => {
      setUserNameRaw(newName);
      await persist({ display_name: newName });
    },
    [persist]
  );

  const setCurrency = useCallback(
    (newCurrency: string) => {
      const normalized = newCurrency || "RM";
      setCurrencyRaw(normalized);
      try {
        localStorage.setItem(getScopedKey("pref_currency"), normalized);
        localStorage.setItem("pref_currency", normalized);
      } catch {}
      void persist({ currency: normalized });
    },
    [getScopedKey, persist]
  );

  const setAccentColor = useCallback(
    (newAccent: string) => {
      const normalized = newAccent || "#3b82f6";
      setAccentColorRaw(normalized);
      try {
        localStorage.setItem(getScopedKey("pref_accent_color"), normalized);
        localStorage.setItem("pref_accent_color", normalized);
      } catch {}
      void persist({ accent_color: normalized });
    },
    [getScopedKey, persist]
  );

  const toggleIncludeSavings = useCallback(
    async (val: boolean) => {
      setIncludeSavingsRaw(val);
      try {
        localStorage.setItem(getScopedKey("include_savings"), String(val));
      } catch {}
      await persist({ include_savings: val });
    },
    [getScopedKey, persist]
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

  const toggleClaims = useCallback(
    async (val: boolean) => {
      setIsClaimsEnabledRaw(val);
      await persist({ claims_enabled: val });
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

  /**
   * Hydrate all preferences from a logged-in user's user_metadata blob.
   * Call this once after sign-in / session restore.
   */
  const hydrateFromMetadata = useCallback(
    (meta: Record<string, unknown> | undefined, email: string | undefined, explicitUserId?: string) => {
      const scope = (base: string) => (explicitUserId ? `${base}_${explicitUserId}` : getScopedKey(base));
      if (!meta) {
        setUserNameRaw(email?.split("@")[0] || "User");
        return;
      }

      const metaName = meta.display_name as string | undefined;
      const emailName = email?.split("@")[0];
      setUserNameRaw(metaName || emailName || "User");

      if (typeof meta.currency === "string" && meta.currency.trim()) {
        setCurrencyRaw(meta.currency);
        try {
          localStorage.setItem(scope("pref_currency"), meta.currency);
          localStorage.setItem("pref_currency", meta.currency);
        } catch {}
      } else if (typeof window !== "undefined") {
        const savedCur = localStorage.getItem(scope("pref_currency")) || localStorage.getItem("pref_currency");
        if (savedCur) setCurrencyRaw(savedCur);
      }

      if (typeof meta.accent_color === "string" && meta.accent_color.trim()) {
        setAccentColorRaw(meta.accent_color);
        try {
          localStorage.setItem(scope("pref_accent_color"), meta.accent_color);
          localStorage.setItem("pref_accent_color", meta.accent_color);
        } catch {}
      } else if (typeof window !== "undefined") {
        const savedAccent = localStorage.getItem(scope("pref_accent_color")) || localStorage.getItem("pref_accent_color");
        if (savedAccent) setAccentColorRaw(savedAccent);
      }

      if (meta.include_savings !== undefined) {
        const val = meta.include_savings === true;
        setIncludeSavingsRaw(val);
        try { localStorage.setItem(scope("include_savings"), String(val)); } catch {}
      } else if (typeof window !== "undefined") {
        const saved = localStorage.getItem(scope("include_savings")) ?? localStorage.getItem("include_savings");
        if (saved !== null) setIncludeSavingsRaw(saved === "true");
      }
      setEnableFoodBudgetRaw(meta.enable_food_budget === true);
      setEnableSalaryPlannerRaw(meta.enable_salary_planner === true);
      setFoodDailyLimitRaw((meta.food_daily_limit as number | undefined) ?? 0);
      setFoodMonthlyLimitRaw((meta.food_monthly_limit as number | undefined) ?? 0);
      setIsPinEnabledRaw(meta.pin_enabled === true);
      setIsBiometricEnabledRaw(meta.biometric_enabled === true);
      setIsVaultEnabledRaw(meta.vault_enabled === true);
      setIsClaimsEnabledRaw(meta.claims_enabled === true);
      setEnableTimeBasedGreetingRaw(
        meta.enable_time_based_greeting === false ? false : true
      );
      setEnableFridayThe13thRaw(meta.enable_friday_the_13th === true);
    },
    [getScopedKey]
  );

  /** Reset all preferences to defaults (called on logout). */
  const resetPreferences = useCallback(() => {
    setUserNameRaw("User");
    setCurrencyRaw("RM");
    setAccentColorRaw("#3b82f6");
    try {
      localStorage.removeItem("include_savings");
      localStorage.removeItem("pref_currency");
      localStorage.removeItem("pref_accent_color");
    } catch {}
    setIncludeSavingsRaw(true);
    setEnableFoodBudgetRaw(false);
    setEnableSalaryPlannerRaw(false);
    setFoodDailyLimitRaw(0);
    setFoodMonthlyLimitRaw(0);
    setIsPinEnabledRaw(false);
    setIsBiometricEnabledRaw(false);
    setIsVaultEnabledRaw(false);
    setIsClaimsEnabledRaw(false);
    setEnableTimeBasedGreetingRaw(true);
    setEnableFridayThe13thRaw(false);
  }, []);

  return {
    // Profile
    userName,
    setUserName,
    currency,
    setCurrency,
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
    isClaimsEnabled,
    toggleClaims,
    // Easter-egg flags
    enableTimeBasedGreeting,
    toggleTimeBasedGreeting,
    enableFridayThe13th,
    toggleFridayThe13th,
    // Lifecycle
    hydrateFromMetadata,
    resetPreferences,
  };
}
