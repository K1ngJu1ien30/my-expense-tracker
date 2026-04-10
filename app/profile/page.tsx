"use client";

import { Download, Trash2, Tags, Moon, ChevronRight, Edit2, Check, Bell, CircleDollarSign, Calendar, X, Plus, GripVertical, Shield, Palette, Database, LogOut, Lock, Wallet, PiggyBank, UtensilsCrossed, TrendingUp, Fingerprint } from "lucide-react";
import { useState, useEffect } from "react";
import { useAppContext } from "@/lib/context";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { supabase } from "@/lib/supabase";

const ACCENT_COLORS = [
  { name: 'Blue', hex: '#3b82f6', bg: 'bg-blue-500' },
  { name: 'Emerald', hex: '#10b981', bg: 'bg-emerald-500' },
  { name: 'Yellow', hex: '#eab308', bg: 'bg-yellow-500' },
  { name: 'Purple', hex: '#a855f7', bg: 'bg-purple-500' },
  { name: 'Rose', hex: '#f43f5e', bg: 'bg-rose-500' }
];

export default function ProfilePage() {
  const { 
    userName, setUserName, 
    currency, setCurrency, 
    billingCycle, setBillingCycle, 
    dailyReminder, setDailyReminder,
    reminderTime, setReminderTime,
    categories, setCategories, addCategory, deleteCategory,
    accounts, setAccounts, reorderAccounts, addAccount, renameAccount, deleteAccount,
    accentColor, setAccentColor, confirmAction,
    triggerToast,
    transactions, subscriptions, goals, utilities,
    includeSavings, toggleIncludeSavings,
    enableFoodBudget, toggleFoodBudget, enableSalaryPlanner, toggleSalaryPlanner,
    foodDailyLimit, setFoodDailyLimit, foodMonthlyLimit, setFoodMonthlyLimit,
    isAppLockEnabled, toggleAppLock,
    session
  } = useAppContext();

  const hasSavingsAccount = accounts.some(acc => acc.toLowerCase().includes('saving'));

  const [darkMode, setDarkMode] = useState(false);
  useEffect(() => {
     setDarkMode(document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark');
  }, []);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");

  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [newCat, setNewCat] = useState("");

  const [showBillingSheet, setShowBillingSheet] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [tempHour, setTempHour] = useState("08");
  const [tempMin, setTempMin] = useState("30");
  const [tempAmPm, setTempAmPm] = useState("PM");

  const [showRawDataModal, setShowRawDataModal] = useState(false);
  const [rawTab, setRawTab] = useState("Tx");

  // Clear Data modal state
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearPassword, setClearPassword] = useState("");
  const [clearLoading, setClearLoading] = useState(false);

  // Manage Accounts modal state
  const [showAccountsModal, setShowAccountsModal] = useState(false);
  const [newAccount, setNewAccount] = useState("");
  const [editingAccount, setEditingAccount] = useState<string | null>(null);
  const [editingAccountVal, setEditingAccountVal] = useState("");

  // PIN setup modal
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [pinStep, setPinStep] = useState<"enter" | "confirm">("enter");
  const [tempPin, setTempPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinError, setPinError] = useState("");

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

  const handleExportCSV = () => {
    if (transactions.length === 0) {
      triggerToast("No transactions to export.");
      return;
    }
    const headers = ["Date", "Type", "Category", "Amount", "Account", "Note"];
    const rows = transactions.map(tx => [
      new Date(tx.date).toLocaleDateString(),
      tx.type,
      tx.category || "",
      tx.amount,
      tx.account || "",
      tx.note || ""
    ]);
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "transactions_export.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    triggerToast(`✅ Exported ${transactions.length} transactions to CSV!`);
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
    } catch (e: any) {
      triggerToast(`Error: ${e.message}`);
    } finally {
      setClearLoading(false);
    }
  };

  const DAYS = Array.from({ length: 31 }, (_, i) => (i + 1).toString());

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
              <input autoFocus value={tempName} onChange={e=>setTempName(e.target.value)} className="bg-muted px-2 py-1 rounded text-lg font-bold outline-none w-32 text-foreground" />
              <button style={{ backgroundColor: accentColor }} onClick={saveName} className="p-2 text-primary-foreground rounded-md shadow-soft"><Check className="w-4 h-4" /></button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-foreground">{userName}</h2>
              <button onClick={() => { setTempName(userName); setIsEditingName(true); }} className="text-muted-foreground hover:text-foreground transition-colors"><Edit2 className="w-4 h-4" /></button>
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
              <span className="font-semibold text-foreground text-sm">Currency Format</span>
            </div>
            <div className="flex bg-muted/60 p-1 rounded-xl">
               {["RM", "MYR", "$"].map(cur => (
                 <button 
                   key={cur}
                   onClick={() => {
                     setCurrency(cur);
                     triggerToast("Currency format: " + cur);
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
          
          <div className="w-full flex items-center justify-between p-4 border-b border-border/40 active:bg-muted/50 transition-colors text-left relative">
            <div className={`flex items-center gap-3 ${hasSavingsAccount ? '' : 'opacity-50'}`}>
              <div className="bg-emerald-500/10 p-2 rounded-xl text-emerald-500"><PiggyBank className="w-5 h-5" /></div>
              <div>
                 <span className="font-semibold text-foreground text-sm block">Include Savings in Total</span>
                 {!hasSavingsAccount && <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Requires 'Savings' account</p>}
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
          
          <div className="w-full flex items-center justify-between p-4 border-b border-border/40 active:bg-muted/50 transition-colors cursor-pointer" onClick={() => { 
            const newMode = !darkMode;
            setDarkMode(newMode); 
            if (newMode) {
              document.documentElement.classList.add('dark');
              localStorage.setItem('theme', 'dark');
            } else {
              document.documentElement.classList.remove('dark');
              localStorage.setItem('theme', 'light');
            }
          }}>
            <div className="flex items-center gap-3">
              <div className="bg-purple-500/10 p-2 rounded-xl text-purple-500"><Moon className="w-5 h-5" /></div>
              <span className="font-semibold text-foreground text-sm">Dark Mode</span>
            </div>
            <button className={`w-12 h-7 rounded-full transition-colors relative flex items-center pointer-events-none ${darkMode ? 'border-transparent' : 'bg-muted border border-border'}`} style={darkMode ? { backgroundColor: accentColor } : {}}>
              <div className={`w-5 h-5 bg-card rounded-full shadow-sm absolute transition-transform ${darkMode ? 'translate-x-[24px]' : 'translate-x-[3px]'}`} />
            </button>
          </div>

          <div>
            <div className="w-full flex items-center justify-between p-4 active:bg-muted/50 transition-colors cursor-pointer" onClick={() => setDailyReminder(!dailyReminder)}>
              <div className="flex items-center gap-3">
                <div className="bg-yellow-500/10 p-2 rounded-xl text-yellow-500"><Bell className="w-5 h-5" /></div>
                <span className="font-semibold text-foreground text-sm">Daily Reminders</span>
              </div>
              <button className={`w-12 h-7 rounded-full transition-colors relative flex items-center pointer-events-none ${dailyReminder ? 'border-transparent' : 'bg-muted border border-border'}`} style={dailyReminder ? { backgroundColor: accentColor } : {}}>
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
            <div className="w-full flex items-center justify-between p-4 border-b border-border/40 active:bg-muted/50 transition-colors cursor-pointer" onClick={() => toggleFoodBudget(!enableFoodBudget)}>
              <div className="flex items-center gap-3">
                <div className="bg-orange-500/10 p-2 rounded-xl text-orange-500"><UtensilsCrossed className="w-5 h-5" /></div>
                <div>
                  <span className="font-semibold text-foreground text-sm block">Food Budget Tracker</span>
                  <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Daily & monthly food limits</p>
                </div>
              </div>
              <button className={`w-12 h-7 rounded-full transition-colors relative flex items-center pointer-events-none ${enableFoodBudget ? 'border-transparent' : 'bg-muted border border-border'}`} style={enableFoodBudget ? { backgroundColor: accentColor } : {}}>
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
                        <span className="font-bold text-muted-foreground text-xs">RM</span>
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
                        <span className="font-bold text-muted-foreground text-xs">RM</span>
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

          <div className="w-full flex items-center justify-between p-4 active:bg-muted/50 transition-colors cursor-pointer" onClick={() => toggleSalaryPlanner(!enableSalaryPlanner)}>
            <div className="flex items-center gap-3">
              <div className="bg-cyan-500/10 p-2 rounded-xl text-cyan-500"><TrendingUp className="w-5 h-5" /></div>
              <div>
                <span className="font-semibold text-foreground text-sm block">Salary Planner</span>
                <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Plan expenses against your balance</p>
              </div>
            </div>
            <button className={`w-12 h-7 rounded-full transition-colors relative flex items-center pointer-events-none ${enableSalaryPlanner ? 'border-transparent' : 'bg-muted border border-border'}`} style={enableSalaryPlanner ? { backgroundColor: accentColor } : {}}>
              <div className={`w-5 h-5 bg-card rounded-full shadow-sm absolute transition-transform ${enableSalaryPlanner ? 'translate-x-[24px]' : 'translate-x-[3px]'}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Security & Privacy */}
      <div>
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 px-2">Security & Privacy</h3>
        <div className="bg-card rounded-3xl shadow-soft border border-border/40 overflow-hidden relative">
          <div className="w-full flex items-center justify-between p-4 active:bg-muted/50 transition-colors cursor-pointer" onClick={() => {
            if (!isAppLockEnabled) {
              setTempPin("");
              setConfirmPin("");
              setPinStep("enter");
              setPinError("");
              setShowPinSetup(true);
            } else {
              toggleAppLock(false);
              triggerToast("App Lock disabled");
            }
          }}>
            <div className="flex items-center gap-3">
              <div className="bg-red-500/10 p-2 rounded-xl text-red-500"><Fingerprint className="w-5 h-5" /></div>
              <div>
                <span className="font-semibold text-foreground text-sm block">App Lock (Biometrics / PIN)</span>
                <p className="text-[10px] text-muted-foreground leading-none mt-0.5">{isAppLockEnabled ? "Enabled — tap to disable" : "Require auth on app launch"}</p>
              </div>
            </div>
            <button className={`w-12 h-7 rounded-full transition-colors relative flex items-center pointer-events-none ${isAppLockEnabled ? 'border-transparent' : 'bg-muted border border-border'}`} style={isAppLockEnabled ? { backgroundColor: accentColor } : {}}>
              <div className={`w-5 h-5 bg-card rounded-full shadow-sm absolute transition-transform ${isAppLockEnabled ? 'translate-x-[24px]' : 'translate-x-[3px]'}`} />
            </button>
          </div>
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

          <button onClick={handleExportCSV} className="w-full flex items-center justify-between p-4 border-b border-border/40 active:bg-muted/50 transition-colors text-left cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-500/10 p-2 rounded-xl text-emerald-500"><Download className="w-5 h-5" /></div>
              <div>
                <span className="font-semibold text-foreground text-sm block">Export Data to CSV</span>
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
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowClearModal(false)} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <motion.div initial={{ y: 20, opacity: 0, scale: 0.95 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 20, opacity: 0, scale: 0.95 }} className="bg-card w-full max-w-sm rounded-[2rem] shadow-heavy z-10 overflow-hidden p-6 space-y-5">
              <div className="flex justify-between items-start">
                <div>
                  <div className="bg-red-500/10 p-3 rounded-2xl w-fit mb-3">
                    <Trash2 className="w-6 h-6 text-red-500" />
                  </div>
                  <h3 className="font-bold text-lg text-foreground">Clear All Data</h3>
                  <p className="text-sm text-muted-foreground font-medium mt-1">This action is irreversible. Enter your password to confirm.</p>
                </div>
                <button onClick={() => setShowClearModal(false)} className="p-1.5 hover:bg-muted rounded-full transition-colors shrink-0"><X className="w-5 h-5 text-muted-foreground"/></button>
              </div>
              
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="password"
                  placeholder="Enter your password"
                  value={clearPassword}
                  onChange={e => setClearPassword(e.target.value)}
                  className="w-full bg-muted/60 text-sm font-semibold pl-10 pr-4 py-3.5 rounded-xl border border-border focus:border-red-500/50 outline-none transition-colors"
                />
              </div>

              <div className="flex gap-3">
                <button onClick={() => setShowClearModal(false)} className="flex-1 py-3 bg-muted rounded-xl font-bold text-sm text-muted-foreground hover:bg-border transition-colors">
                  Cancel
                </button>
                <button 
                  onClick={handleClearData}
                  disabled={clearLoading || !clearPassword}
                  className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold text-sm active:scale-95 transition-all disabled:opacity-50"
                >
                  {clearLoading ? "Verifying..." : "Wipe Data"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Categories Reorder Modal */}
      <AnimatePresence>
        {showCategoriesModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCategoriesModal(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
             <motion.div initial={{ y: 20, opacity: 0, scale: 0.95 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 20, opacity: 0, scale: 0.95 }} className="bg-card w-full max-w-sm rounded-[2rem] shadow-heavy z-10 overflow-hidden flex flex-col max-h-[85vh]">
                <div className="p-5 border-b border-border/40 flex justify-between items-center bg-muted/20">
                   <h3 className="font-bold text-foreground">Manage Categories</h3>
                   <button onClick={() => setShowCategoriesModal(false)} className="p-1.5 hover:bg-muted rounded-full transition-colors"><X className="w-5 h-5 text-muted-foreground"/></button>
                </div>
                
                <p className="px-5 pt-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-center">Drag to reorder</p>

                <div className="flex-1 overflow-y-auto p-4 hide-scrollbar">
                   <Reorder.Group axis="y" values={categories} onReorder={setCategories} className="space-y-2">
                     {categories.map((cat) => (
                       <Reorder.Item key={cat} value={cat} className="flex justify-between items-center bg-card shadow-sm p-3 rounded-xl border border-border/80 cursor-grab active:cursor-grabbing">
                          <div className="flex items-center gap-3">
                             <GripVertical className="w-4 h-4 text-muted-foreground/50" />
                             <span className="font-medium text-sm text-foreground">{cat}</span>
                          </div>
                          <button onClick={() => deleteCategory(cat)} className="text-muted-foreground hover:text-red-500 transition-colors p-1.5"><Trash2 className="w-4 h-4" /></button>
                       </Reorder.Item>
                     ))}
                   </Reorder.Group>
                   {categories.length === 0 && <p className="text-center text-sm font-medium text-muted-foreground py-4">No categories left!</p>}
                </div>

                <div className="p-4 border-t border-border/40 bg-muted/20 flex gap-2">
                   <input 
                     value={newCat} 
                     onChange={e=>setNewCat(e.target.value)} 
                     type="text" 
                     placeholder="New category..." 
                     className="flex-1 bg-card rounded-xl px-4 py-2 text-sm font-medium outline-none border border-border text-foreground" 
                     onKeyDown={(e) => { if(e.key === 'Enter' && newCat) { addCategory(newCat); setNewCat(""); } }}
                   />
                   <button style={{ backgroundColor: accentColor }} onClick={() => { if(newCat) { addCategory(newCat); setNewCat(""); } }} className="text-white p-3 rounded-xl hover:scale-[1.02] active:scale-95 transition-transform"><Plus className="w-5 h-5"/></button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Manage Accounts Modal */}
      <AnimatePresence>
        {showAccountsModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAccountsModal(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
             <motion.div initial={{ y: 20, opacity: 0, scale: 0.95 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 20, opacity: 0, scale: 0.95 }} className="bg-card w-full max-w-sm rounded-[2rem] shadow-heavy z-10 overflow-hidden flex flex-col max-h-[85vh]">
                <div className="p-5 border-b border-border/40 flex justify-between items-center bg-muted/20">
                   <h3 className="font-bold text-foreground">Manage Accounts</h3>
                   <button onClick={() => setShowAccountsModal(false)} className="p-1.5 hover:bg-muted rounded-full transition-colors"><X className="w-5 h-5 text-muted-foreground"/></button>
                </div>

                <p className="px-5 pt-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-center">Drag to reorder</p>

                <div className="flex-1 overflow-y-auto p-4 hide-scrollbar">
                   <Reorder.Group axis="y" values={accounts} onReorder={reorderAccounts} className="space-y-2">
                     {accounts.map((acc) => (
                       <Reorder.Item key={acc} value={acc} className="flex justify-between items-center bg-card shadow-sm p-3 rounded-xl border border-border/80 cursor-grab active:cursor-grabbing">
                          <div className="flex items-center gap-3 flex-1">
                             <GripVertical className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                             {editingAccount === acc ? (
                               <div className="flex items-center gap-2 flex-1">
                                 <input
                                   autoFocus
                                   value={editingAccountVal}
                                   onChange={e => setEditingAccountVal(e.target.value)}
                                   onKeyDown={e => {
                                     if (e.key === "Enter" && editingAccountVal.trim()) {
                                       renameAccount(acc, editingAccountVal.trim());
                                       setEditingAccount(null);
                                     }
                                   }}
                                   className="flex-1 bg-muted px-2 py-1 rounded-lg text-sm font-semibold outline-none text-foreground border border-border"
                                 />
                                 <button
                                   onClick={() => {
                                     if (editingAccountVal.trim()) {
                                       renameAccount(acc, editingAccountVal.trim());
                                       setEditingAccount(null);
                                       triggerToast("Account renamed!");
                                     }
                                   }}
                                   style={{ backgroundColor: accentColor }}
                                   className="p-1.5 text-white rounded-lg"
                                 >
                                   <Check className="w-3.5 h-3.5" />
                                 </button>
                               </div>
                             ) : (
                               <span className="font-medium text-sm text-foreground flex-1">{acc}</span>
                             )}
                          </div>
                          {editingAccount !== acc && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => { setEditingAccount(acc); setEditingAccountVal(acc); }}
                                className="text-muted-foreground hover:text-primary transition-colors p-1.5"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                   confirmAction("Delete Account", `Are you sure you want to remove "${acc}"?`, () => {
                                      deleteAccount(acc); 
                                      triggerToast(`"${acc}" removed.`);
                                   });
                                }}
                                className="text-muted-foreground hover:text-red-500 transition-colors p-1.5"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                       </Reorder.Item>
                     ))}
                   </Reorder.Group>
                   {accounts.length === 0 && <p className="text-center text-sm font-medium text-muted-foreground py-4">No accounts defined!</p>}
                </div>

                <div className="p-4 border-t border-border/40 bg-muted/20 flex gap-2">
                   <input
                     value={newAccount}
                     onChange={e => setNewAccount(e.target.value)}
                     type="text"
                     placeholder="New account (e.g. Maybank)"
                     className="flex-1 bg-card rounded-xl px-4 py-2 text-sm font-medium outline-none border border-border text-foreground"
                     onKeyDown={(e) => {
                       if(e.key === 'Enter' && newAccount.trim()) {
                         addAccount(newAccount.trim());
                         setNewAccount("");
                         triggerToast(`"${newAccount.trim()}" added!`);
                       }
                     }}
                   />
                   <button
                     style={{ backgroundColor: accentColor }}
                     onClick={() => {
                       if(newAccount.trim()) {
                         addAccount(newAccount.trim());
                         triggerToast(`"${newAccount.trim()}" added!`);
                         setNewAccount("");
                       }
                     }}
                     className="text-white p-3 rounded-xl hover:scale-[1.02] active:scale-95 transition-transform"
                   >
                     <Plus className="w-5 h-5"/>
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Raw Data Modal */}
      <AnimatePresence>
        {showRawDataModal && (
          <div className="fixed inset-0 z-[101] bg-card flex flex-col pt-12 pb-6 px-4">
               <div className="flex justify-between items-center pb-4 border-b border-border/50">
                  <h3 className="font-bold text-xl text-foreground flex items-center gap-2"><Database className="w-5 h-5 text-muted-foreground"/> Database View</h3>
                  <button onClick={() => setShowRawDataModal(false)} className="p-2 bg-muted hover:bg-border rounded-full transition-colors"><X className="w-5 h-5 text-muted-foreground"/></button>
               </div>
               
               <div className="flex bg-muted/60 p-1.5 rounded-xl my-6">
                  {["Tx", "Subs/Goals"].map(tab => (
                    <button 
                      key={tab}
                      onClick={() => setRawTab(tab)}
                      style={rawTab === tab ? { backgroundColor: accentColor, color: '#fff' } : {}}
                      className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${rawTab === tab ? 'shadow-sm scale-[1.02] z-10' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      {tab === "Tx" ? "Transactions" : "Subscriptions & Goals"}
                    </button>
                  ))}
               </div>

               <div className="flex-1 overflow-y-auto overflow-x-auto hide-scrollbar rounded-xl border border-border/50 shadow-inner bg-muted/10 relative">
                  {rawTab === "Tx" ? (
                     <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-muted text-muted-foreground font-bold sticky top-0 z-10">
                           <tr>
                              <th className="p-3 border-b border-border/50">ID</th>
                              <th className="p-3 border-b border-border/50">Date</th>
                              <th className="p-3 border-b border-border/50">Type</th>
                              <th className="p-3 border-b border-border/50">Category</th>
                              <th className="p-3 border-b border-border/50">Sub Category</th>
                              <th className="p-3 border-b border-border/50">Amount</th>
                              <th className="p-3 border-b border-border/50">Account</th>
                              <th className="p-3 border-b border-border/50">To Account</th>
                              <th className="p-3 border-b border-border/50">Note</th>
                           </tr>
                        </thead>
                        <tbody>
                           {transactions.length === 0 ? (
                              <tr><td colSpan={9} className="p-8 text-center text-muted-foreground font-medium">No transaction records found.</td></tr>
                           ) : (
                              transactions.map((tx, i) => (
                                 <tr key={tx.id || i} className="even:bg-muted/30 hover:bg-muted/50 transition-colors">
                                    <td className="p-3 border-b border-border/30 font-mono text-xs max-w-[100px] truncate" title={tx.id}>{tx.id || 'N/A'}</td>
                                    <td className="p-3 border-b border-border/30 text-muted-foreground">{tx.date}</td>
                                    <td className="p-3 border-b border-border/30 font-semibold">{tx.type}</td>
                                    <td className="p-3 border-b border-border/30 text-muted-foreground max-w-[100px] truncate">{tx.category}</td>
                                    <td className="p-3 border-b border-border/30 text-muted-foreground max-w-[100px] truncate">{tx.sub_category || '-'}</td>
                                    <td className="p-3 border-b border-border/30">RM {tx.amount}</td>
                                    <td className="p-3 border-b border-border/30 text-muted-foreground max-w-[90px] truncate">{tx.account || '-'}</td>
                                    <td className="p-3 border-b border-border/30 text-muted-foreground max-w-[90px] truncate">{tx.to_account || '-'}</td>
                                    <td className="p-3 border-b border-border/30 text-muted-foreground max-w-[120px] truncate">{tx.note || '-'}</td>
                                 </tr>
                              ))
                           )}
                        </tbody>
                     </table>
                  ) : (
                     <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-muted text-muted-foreground font-bold sticky top-0 z-10">
                           <tr>
                              <th className="p-4 border-b border-border/50">Type</th>
                              <th className="p-4 border-b border-border/50">Name</th>
                              <th className="p-4 border-b border-border/50">Amount/Target</th>
                              <th className="p-4 border-b border-border/50">Meta Config</th>
                           </tr>
                        </thead>
                        <tbody>
                           {subscriptions.map(s => (
                               <tr key={`sub-${s.id}`} className="even:bg-muted/30 hover:bg-muted/50 transition-colors">
                                  <td className="p-4 border-b border-border/30 font-semibold text-purple-500">Subscription</td>
                                  <td className="p-4 border-b border-border/30 font-bold">{s.name}</td>
                                  <td className="p-4 border-b border-border/30">RM {s.cost}</td>
                                  <td className="p-4 border-b border-border/30 text-xs text-muted-foreground border-l border-border/50">Day {s.billingDay} | {s.sourceAccount}</td>
                               </tr>
                           ))}
                           {utilities.map(u => (
                               <tr key={`u-${u.id}`} className="even:bg-muted/30 hover:bg-muted/50 transition-colors">
                                  <td className="p-4 border-b border-border/30 font-semibold text-yellow-500">Utility</td>
                                  <td className="p-4 border-b border-border/30 font-bold">{u.name}</td>
                                  <td className="p-4 border-b border-border/30">RM {u.cost}</td>
                                  <td className="p-4 border-b border-border/30 text-xs text-muted-foreground border-l border-border/50">Day {u.billingDay} | {u.sourceAccount}</td>
                               </tr>
                           ))}
                           {goals.map(g => (
                               <tr key={`g-${g.id}`} className="even:bg-muted/30 hover:bg-muted/50 transition-colors">
                                  <td className="p-4 border-b border-border/30 font-semibold text-emerald-500">Goal</td>
                                  <td className="p-4 border-b border-border/30 font-bold">{g.title}</td>
                                  <td className="p-4 border-b border-border/30">RM {g.current} / {g.target}</td>
                                  <td className="p-4 border-b border-border/30 text-xs text-muted-foreground border-l border-border/50">{g.isPinned ? 'Pinned' : 'Not Pinned'}</td>
                               </tr>
                           ))}
                        </tbody>
                     </table>
                  )}
               </div>
          </div>
        )}
      </AnimatePresence>

      {/* Billing Cycle Bottom Sheet */}
      <AnimatePresence>
        {showBillingSheet && (
           <>
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowBillingSheet(false)} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]" />
             <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-card rounded-t-[2.5rem] shadow-heavy z-[101] flex flex-col h-[55vh]">
               <div className="w-12 h-1.5 bg-border rounded-full mx-auto mt-4 mb-2 shrink-0 cursor-grab" />
               <div className="px-6 py-4 border-b border-border/40 shrink-0 flex justify-between items-center">
                 <h2 className="font-bold text-lg text-foreground">Select Reset Day</h2>
                 <button onClick={() => setShowBillingSheet(false)} className="p-1 px-2 bg-muted hover:bg-border rounded-full transition-colors"><X className="w-4 h-4 text-muted-foreground"/></button>
               </div>
               <div className="flex-1 overflow-y-auto p-6 grid grid-cols-5 gap-3 hide-scrollbar pb-24">
                  {DAYS.map(day => (
                    <button 
                      key={day}
                      onClick={() => { 
                         setBillingCycle(day); 
                         setShowBillingSheet(false); 
                         triggerToast(`Billing reset day set to ${day}`);
                         if(navigator.vibrate) navigator.vibrate(30);
                      }}
                      style={billingCycle === day ? { backgroundColor: accentColor, color: '#fff', boxShadow: `0 0 15px ${accentColor}4D` } : {}}
                      className={`aspect-square flex items-center justify-center rounded-2xl font-bold transition-all ${billingCycle === day ? 'scale-105' : 'bg-muted/50 hover:bg-border text-foreground'}`}
                    >
                      {day}
                    </button>
                  ))}
               </div>
             </motion.div>
           </>
        )}
      </AnimatePresence>
      
      {/* Time Picker Modal */}
      <AnimatePresence>
        {showTimeModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowTimeModal(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
             <motion.div initial={{ y: 20, opacity: 0, scale: 0.95 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 20, opacity: 0, scale: 0.95 }} className="bg-card w-full max-w-[320px] rounded-[2rem] shadow-heavy z-10 overflow-hidden flex flex-col pt-4 pb-6 px-4">
               <h3 className="font-bold text-center mb-6 text-foreground">Remind me at</h3>
               
               <div className="flex justify-between items-stretch gap-2 mb-6 h-[180px]">
                  <div className="flex-1 overflow-y-auto hide-scrollbar snap-y snap-mandatory border border-border/50 rounded-2xl p-1 bg-muted/10 relative shadow-inner">
                     <div style={{ backgroundColor: `${accentColor}1A`, borderColor: `${accentColor}33` }} className="absolute top-1/2 left-0 right-0 h-10 -mt-5 pointer-events-none rounded-xl border" />
                     <div className="h-[70px]" />
                     {Array.from({length: 12}, (_, i) => String(i+1).padStart(2, '0')).map(h => (
                        <div 
                           key={`h-${h}`} 
                           onClick={() => { setTempHour(h); if(navigator.vibrate) navigator.vibrate(20); }}
                           style={tempHour === h ? { color: accentColor } : {}}
                           className={`h-10 flex items-center justify-center snap-center cursor-pointer transition-colors rounded-lg font-bold text-lg ${tempHour === h ? '' : 'text-muted-foreground'}`}
                        >
                           {h}
                        </div>
                     ))}
                     <div className="h-[70px]" />
                  </div>
                  
                  <div className="flex-1 overflow-y-auto hide-scrollbar snap-y snap-mandatory border border-border/50 rounded-2xl p-1 bg-muted/10 relative shadow-inner">
                     <div style={{ backgroundColor: `${accentColor}1A`, borderColor: `${accentColor}33` }} className="absolute top-1/2 left-0 right-0 h-10 -mt-5 pointer-events-none rounded-xl border" />
                     <div className="h-[70px]" />
                     {["00", "15", "30", "45"].map(m => (
                        <div 
                           key={`m-${m}`} 
                           onClick={() => { setTempMin(m); if(navigator.vibrate) navigator.vibrate(20); }}
                           style={tempMin === m ? { color: accentColor } : {}}
                           className={`h-10 flex items-center justify-center snap-center cursor-pointer transition-colors rounded-lg font-bold text-lg ${tempMin === m ? '' : 'text-muted-foreground'}`}
                        >
                           {m}
                        </div>
                     ))}
                     <div className="h-[70px]" />
                  </div>
                  
                  <div className="w-[70px] flex flex-col justify-center gap-2">
                      <button onClick={() => setTempAmPm("AM")} style={tempAmPm === "AM" ? { backgroundColor: accentColor, color: '#fff' } : {}} className={`flex-1 rounded-2xl font-bold transition-all ${tempAmPm === "AM" ? 'shadow-sm scale-105' : 'bg-muted text-muted-foreground hover:bg-border'}`}>AM</button>
                      <button onClick={() => setTempAmPm("PM")} style={tempAmPm === "PM" ? { backgroundColor: accentColor, color: '#fff' } : {}} className={`flex-1 rounded-2xl font-bold transition-all ${tempAmPm === "PM" ? 'shadow-sm scale-105' : 'bg-muted text-muted-foreground hover:bg-border'}`}>PM</button>
                  </div>
               </div>

               <button onClick={saveTime} style={{ backgroundColor: accentColor }} className="w-full text-white py-3.5 rounded-xl font-bold shadow-soft active:scale-[0.98] transition-all">Save Time</button>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PIN Setup Modal */}
      <AnimatePresence>
        {showPinSetup && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowPinSetup(false)} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <motion.div initial={{ y: 20, opacity: 0, scale: 0.95 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 20, opacity: 0, scale: 0.95 }} className="bg-card w-full max-w-xs rounded-[2rem] shadow-heavy z-10 overflow-hidden p-6 space-y-5 flex flex-col items-center">
              <div className="bg-primary/10 p-3 rounded-2xl">
                <Lock className="w-6 h-6 text-primary" />
              </div>
              <div className="text-center">
                <h3 className="font-bold text-lg text-foreground">{pinStep === "enter" ? "Set a PIN" : "Confirm PIN"}</h3>
                <p className="text-sm text-muted-foreground font-medium mt-1">{pinStep === "enter" ? "Enter a 6-digit fallback PIN" : "Re-enter your PIN to confirm"}</p>
              </div>

              <div className="flex gap-3">
                {Array.from({ length: 6 }).map((_, i) => {
                  const val = pinStep === "enter" ? tempPin : confirmPin;
                  return (
                    <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all ${i < val.length ? "bg-primary border-primary" : "border-border"}`} />
                  );
                })}
              </div>

              {pinError && <p className="text-rose-500 text-xs font-bold">{pinError}</p>}

              <div className="grid grid-cols-3 gap-2 w-full">
                {["1","2","3","4","5","6","7","8","9","","0","del"].map(key => {
                  if (key === "") return <div key="empty" />;
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        setPinError("");
                        if (key === "del") {
                          if (pinStep === "enter") setTempPin(prev => prev.slice(0, -1));
                          else setConfirmPin(prev => prev.slice(0, -1));
                          return;
                        }
                        if (pinStep === "enter") {
                          const next = tempPin + key;
                          if (next.length > 6) return;
                          setTempPin(next);
                          if (next.length === 6) {
                            setPinStep("confirm");
                          }
                        } else {
                          const next = confirmPin + key;
                          if (next.length > 6) return;
                          setConfirmPin(next);
                          if (next.length === 6) {
                            if (next === tempPin) {
                              import("@/components/AuthGate").then(mod => {
                                mod.setStoredPin(next);
                              }).catch(() => {
                                localStorage.setItem("app_lock_pin", next);
                              });
                              toggleAppLock(true);
                              setShowPinSetup(false);
                              triggerToast("App Lock enabled with PIN!");
                            } else {
                              setPinError("PINs do not match");
                              setConfirmPin("");
                              if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(200);
                            }
                          }
                        }
                      }}
                      className="h-14 rounded-2xl bg-muted/50 border border-border/50 text-lg font-bold text-foreground hover:bg-muted active:scale-95 transition-all"
                    >
                      {key === "del" ? "⌫" : key}
                    </button>
                  );
                })}
              </div>

              <button onClick={() => setShowPinSetup(false)} className="text-sm font-bold text-muted-foreground hover:text-foreground transition-colors">
                Cancel
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}