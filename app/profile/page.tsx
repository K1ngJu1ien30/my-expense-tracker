"use client";

import { Trash2, Tags, Moon, ChevronRight, Edit2, Check, Bell, CircleDollarSign, Calendar, ShieldAlert, Palette, Database, LogOut, Lock, Wallet, PiggyBank, UtensilsCrossed, TrendingUp, Fingerprint, Package, Radio, CreditCard, FileSpreadsheet, Cloud } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useAppContext } from "@/lib/context";
import { exportDataToCSV } from "@/lib/exportUtils";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { ClearDataModal } from "@/components/profile/ClearDataModal";
import { ExportModal } from "@/components/profile/ExportModal";
import { CategoriesModal } from "@/components/profile/CategoriesModal";
import { ManageAccountsModal } from "@/components/profile/ManageAccountsModal";
import { RawDataModal } from "@/components/profile/RawDataModal";
import { BillingCycleSheet } from "@/components/profile/BillingCycleSheet";
import { TimePickerModal } from "@/components/profile/TimePickerModal";
import { PinSetupModal } from "@/components/profile/PinSetupModal";
import { LocationsModal } from "@/components/profile/LocationsModal";
import { setStoredPin } from "@/components/AuthGate";

const ACCENT_COLORS = [
  { name: 'Blue', hex: '#3b82f6', bg: 'bg-blue-500' },
  { name: 'Emerald', hex: '#10b981', bg: 'bg-emerald-500' },
  { name: 'Yellow', hex: '#eab308', bg: 'bg-yellow-500' },
  { name: 'Purple', hex: '#a855f7', bg: 'bg-purple-500' },
  { name: 'Rose', hex: '#f43f5e', bg: 'bg-rose-500' }
];

// Helper: lets a clickable <div> row act like a real switch for keyboard users.
// Wrap a toggle handler with this and spread onto the row via `onKeyDown`.
const switchKey = (fn: () => void) => (e: React.KeyboardEvent) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fn();
  }
};

export default function ProfilePage() {
  const { 
    userName, setUserName, 
    currency, setCurrency, 
    billingCycle, setBillingCycle, 
    dailyReminder, setDailyReminder,
    reminderTime, setReminderTime,
    categories, setCategories, addCategory, deleteCategory,
    accounts, accountObjects, reorderAccounts, addAccount, renameAccount, deleteAccount, toggleArchiveAccount,
    accentColor, setAccentColor, confirmAction,
    triggerToast,
    transactions, subscriptions, goals, utilities,
    includeSavings, toggleIncludeSavings,
    enableFoodBudget, toggleFoodBudget, enableSalaryPlanner, toggleSalaryPlanner,
    foodDailyLimit, setFoodDailyLimit, foodMonthlyLimit, setFoodMonthlyLimit,
    isVaultEnabled, toggleVault,
    isRadarEnabled, toggleRadar,
    isPinEnabled, togglePin, isBiometricEnabled, toggleBiometric,
    isClaimsEnabled, toggleClaims,
    isTradingEnabled, toggleTrading,
    isWanderPlanEnabled, toggleWanderPlan,
    isArcadeEnabled, toggleArcade,
    isCookMateEnabled, toggleCookMate,
    enableTimeBasedGreeting, toggleTimeBasedGreeting,
    enableFridayThe13th, toggleFridayThe13th,
    primaryLocation, setPrimaryLocation,
    secondaryLocation, setSecondaryLocation,
    session
  } = useAppContext();

  const hasSavingsAccount = accountObjects.some(acc => acc.name.toLowerCase().includes('saving'));

  const [darkMode, setDarkMode] = useState(false);
  const [amoledMode, setAmoledMode] = useState(false);
  useEffect(() => {
     setDarkMode(document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark');
     setAmoledMode(localStorage.getItem('amoled') === 'true');
  }, []);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");

  // Modal visibility flags. State for the modal interiors (form inputs, drag
  // values, PIN entry, etc.) is owned by the modal components themselves —
  // this page only knows whether each modal is open.
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [showAccountsModal, setShowAccountsModal] = useState(false);
  const [showRawDataModal, setShowRawDataModal] = useState(false);
  const [showBillingSheet, setShowBillingSheet] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [showLocationsModal, setShowLocationsModal] = useState(false);

  // Time picker temp state — stays here because we need to seed it from
  // `reminderTime` and write back via `setReminderTime` when the user saves.
  const [tempHour, setTempHour] = useState("08");
  const [tempMin, setTempMin] = useState("30");
  const [tempAmPm, setTempAmPm] = useState("PM");

  // Loading / form state for the two modals that need parent-side async.
  const [exportLoading, setExportLoading] = useState(false);
  const [clearPassword, setClearPassword] = useState("");
  const [clearLoading, setClearLoading] = useState(false);

  useEffect(() => {
    if (document.documentElement.classList.contains('dark')) setDarkMode(true);
    
    if (reminderTime) {
      const parts = reminderTime.split(" ");
      if (parts.length === 2) {
        const [hh, mm] = parts[0].split(":");
        setTempHour(hh || "08");
        setTempMin(mm || "30");
        setTempAmPm(parts[1] || "PM");
      }
    }
  }, [reminderTime]);

  const saveName = () => {
    if (tempName.trim()) setUserName(tempName);
    setIsEditingName(false);
    triggerToast("Profile updated!");
  };

  const saveTime = () => {
    setReminderTime(`${tempHour}:${tempMin} ${tempAmPm}`);
    setShowTimeModal(false);
    triggerToast(`Reminder time set to ${tempHour}:${tempMin} ${tempAmPm}`);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    triggerToast("Signed out successfully.");
  };

  const handleExport = async (filter: "month" | "all") => {
    setExportLoading(true);
    try {
      const now = new Date();
      const monthString = filter === "month"
        ? now.toLocaleString("en-US", { month: "long", year: "numeric" })
        : null;
      await exportDataToCSV(transactions, monthString, currency);
      triggerToast(`✅ Exported ${filter === "month" ? "this month's" : "all"} transactions!`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Export failed.";
      triggerToast(message);
    } finally {
      setExportLoading(false);
      setShowExportModal(false);
    }
  };

  const handleClearData = async () => {
    if (!clearPassword) return;
    setClearLoading(true);
    try {
      const email = session?.user?.email;
      if (!email) throw new Error("No active session email found.");
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password: clearPassword });
      if (authError) throw new Error("Incorrect password. Data not cleared.");
      
      const { error } = await supabase.from('transactions').delete().eq('user_id', session.user.id);
      if (error) throw new Error(error.message);
      
      triggerToast("✅ All data wiped successfully.");
      setShowClearModal(false);
      setClearPassword("");
      setTimeout(() => window.location.reload(), 1000);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      triggerToast(`Error: ${message}`);
    } finally {
      setClearLoading(false);
    }
  };

  const handlePinSuccess = async (pin: string) => {
    try {
      await setStoredPin(pin);
    } catch {
      // setStoredPin already falls back to localStorage internally; if even
      // that fails (private mode, quota), persist the bare minimum so the
      // PIN flag isn't enabled with no stored value.
      try { localStorage.setItem("app_lock_pin", pin); } catch {}
    }
    togglePin(true);
    setShowPinSetup(false);
    triggerToast("PIN Lock enabled!");
  };

  // ─── Secret reveal: Friday-the-13th toggle ─────────────────────────────
  // Long-press the "Personality & Fun" heading for 1.2 s to toggle the
  // Friday-the-13th mode's VISIBILITY (not the mode itself). Hidden by
  // default so curious friends who poke around in Profile don't accidentally
  // find a horror sequence to enable on someone else's phone.
  //
  // If the option is currently revealed but DISABLED, a second long-press
  // re-hides it. If it's revealed AND enabled, we don't auto-hide it —
  // that would look like the toggle broke. The user has to disable the
  // feature first, then long-press to hide.
  //
  // Persisted via localStorage so the visibility survives relaunches.
  // Clearing the app data resets it back to hidden.
  const [fridayRevealed, setFridayRevealed] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setFridayRevealed(localStorage.getItem("friday13_revealed") === "true");
  }, []);
  const fridayRevealTimer = useRef<NodeJS.Timeout | null>(null);
  const startFridayReveal = () => {
    fridayRevealTimer.current = setTimeout(() => {
      if (!fridayRevealed) {
        // Reveal
        setFridayRevealed(true);
        try { localStorage.setItem("friday13_revealed", "true"); } catch {}
        triggerToast("🎃 A hidden option has appeared…");
        if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([30, 20, 40]);
      } else if (!enableFridayThe13th) {
        // Re-hide (only allowed when the feature itself is OFF, otherwise
        // it would look like the toggle silently vanished).
        setFridayRevealed(false);
        try { localStorage.removeItem("friday13_revealed"); } catch {}
        triggerToast("🫥 Hidden again.");
        if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(30);
      } else {
        // Revealed + enabled — tell the user what to do.
        triggerToast("Disable Friday the 13th first to hide it.");
      }
    }, 1200);
  };
  const cancelFridayReveal = () => {
    if (fridayRevealTimer.current) {
      clearTimeout(fridayRevealTimer.current);
      fridayRevealTimer.current = null;
    }
  };


  return (
    <div className="p-6 animate-in fade-in duration-500 space-y-8 pb-[120px] overflow-x-hidden min-h-screen relative">
      <h1 className="text-2xl font-bold pt-2 mb-6 text-foreground">Profile</h1>

      {/* User Info Section */}
      <div className="flex items-center gap-4 mb-8">
        <div style={{ backgroundColor: `${accentColor}1A`, borderColor: `${accentColor}33` }} className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center border-2 border-primary/20 shadow-sm shrink-0">
           <span style={{ color: accentColor }} className="font-black text-2xl">{userName.charAt(0).toUpperCase()}</span>
        </div>
        <div className="flex-1">
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <input autoFocus value={tempName} onChange={e=>setTempName(e.target.value)} aria-label="User name" className="bg-muted px-2 py-1 rounded text-lg font-bold outline-none w-32 text-foreground" />
              <button type="button" aria-label="Save name" style={{ backgroundColor: accentColor }} onClick={saveName} className="p-2 text-primary-foreground rounded-md shadow-soft"><Check className="w-4 h-4" aria-hidden="true" /></button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-foreground">{userName}</h2>
              <button type="button" aria-label="Edit name" onClick={() => { setTempName(userName); setIsEditingName(true); }} className="text-muted-foreground hover:text-foreground transition-colors"><Edit2 className="w-4 h-4" aria-hidden="true" /></button>
            </div>
          )}
          <p className="text-muted-foreground text-sm font-medium">{session?.user?.email || `${userName}'s Finance Tracker`}</p>
        </div>
      </div>

      {/* Advanced Settings */}
      <div>
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 px-2">Account Defaults</h3>
        <div className="bg-card rounded-3xl shadow-soft border border-border/40 overflow-hidden relative">
          <button 
            onClick={() => setShowBillingSheet(true)}
            className="w-full flex items-center justify-between p-4 border-b border-border/40 active:bg-muted/50 transition-colors text-left cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="bg-orange-500/10 p-2 rounded-xl text-orange-500"><Calendar className="w-5 h-5" /></div>
              <span className="font-semibold text-foreground text-sm">Billing Cycle</span>
            </div>
            <span style={{ color: accentColor, backgroundColor: `${accentColor}1A`, borderColor: `${accentColor}33` }} className="text-xs font-bold px-3 py-1 rounded-full border transition-colors">Day {billingCycle}</span>
          </button>
          
          <div className="w-full flex w-full items-center justify-between p-4 active:bg-muted/50 transition-colors text-left relative">
            <div className="flex items-center gap-3">
              <div className="bg-green-500/10 p-2 rounded-xl text-green-500"><CircleDollarSign className="w-5 h-5" /></div>
              <span className="font-semibold text-foreground text-sm">Base Currency</span>
            </div>
            <div className="flex bg-muted/60 p-1 rounded-xl">
               {["RM", "SGD", "USD", "JPY"].map(cur => (
                 <button 
                   key={cur}
                   onClick={() => {
                     setCurrency(cur);
                     triggerToast("Currency: " + cur);
                     if(typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(20);
                   }}
                   style={currency === cur ? { backgroundColor: accentColor, color: '#fff' } : {}}
                   className={`px-3 py-1.5 text-[10px] font-black tracking-wider rounded-lg transition-all ${currency === cur ? 'shadow-sm scale-110 z-10' : 'text-muted-foreground hover:text-foreground'}`}
                 >
                   {cur}
                 </button>
               ))}
            </div>
          </div>
        </div>
      </div>

      {/* Personalization */}
      <div>
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 px-2">Personalization</h3>
        <div className="bg-card rounded-3xl shadow-soft border border-border/40 overflow-hidden relative">
        
          <div className="w-full flex w-full items-center justify-between p-4 border-b border-border/40 active:bg-muted/50 transition-colors text-left relative">
            <div className="flex items-center gap-3">
              <div className="bg-pink-500/10 p-2 rounded-xl text-pink-500"><Palette className="w-5 h-5" /></div>
              <span className="font-semibold text-foreground text-sm">Accent Color</span>
            </div>
            <div className="flex gap-2">
               {ACCENT_COLORS.map(color => (
                 <button 
                   key={color.name}
                   onClick={() => {
                     setAccentColor(color.hex);
                     triggerToast(`Accent changed to ${color.name}`);
                     if(typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(20);
                   }}
                   style={{ backgroundColor: color.hex }}
                   className={`w-6 h-6 rounded-full transition-all ${accentColor === color.hex ? 'scale-125 shadow-md shadow-black/20 border-2 border-white dark:border-card' : 'opacity-50 hover:opacity-100 hover:scale-110'}`}
                 />
               ))}
            </div>
          </div>

          {/* Weather Locations — opens a modal that lets the user pin a
              primary + secondary city for weather-aware theming. Shows a
              summary line when configured. */}
          <button
            onClick={() => setShowLocationsModal(true)}
            className="w-full flex items-center justify-between p-4 border-b border-border/40 active:bg-muted/50 transition-colors text-left cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="bg-sky-500/10 p-2 rounded-xl text-sky-500">
                <Cloud className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <span className="font-semibold text-foreground text-sm block">Weather Locations</span>
                <p className="text-[10px] text-muted-foreground leading-none mt-0.5">
                  {primaryLocation
                    ? `${primaryLocation}${secondaryLocation ? ` · ${secondaryLocation}` : ""}`
                    : "Drives the home-screen theme"}
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
          </button>

          <div className="w-full flex items-center justify-between p-4 border-b border-border/40 active:bg-muted/50 transition-colors text-left relative">
            <div className={`flex items-center gap-3 ${hasSavingsAccount ? '' : 'opacity-50'}`}>
              <div className="bg-emerald-500/10 p-2 rounded-xl text-emerald-500"><PiggyBank className="w-5 h-5" /></div>
              <div>
                 <span className="font-semibold text-foreground text-sm block">Include Savings in Total</span>
                 {!hasSavingsAccount && <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Requires &lsquo;Savings&rsquo; account</p>}
              </div>
            </div>
            <button 
              disabled={!hasSavingsAccount}
              onClick={() => toggleIncludeSavings(!includeSavings)}
              className={`w-12 h-6 rounded-full relative transition-colors ${includeSavings && hasSavingsAccount ? 'bg-primary' : 'bg-muted-foreground/30'}`}
              style={includeSavings && hasSavingsAccount ? { backgroundColor: accentColor } : {}}
            >
              <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${includeSavings && hasSavingsAccount ? 'translate-x-6' : 'translate-x-0'} ${!hasSavingsAccount && 'opacity-50'}`} />
            </button>
          </div>

          <button onClick={() => setShowCategoriesModal(true)} className="w-full flex items-center justify-between p-4 border-b border-border/40 active:bg-muted/50 transition-colors text-left cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="bg-blue-500/10 p-2 rounded-xl text-blue-500"><Tags className="w-5 h-5" /></div>
              <span className="font-semibold text-foreground text-sm">Manage Categories</span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>

          <button onClick={() => setShowAccountsModal(true)} className="w-full flex items-center justify-between p-4 border-b border-border/40 active:bg-muted/50 transition-colors text-left cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="bg-teal-500/10 p-2 rounded-xl text-teal-500"><Wallet className="w-5 h-5" /></div>
              <span className="font-semibold text-foreground text-sm">Manage Accounts</span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
          
          <div
            role="switch"
            aria-checked={darkMode}
            aria-label="Dark mode"
            tabIndex={0}
            className="w-full flex items-center justify-between p-4 border-b border-border/40 active:bg-muted/50 transition-colors cursor-pointer"
            onClick={() => {
              const newMode = !darkMode;
              setDarkMode(newMode);
              if (newMode) {
                document.documentElement.classList.add('dark');
                localStorage.setItem('theme', 'dark');
              } else {
                document.documentElement.classList.remove('dark');
                localStorage.setItem('theme', 'light');
                // Force AMOLED off when dark mode is disabled
                setAmoledMode(false);
                localStorage.setItem('amoled', 'false');
                document.documentElement.classList.remove('amoled');
              }
            }}
            onKeyDown={switchKey(() => {
              const newMode = !darkMode;
              setDarkMode(newMode);
              if (newMode) {
                document.documentElement.classList.add('dark');
                localStorage.setItem('theme', 'dark');
              } else {
                document.documentElement.classList.remove('dark');
                localStorage.setItem('theme', 'light');
                setAmoledMode(false);
                localStorage.setItem('amoled', 'false');
                document.documentElement.classList.remove('amoled');
              }
            })}
          >
            <div className="flex items-center gap-3">
              <div className="bg-purple-500/10 p-2 rounded-xl text-purple-500"><Moon className="w-5 h-5" aria-hidden="true" /></div>
              <span className="font-semibold text-foreground text-sm">Dark Mode</span>
            </div>
            <button aria-hidden="true" tabIndex={-1} className={`w-12 h-7 rounded-full transition-colors relative flex items-center pointer-events-none ${darkMode ? 'border-transparent' : 'bg-muted border border-border'}`} style={darkMode ? { backgroundColor: accentColor } : {}}>
              <div className={`w-5 h-5 bg-card rounded-full shadow-sm absolute transition-transform ${darkMode ? 'translate-x-[24px]' : 'translate-x-[3px]'}`} />
            </button>
          </div>

          <div
            role="switch"
            aria-checked={amoledMode && darkMode}
            aria-label="AMOLED black"
            aria-disabled={!darkMode}
            tabIndex={darkMode ? 0 : -1}
            className={`w-full flex items-center justify-between p-4 border-b border-border/40 active:bg-muted/50 transition-colors cursor-pointer ${!darkMode ? 'opacity-40 pointer-events-none' : ''}`}
            onClick={() => {
              if (!darkMode) return;
              const newVal = !amoledMode;
              setAmoledMode(newVal);
              localStorage.setItem('amoled', newVal ? 'true' : 'false');
              if (newVal) {
                document.documentElement.classList.add('amoled');
              } else {
                document.documentElement.classList.remove('amoled');
              }
            }}
            onKeyDown={switchKey(() => {
              if (!darkMode) return;
              const newVal = !amoledMode;
              setAmoledMode(newVal);
              localStorage.setItem('amoled', newVal ? 'true' : 'false');
              if (newVal) document.documentElement.classList.add('amoled');
              else document.documentElement.classList.remove('amoled');
            })}
          >
            <div className="flex items-center gap-3">
              <div className="bg-zinc-800 p-2 rounded-xl text-zinc-400"><Moon className="w-5 h-5" aria-hidden="true" /></div>
              <div>
                <span className="font-semibold text-foreground text-sm block">AMOLED Black</span>
                <p className="text-[10px] text-muted-foreground leading-none mt-0.5">{!darkMode ? "Requires Dark Mode" : "Pure black for OLED screens"}</p>
              </div>
            </div>
            <button aria-hidden="true" tabIndex={-1} className={`w-12 h-7 rounded-full transition-colors relative flex items-center pointer-events-none ${amoledMode && darkMode ? 'border-transparent' : 'bg-muted border border-border'}`} style={amoledMode && darkMode ? { backgroundColor: accentColor } : {}}>
              <div className={`w-5 h-5 bg-card rounded-full shadow-sm absolute transition-transform ${amoledMode && darkMode ? 'translate-x-[24px]' : 'translate-x-[3px]'}`} />
            </button>
          </div>

          <div>
            <div role="switch" aria-checked={dailyReminder} aria-label="Daily reminders" tabIndex={0} onKeyDown={switchKey(() => setDailyReminder(!dailyReminder))} className="w-full flex items-center justify-between p-4 active:bg-muted/50 transition-colors cursor-pointer" onClick={() => setDailyReminder(!dailyReminder)}>
              <div className="flex items-center gap-3">
                <div className="bg-yellow-500/10 p-2 rounded-xl text-yellow-500"><Bell className="w-5 h-5" aria-hidden="true" /></div>
                <span className="font-semibold text-foreground text-sm">Daily Reminders</span>
              </div>
              <button aria-hidden="true" tabIndex={-1} className={`w-12 h-7 rounded-full transition-colors relative flex items-center pointer-events-none ${dailyReminder ? 'border-transparent' : 'bg-muted border border-border'}`} style={dailyReminder ? { backgroundColor: accentColor } : {}}>
                <div className={`w-5 h-5 bg-card rounded-full shadow-sm absolute transition-transform ${dailyReminder ? 'translate-x-[24px]' : 'translate-x-[3px]'}`} />
              </button>
            </div>
            
            <AnimatePresence>
              {dailyReminder && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-4 pb-4 overflow-hidden bg-muted/10 border-t border-border/50"
                >
                  <div className="flex items-center justify-between mt-4">
                     <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reminder Time</span>
                     <button 
                       onClick={() => setShowTimeModal(true)}
                       style={{ color: accentColor, borderColor: `${accentColor}33` }}
                       className="bg-card px-4 py-1.5 rounded-lg border outline-none font-black tracking-wide text-sm shadow-sm active:scale-95 transition-all"
                     >
                       {reminderTime}
                     </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Modules */}
      <div>
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 px-2">Modules</h3>
        <div className="bg-card rounded-3xl shadow-soft border border-border/40 overflow-hidden relative">

          <div>
            <div role="switch" aria-checked={enableFoodBudget} aria-label="Food budget tracker" tabIndex={0} onKeyDown={switchKey(() => toggleFoodBudget(!enableFoodBudget))} className="w-full flex items-center justify-between p-4 border-b border-border/40 active:bg-muted/50 transition-colors cursor-pointer" onClick={() => toggleFoodBudget(!enableFoodBudget)}>
              <div className="flex items-center gap-3">
                <div className="bg-orange-500/10 p-2 rounded-xl text-orange-500"><UtensilsCrossed className="w-5 h-5" aria-hidden="true" /></div>
                <div>
                  <span className="font-semibold text-foreground text-sm block">Food Budget Tracker</span>
                  <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Daily & monthly food limits</p>
                </div>
              </div>
              <button aria-hidden="true" tabIndex={-1} className={`w-12 h-7 rounded-full transition-colors relative flex items-center pointer-events-none ${enableFoodBudget ? 'border-transparent' : 'bg-muted border border-border'}`} style={enableFoodBudget ? { backgroundColor: accentColor } : {}}>
                <div className={`w-5 h-5 bg-card rounded-full shadow-sm absolute transition-transform ${enableFoodBudget ? 'translate-x-[24px]' : 'translate-x-[3px]'}`} />
              </button>
            </div>

            <AnimatePresence>
              {enableFoodBudget && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-4 pb-4 overflow-hidden bg-muted/10 border-b border-border/40"
                >
                  <div className="space-y-3 pt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Daily Limit</span>
                      <div className="flex items-center gap-1.5 bg-card rounded-lg border border-border px-3 py-1.5">
                        <span className="font-bold text-muted-foreground text-xs">{currency}</span>
                        <input
                          type="number"
                          value={foodDailyLimit || ""}
                          onChange={e => setFoodDailyLimit(Number(e.target.value))}
                          placeholder="0"
                          className="w-20 bg-transparent text-sm font-bold outline-none text-foreground text-right"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Monthly Limit</span>
                      <div className="flex items-center gap-1.5 bg-card rounded-lg border border-border px-3 py-1.5">
                        <span className="font-bold text-muted-foreground text-xs">{currency}</span>
                        <input
                          type="number"
                          value={foodMonthlyLimit || ""}
                          onChange={e => setFoodMonthlyLimit(Number(e.target.value))}
                          placeholder="0"
                          className="w-20 bg-transparent text-sm font-bold outline-none text-foreground text-right"
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div role="switch" aria-checked={enableSalaryPlanner} aria-label="Salary planner" tabIndex={0} onKeyDown={switchKey(() => toggleSalaryPlanner(!enableSalaryPlanner))} className="w-full flex items-center justify-between p-4 border-b border-border/40 active:bg-muted/50 transition-colors cursor-pointer" onClick={() => toggleSalaryPlanner(!enableSalaryPlanner)}>
            <div className="flex items-center gap-3">
              <div className="bg-cyan-500/10 p-2 rounded-xl text-cyan-500"><TrendingUp className="w-5 h-5" aria-hidden="true" /></div>
              <div>
                <span className="font-semibold text-foreground text-sm block">Salary Planner</span>
                <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Plan expenses against your balance</p>
              </div>
            </div>
            <button aria-hidden="true" tabIndex={-1} className={`w-12 h-7 rounded-full transition-colors relative flex items-center pointer-events-none ${enableSalaryPlanner ? 'border-transparent' : 'bg-muted border border-border'}`} style={enableSalaryPlanner ? { backgroundColor: accentColor } : {}}>
              <div className={`w-5 h-5 bg-card rounded-full shadow-sm absolute transition-transform ${enableSalaryPlanner ? 'translate-x-[24px]' : 'translate-x-[3px]'}`} />
            </button>
          </div>

          <div role="switch" aria-checked={isVaultEnabled} aria-label="Asset vault" tabIndex={0} onKeyDown={switchKey(() => toggleVault(!isVaultEnabled))} className="w-full flex items-center justify-between p-4 active:bg-muted/50 transition-colors cursor-pointer" onClick={() => toggleVault(!isVaultEnabled)}>
            <div className="flex items-center gap-3">
              <div className="bg-indigo-500/10 p-2 rounded-xl text-indigo-500"><Package className="w-5 h-5" aria-hidden="true" /></div>
              <div>
                <span className="font-semibold text-foreground text-sm block">Asset Vault</span>
                <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Track gear & maintenance logs</p>
              </div>
            </div>
            <button aria-hidden="true" tabIndex={-1} className={`w-12 h-7 rounded-full transition-colors relative flex items-center pointer-events-none ${isVaultEnabled ? 'border-transparent' : 'bg-muted border border-border'}`} style={isVaultEnabled ? { backgroundColor: accentColor } : {}}>
              <div className={`w-5 h-5 bg-card rounded-full shadow-sm absolute transition-transform ${isVaultEnabled ? 'translate-x-[24px]' : 'translate-x-[3px]'}`} />
            </button>
          </div>

          <div role="switch" aria-checked={isRadarEnabled} aria-label="Radar tracker" tabIndex={0} onKeyDown={switchKey(() => toggleRadar(!isRadarEnabled))} className="w-full flex items-center justify-between p-4 active:bg-muted/50 transition-colors cursor-pointer" onClick={() => toggleRadar(!isRadarEnabled)}>
            <div className="flex items-center gap-3">
              <div className="bg-purple-500/10 p-2 rounded-xl text-purple-500"><Radio className="w-5 h-5" aria-hidden="true" /></div>
              <div>
                <span className="font-semibold text-foreground text-sm block">Radar Tracker</span>
                <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Tech & entertainment news feed</p>
              </div>
            </div>
            <button aria-hidden="true" tabIndex={-1} className={`w-12 h-7 rounded-full transition-colors relative flex items-center pointer-events-none ${isRadarEnabled ? 'border-transparent' : 'bg-muted border border-border'}`} style={isRadarEnabled ? { backgroundColor: accentColor } : {}}>
              <div className={`w-5 h-5 bg-card rounded-full shadow-sm absolute transition-transform ${isRadarEnabled ? 'translate-x-[24px]' : 'translate-x-[3px]'}`} />
            </button>
          </div>

          <div role="switch" aria-checked={isClaimsEnabled} aria-label="Claims and splits" tabIndex={0} onKeyDown={switchKey(() => toggleClaims(!isClaimsEnabled))} className="w-full flex items-center justify-between p-4 active:bg-muted/50 transition-colors cursor-pointer" onClick={() => toggleClaims(!isClaimsEnabled)}>
            <div className="flex items-center gap-3">
              <div className="bg-amber-500/10 p-2 rounded-xl text-amber-500"><CreditCard className="w-5 h-5" aria-hidden="true" /></div>
              <div>
                <span className="font-semibold text-foreground text-sm block">Claims & Splits</span>
                <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Track reimbursable & shared expenses</p>
              </div>
            </div>
            <button aria-hidden="true" tabIndex={-1} className={`w-12 h-7 rounded-full transition-colors relative flex items-center pointer-events-none ${isClaimsEnabled ? 'border-transparent' : 'bg-muted border border-border'}`} style={isClaimsEnabled ? { backgroundColor: accentColor } : {}}>
              <div className={`w-5 h-5 bg-card rounded-full shadow-sm absolute transition-transform ${isClaimsEnabled ? 'translate-x-[24px]' : 'translate-x-[3px]'}`} />
            </button>
          </div>

          <div role="switch" aria-checked={isTradingEnabled} aria-label="Trading and flipping" tabIndex={0} onKeyDown={switchKey(() => toggleTrading(!isTradingEnabled))} className="w-full flex items-center justify-between p-4 active:bg-muted/50 transition-colors cursor-pointer" onClick={() => toggleTrading(!isTradingEnabled)}>
            <div className="flex items-center gap-3">
              <div className="bg-rose-500/10 p-2 rounded-xl text-rose-500"><TrendingUp className="w-5 h-5" aria-hidden="true" /></div>
              <div>
                <span className="font-semibold text-foreground text-sm block">Trading / Flipping</span>
                <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Buy low, sell high — track profits</p>
              </div>
            </div>
            <button aria-hidden="true" tabIndex={-1} className={`w-12 h-7 rounded-full transition-colors relative flex items-center pointer-events-none ${isTradingEnabled ? 'border-transparent' : 'bg-muted border border-border'}`} style={isTradingEnabled ? { backgroundColor: accentColor } : {}}>
              <div className={`w-5 h-5 bg-card rounded-full shadow-sm absolute transition-transform ${isTradingEnabled ? 'translate-x-[24px]' : 'translate-x-[3px]'}`} />
            </button>
          </div>

          <div role="switch" aria-checked={isWanderPlanEnabled} aria-label="WanderPlan travel planner" tabIndex={0} onKeyDown={switchKey(() => toggleWanderPlan(!isWanderPlanEnabled))} className="w-full flex items-center justify-between p-4 active:bg-muted/50 transition-colors cursor-pointer" onClick={() => toggleWanderPlan(!isWanderPlanEnabled)}>
            <div className="flex items-center gap-3">
              <div className="bg-sky-500/10 p-2 rounded-xl text-sky-500"><span className="text-lg" aria-hidden="true">✈️</span></div>
              <div>
                <span className="font-semibold text-foreground text-sm block">WanderPlan</span>
                <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Trip planner, itinerary & on-trip companion</p>
              </div>
            </div>
            <button aria-hidden="true" tabIndex={-1} className={`w-12 h-7 rounded-full transition-colors relative flex items-center pointer-events-none ${isWanderPlanEnabled ? 'border-transparent' : 'bg-muted border border-border'}`} style={isWanderPlanEnabled ? { backgroundColor: accentColor } : {}}>
              <div className={`w-5 h-5 bg-card rounded-full shadow-sm absolute transition-transform ${isWanderPlanEnabled ? 'translate-x-[24px]' : 'translate-x-[3px]'}`} />
            </button>
          </div>

          <div role="switch" aria-checked={isArcadeEnabled} aria-label="Slack Arcade" tabIndex={0} onKeyDown={switchKey(() => toggleArcade(!isArcadeEnabled))} className="w-full flex items-center justify-between p-4 active:bg-muted/50 transition-colors cursor-pointer" onClick={() => toggleArcade(!isArcadeEnabled)}>
            <div className="flex items-center gap-3">
              <div className="bg-indigo-500/10 p-2 rounded-xl text-indigo-500"><span className="text-lg" aria-hidden="true">🎮</span></div>
              <div>
                <span className="font-semibold text-foreground text-sm block">Slack Arcade</span>
                <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Mini-games, idle clicker & boss key</p>
              </div>
            </div>
            <button aria-hidden="true" tabIndex={-1} className={`w-12 h-7 rounded-full transition-colors relative flex items-center pointer-events-none ${isArcadeEnabled ? 'border-transparent' : 'bg-muted border border-border'}`} style={isArcadeEnabled ? { backgroundColor: accentColor } : {}}>
              <div className={`w-5 h-5 bg-card rounded-full shadow-sm absolute transition-transform ${isArcadeEnabled ? 'translate-x-[24px]' : 'translate-x-[3px]'}`} />
            </button>
          </div>

          <div role="switch" aria-checked={isCookMateEnabled} aria-label="CookMate" tabIndex={0} onKeyDown={switchKey(() => toggleCookMate(!isCookMateEnabled))} className="w-full flex items-center justify-between p-4 active:bg-muted/50 transition-colors cursor-pointer" onClick={() => toggleCookMate(!isCookMateEnabled)}>
            <div className="flex items-center gap-3">
              <div className="bg-orange-500/10 p-2 rounded-xl text-orange-500"><span className="text-lg" aria-hidden="true">🍳</span></div>
              <div>
                <span className="font-semibold text-foreground text-sm block">CookMate</span>
                <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Smart kitchen companion</p>
              </div>
            </div>
            <button aria-hidden="true" tabIndex={-1} className={`w-12 h-7 rounded-full transition-colors relative flex items-center pointer-events-none ${isCookMateEnabled ? 'border-transparent' : 'bg-muted border border-border'}`} style={isCookMateEnabled ? { backgroundColor: accentColor } : {}}>
              <div className={`w-5 h-5 bg-card rounded-full shadow-sm absolute transition-transform ${isCookMateEnabled ? 'translate-x-[24px]' : 'translate-x-[3px]'}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Personality & Fun — houses the opt-in easter-egg flags.
          Separated from Modules because these are flavour, not functionality.
          The Friday-the-13th toggle is HIDDEN by default and only appears
          after long-pressing this heading for ~1.2 s. */}
      <div>
        <h3
          className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 px-2 select-none"
          onPointerDown={startFridayReveal}
          onPointerUp={cancelFridayReveal}
          onPointerLeave={cancelFridayReveal}
          onPointerCancel={cancelFridayReveal}
        >
          Personality &amp; Fun
        </h3>
        <div className="bg-card rounded-3xl shadow-soft border border-border/40 overflow-hidden relative">

          {/* Time-based greeting swap */}
          <div
            role="switch"
            aria-checked={enableTimeBasedGreeting}
            aria-label="Time-based greetings"
            tabIndex={0}
            onKeyDown={switchKey(() => toggleTimeBasedGreeting(!enableTimeBasedGreeting))}
            className={`w-full flex items-center justify-between p-4 active:bg-muted/50 transition-colors cursor-pointer ${fridayRevealed ? 'border-b border-border/40' : ''}`}
            onClick={() => toggleTimeBasedGreeting(!enableTimeBasedGreeting)}
          >
            <div className="flex items-center gap-3">
              <div className="bg-sky-500/10 p-2 rounded-xl text-sky-500">
                <Moon className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <span className="font-semibold text-foreground text-sm block">Time-Based Greetings</span>
                <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Late-night owl, early-bird sun, and other subtle nods</p>
              </div>
            </div>
            <button aria-hidden="true" tabIndex={-1} className={`w-12 h-7 rounded-full transition-colors relative flex items-center pointer-events-none ${enableTimeBasedGreeting ? 'border-transparent' : 'bg-muted border border-border'}`} style={enableTimeBasedGreeting ? { backgroundColor: accentColor } : {}}>
              <div className={`w-5 h-5 bg-card rounded-full shadow-sm absolute transition-transform ${enableTimeBasedGreeting ? 'translate-x-[24px]' : 'translate-x-[3px]'}`} />
            </button>
          </div>

          {/* Friday the 13th auto-Derry trigger — HIDDEN unless revealed via
              long-press on the "Personality & Fun" heading. */}
          {fridayRevealed && (
          <div
            role="switch"
            aria-checked={enableFridayThe13th}
            aria-label="Friday the 13th horror sequence"
            tabIndex={0}
            onKeyDown={switchKey(() => toggleFridayThe13th(!enableFridayThe13th))}
            className="w-full flex items-center justify-between p-4 active:bg-muted/50 transition-colors cursor-pointer"
            onClick={() => toggleFridayThe13th(!enableFridayThe13th)}
          >
            <div className="flex items-center gap-3">
              <div className="bg-red-500/10 p-2 rounded-xl text-red-500">
                <ShieldAlert className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <span className="font-semibold text-foreground text-sm block">Friday the 13th Mode</span>
                <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Auto-trigger the Derry sequence at 13:13 on Fri 13 — not for everyone</p>
              </div>
            </div>
            <button aria-hidden="true" tabIndex={-1} className={`w-12 h-7 rounded-full transition-colors relative flex items-center pointer-events-none ${enableFridayThe13th ? 'border-transparent' : 'bg-muted border border-border'}`} style={enableFridayThe13th ? { backgroundColor: accentColor } : {}}>
              <div className={`w-5 h-5 bg-card rounded-full shadow-sm absolute transition-transform ${enableFridayThe13th ? 'translate-x-[24px]' : 'translate-x-[3px]'}`} />
            </button>
          </div>
          )}

        </div>
      </div>

      {/* Security & Privacy */}
      <div>
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 px-2">Security & Privacy</h3>
        <div className="bg-card rounded-3xl shadow-soft border border-border/40 overflow-hidden relative">

          {/* PIN Toggle */}
          <div
            role="switch"
            aria-checked={isPinEnabled}
            aria-label="Use PIN to login"
            tabIndex={0}
            onKeyDown={switchKey(() => {
              if (!isPinEnabled) {
                setShowPinSetup(true);
              } else {
                togglePin(false); triggerToast("PIN Lock disabled");
              }
            })}
            className="w-full flex items-center justify-between p-4 border-b border-border/40 active:bg-muted/50 transition-colors cursor-pointer"
            onClick={() => {
              if (!isPinEnabled) {
                setShowPinSetup(true);
              } else {
                togglePin(false);
                triggerToast("PIN Lock disabled");
              }
            }}
          >
            <div className="flex items-center gap-3">
              <div className="bg-red-500/10 p-2 rounded-xl text-red-500"><Lock className="w-5 h-5" aria-hidden="true" /></div>
              <div>
                <span className="font-semibold text-foreground text-sm block">Use PIN to Login</span>
                <p className="text-[10px] text-muted-foreground leading-none mt-0.5">{isPinEnabled ? "Enabled — tap to disable" : "Set a 6-digit PIN"}</p>
              </div>
            </div>
            <button aria-hidden="true" tabIndex={-1} className={`w-12 h-7 rounded-full transition-colors relative flex items-center pointer-events-none ${isPinEnabled ? 'border-transparent' : 'bg-muted border border-border'}`} style={isPinEnabled ? { backgroundColor: accentColor } : {}}>
              <div className={`w-5 h-5 bg-card rounded-full shadow-sm absolute transition-transform ${isPinEnabled ? 'translate-x-[24px]' : 'translate-x-[3px]'}`} />
            </button>
          </div>

          {/* Biometric Toggle */}
          {(() => {
            const handleBiometric = async () => {
              if (!isPinEnabled) return;
              if (!isBiometricEnabled) {
                try {
                  const { Capacitor } = await import("@capacitor/core").catch(() => ({ Capacitor: null }));
                  if (!Capacitor?.isNativePlatform()) {
                    triggerToast("Biometrics only available on mobile devices");
                    return;
                  }
                  const { BiometricAuth } = await import("@aparajita/capacitor-biometric-auth").catch(() => ({ BiometricAuth: null }));
                  if (!BiometricAuth) {
                    triggerToast("Biometric hardware not available");
                    return;
                  }
                  await BiometricAuth.authenticate({ reason: "Verify device to enable biometric login", cancelTitle: "Cancel" });
                  toggleBiometric(true);
                  triggerToast("Fingerprint / FaceID enabled!");
                } catch {
                  triggerToast("Biometric verification failed or cancelled");
                }
              } else {
                toggleBiometric(false);
                triggerToast("Biometrics disabled");
              }
            };
            return (
              <div
                role="switch"
                aria-checked={isBiometricEnabled}
                aria-label="Use fingerprint or FaceID"
                aria-disabled={!isPinEnabled}
                tabIndex={isPinEnabled ? 0 : -1}
                onKeyDown={switchKey(() => { handleBiometric(); })}
                className={`w-full flex items-center justify-between p-4 active:bg-muted/50 transition-colors cursor-pointer ${!isPinEnabled ? 'opacity-40 pointer-events-none' : ''}`}
                onClick={handleBiometric}
              >
                <div className="flex items-center gap-3">
                  <div className="bg-blue-500/10 p-2 rounded-xl text-blue-500"><Fingerprint className="w-5 h-5" aria-hidden="true" /></div>
                  <div>
                    <span className="font-semibold text-foreground text-sm block">Use Fingerprint / FaceID</span>
                    <p className="text-[10px] text-muted-foreground leading-none mt-0.5">{!isPinEnabled ? "Requires PIN to be enabled first" : isBiometricEnabled ? "Enabled — tap to disable" : "Auto-unlock with biometrics"}</p>
                  </div>
                </div>
                <button aria-hidden="true" tabIndex={-1} className={`w-12 h-7 rounded-full transition-colors relative flex items-center pointer-events-none ${isBiometricEnabled ? 'border-transparent' : 'bg-muted border border-border'}`} style={isBiometricEnabled ? { backgroundColor: accentColor } : {}}>
                  <div className={`w-5 h-5 bg-card rounded-full shadow-sm absolute transition-transform ${isBiometricEnabled ? 'translate-x-[24px]' : 'translate-x-[3px]'}`} />
                </button>
              </div>
            );
          })()}

        </div>
      </div>


      
      {/* Data Management Section */}
      <div>
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 px-2">Data Management</h3>
        <div className="bg-card rounded-3xl shadow-soft border border-border/40 overflow-hidden">
          
          <button onClick={() => setShowRawDataModal(true)} className="w-full flex items-center justify-between p-4 border-b border-border/40 active:bg-muted/50 transition-colors text-left cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-500/10 p-2 rounded-xl text-indigo-500"><Database className="w-5 h-5" /></div>
              <span className="font-semibold text-foreground text-sm">View Raw Data</span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>

          <button onClick={() => setShowExportModal(true)} className="w-full flex items-center justify-between p-4 border-b border-border/40 active:bg-muted/50 transition-colors text-left cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-500/10 p-2 rounded-xl text-emerald-500"><FileSpreadsheet className="w-5 h-5" /></div>
              <div>
                <span className="font-semibold text-foreground text-sm block">Accountant Export</span>
                <span className="text-xs text-muted-foreground font-medium">{transactions.length} transaction{transactions.length !== 1 ? "s" : ""} ready</span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
          
          <button onClick={() => { setClearPassword(""); setShowClearModal(true); }} className="w-full flex items-center justify-between p-4 active:bg-red-50 dark:active:bg-red-900/10 transition-colors text-left group cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="bg-red-500/10 p-2 rounded-xl text-red-500 group-hover:bg-red-500/20 transition-colors"><Trash2 className="w-5 h-5" /></div>
              <span className="font-semibold text-red-600 text-sm">Clear All Data</span>
            </div>
          </button>
        </div>
      </div>

      {/* Log Out */}
      <div>
        <div className="bg-card rounded-3xl shadow-soft border border-border/40 overflow-hidden">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 p-4 text-left cursor-pointer active:bg-red-50 dark:active:bg-red-900/10 transition-colors group"
          >
            <div className="bg-red-500/10 p-2 rounded-xl text-red-500 group-hover:bg-red-500/20 transition-colors">
              <LogOut className="w-5 h-5" />
            </div>
            <span className="font-bold text-red-600 text-sm">Log Out</span>
          </button>
        </div>
      </div>

      {/* Clear Data Confirm Modal */}
      <AnimatePresence>
        {showClearModal && (
          <ClearDataModal
            password={clearPassword}
            setPassword={setClearPassword}
            loading={clearLoading}
            onConfirm={handleClearData}
            onClose={() => setShowClearModal(false)}
          />
        )}
      </AnimatePresence>

      {/* Accountant Export Modal */}
      <AnimatePresence>
        {showExportModal && (
          <ExportModal
            accentColor={accentColor}
            txCount={transactions.length}
            loading={exportLoading}
            onExport={handleExport}
            onClose={() => setShowExportModal(false)}
          />
        )}
      </AnimatePresence>

      {/* Categories Reorder Modal */}
      <AnimatePresence>
        {showCategoriesModal && (
          <CategoriesModal
            categories={categories}
            setCategories={setCategories}
            addCategory={addCategory}
            deleteCategory={deleteCategory}
            accentColor={accentColor}
            onClose={() => setShowCategoriesModal(false)}
          />
        )}
      </AnimatePresence>

      {/* Manage Accounts Modal */}
      <AnimatePresence>
        {showAccountsModal && (
          <ManageAccountsModal
            accounts={accounts}
            accountObjects={accountObjects}
            reorderAccounts={reorderAccounts}
            renameAccount={renameAccount}
            toggleArchiveAccount={toggleArchiveAccount}
            deleteAccount={deleteAccount}
            addAccount={addAccount}
            confirmAction={confirmAction}
            triggerToast={triggerToast}
            accentColor={accentColor}
            onClose={() => setShowAccountsModal(false)}
          />
        )}
      </AnimatePresence>

      {/* Raw Data Modal */}
      <AnimatePresence>
        {showRawDataModal && (
          <RawDataModal
            transactions={transactions}
            subscriptions={subscriptions}
            utilities={utilities}
            goals={goals}
            currency={currency}
            accentColor={accentColor}
            onClose={() => setShowRawDataModal(false)}
          />
        )}
      </AnimatePresence>

      {/* Billing Cycle Bottom Sheet */}
      <AnimatePresence>
        {showBillingSheet && (
          <BillingCycleSheet
            current={billingCycle}
            accentColor={accentColor}
            onSelect={(day) => {
              setBillingCycle(day);
              setShowBillingSheet(false);
              triggerToast(`Billing reset day set to ${day}`);
              if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(30);
            }}
            onClose={() => setShowBillingSheet(false)}
          />
        )}
      </AnimatePresence>

      {/* Time Picker Modal */}
      <AnimatePresence>
        {showTimeModal && (
          <TimePickerModal
            accentColor={accentColor}
            tempHour={tempHour}
            setTempHour={setTempHour}
            tempMin={tempMin}
            setTempMin={setTempMin}
            tempAmPm={tempAmPm}
            setTempAmPm={setTempAmPm}
            onSave={saveTime}
            onClose={() => setShowTimeModal(false)}
          />
        )}
      </AnimatePresence>

      {/* PIN Setup Modal */}
      <AnimatePresence>
        {showPinSetup && (
          <PinSetupModal
            onSuccess={handlePinSuccess}
            onClose={() => setShowPinSetup(false)}
          />
        )}
      </AnimatePresence>

      {/* Weather Locations Modal */}
      <AnimatePresence>
        {showLocationsModal && (
          <LocationsModal
            primary={primaryLocation}
            secondary={secondaryLocation}
            onSavePrimary={setPrimaryLocation}
            onSaveSecondary={setSecondaryLocation}
            accentColor={accentColor}
            onClose={() => setShowLocationsModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
