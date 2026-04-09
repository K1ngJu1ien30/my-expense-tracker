"use client";

import { Download, Trash2, Tags, Moon, ChevronRight, Edit2, Check, Bell, CircleDollarSign, Calendar, X, Plus, GripVertical, Shield, Palette, Database, LogOut } from "lucide-react";
import { useState, useEffect } from "react";
import { useAppContext } from "@/lib/context";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence, Reorder } from "framer-motion";

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
    accentColor, setAccentColor,
    isSecurityEnabled, setIsSecurityEnabled,
    securityMethod, setSecurityMethod,
    appPin, setAppPin,
    triggerToast,
    transactions, subscriptions, goals, utilities, session
  } = useAppContext();

  const [darkMode, setDarkMode] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  
  const [showWipeModal, setShowWipeModal] = useState(false);
  const [wipePassword, setWipePassword] = useState("");
  const [isWiping, setIsWiping] = useState(false);

  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [newCat, setNewCat] = useState("");

  const [showBillingSheet, setShowBillingSheet] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [tempHour, setTempHour] = useState("08");
  const [tempMin, setTempMin] = useState("30");
  const [tempAmPm, setTempAmPm] = useState("PM");

  const [isEditingPin, setIsEditingPin] = useState(false);
  const [tempPin, setTempPin] = useState(appPin);

  const [showRawDataModal, setShowRawDataModal] = useState(false);
  const [rawTab, setRawTab] = useState("Tx");

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

  const DAYS = Array.from({ length: 31 }, (_, i) => (i + 1).toString());

  const handleLogout = async () => {
     await supabase.auth.signOut();
     triggerToast("Logged out successfully");
  };

  const exportCSV = () => {
     const headers = "Date,Type,Category,Amount,Account,Note\n";
     const rows = transactions.map(t => `${new Date(t.date).toLocaleDateString()},${t.type},${t.category || ''},${t.amount},${t.account || ''},${(t.note || '').replace(/,/g, ' ')}`).join('\n');
     const blob = new Blob([headers + rows], { type: 'text/csv' });
     const url = window.URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.setAttribute('hidden', '');
     a.setAttribute('href', url);
     a.setAttribute('download', 'transactions_export.csv');
     document.body.appendChild(a);
     a.click();
     document.body.removeChild(a);
     triggerToast("CSV Export downloaded!");
  };

  const executeWipe = async () => {
     if (!session?.user?.email) return;
     setIsWiping(true);
     
     const { error: authError } = await supabase.auth.signInWithPassword({ email: session.user.email, password: wipePassword });
     if (authError) {
        triggerToast("Auth failed: " + authError.message);
        setIsWiping(false);
        return;
     }

     const { error: txError } = await supabase.from('transactions').delete().eq('user_id', session.user.id);
     
     if (txError) {
        triggerToast("Database error: " + txError.message);
     } else {
        triggerToast("Data wiped securely from remote core.");
        setShowWipeModal(false);
        setWipePassword("");
        setTimeout(() => window.location.reload(), 1000);
     }
     setIsWiping(false);
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
              <input autoFocus value={tempName} onChange={e=>setTempName(e.target.value)} className="bg-muted px-2 py-1 rounded text-lg font-bold outline-none w-32 text-foreground" />
              <button style={{ backgroundColor: accentColor }} onClick={saveName} className="p-2 text-primary-foreground rounded-md shadow-soft"><Check className="w-4 h-4" /></button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-foreground">{userName}</h2>
              <button onClick={() => { setTempName(userName); setIsEditingName(true); }} className="text-muted-foreground hover:text-foreground transition-colors"><Edit2 className="w-4 h-4" /></button>
            </div>
          )}
          <p className="text-muted-foreground text-sm font-medium">{userName}&apos;s Finance Tracker</p>
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

      {/* Personalization (Theming & Modes) */}
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

          <button onClick={() => setShowCategoriesModal(true)} className="w-full flex items-center justify-between p-4 border-b border-border/40 active:bg-muted/50 transition-colors text-left cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="bg-blue-500/10 p-2 rounded-xl text-blue-500"><Tags className="w-5 h-5" /></div>
              <span className="font-semibold text-foreground text-sm">Manage Categories</span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
          
          <div className="w-full flex items-center justify-between p-4 border-b border-border/40 active:bg-muted/50 transition-colors cursor-pointer" onClick={() => { setDarkMode(!darkMode); document.documentElement.classList.toggle('dark'); }}>
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

      {/* Security Hub */}
      <div>
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 px-2 flex items-center gap-2"><Shield className="w-3.5 h-3.5"/> App Security</h3>
        <div className="bg-card rounded-3xl shadow-soft border border-border/40 overflow-hidden relative">
          
          <div className="w-full flex items-center justify-between p-4 border-b border-border/40 active:bg-muted/50 transition-colors cursor-pointer" onClick={() => { setIsSecurityEnabled(!isSecurityEnabled); setAppPin(""); }}>
            <div className="flex flex-col gap-1">
               <span className="font-semibold text-foreground text-sm leading-none pt-0.5">Enable App Lock</span>
               <span className="text-xs text-muted-foreground font-medium">Require PIN to open the tracker</span>
            </div>
            <button className={`w-12 h-7 rounded-full transition-colors relative flex items-center pointer-events-none ${isSecurityEnabled ? 'border-transparent' : 'bg-muted border border-border'}`} style={isSecurityEnabled ? { backgroundColor: accentColor } : {}}>
              <div className={`w-5 h-5 bg-card rounded-full shadow-sm absolute transition-transform ${isSecurityEnabled ? 'translate-x-[24px]' : 'translate-x-[3px]'}`} />
            </button>
          </div>

          <AnimatePresence>
            {isSecurityEnabled && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="bg-muted/10 overflow-hidden"
                >
                   <div className="p-4 border-b border-border/50 flex items-center justify-between">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Unlock Method</span>
                      <div className="flex bg-muted/60 p-1 rounded-xl">
                         {["PIN", "Biometrics"].map(method => (
                           <button 
                             key={method}
                             onClick={() => setSecurityMethod(method)}
                             style={securityMethod === method ? { backgroundColor: accentColor, color: '#fff' } : {}}
                             className={`px-3 py-1 text-[10px] uppercase font-black tracking-wider rounded-lg transition-all ${securityMethod === method ? 'shadow-sm scale-110 z-10' : 'text-muted-foreground hover:text-foreground'}`}
                           >
                             {method}
                           </button>
                         ))}
                      </div>
                   </div>

                   <div className="p-4 flex items-center justify-between">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Passcode Array</span>
                      {isEditingPin ? (
                         <div className="flex gap-2">
                            <input 
                               value={tempPin} 
                               onChange={e=>setTempPin(e.target.value.substring(0,4))} 
                               type="password" 
                               placeholder="1234" 
                               className="bg-card w-16 px-2 py-1 rounded text-center text-sm font-bold border border-border outline-none tracking-widest text-foreground" 
                            />
                            <button 
                               onClick={() => { setAppPin(tempPin); setIsEditingPin(false); triggerToast("Security PIN active!"); }} 
                               style={{ backgroundColor: accentColor }} className="px-3 py-1 text-white font-bold text-xs rounded shadow-soft active:scale-95 transition-transform"
                            >
                               Set
                            </button>
                         </div>
                      ) : (
                         <button 
                           onClick={() => { setIsEditingPin(true); setTempPin(appPin); }}
                           style={{ color: accentColor, backgroundColor: `${accentColor}1A` }}
                           className="px-4 py-1.5 font-bold text-xs tracking-wide rounded-lg active:scale-95 transition-transform"
                         >
                            {appPin ? "Change Master PIN" : "Configure PIN"}
                         </button>
                      )}
                   </div>
                </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>
      
      {/* Data Management Section */}
      <div>
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 px-2">Data Management</h3>
        <div className="bg-card rounded-3xl shadow-soft border border-border/40 overflow-hidden">
          
          <button onClick={() => setShowRawDataModal(true)} className="w-full flex items-center justify-between p-4 border-b border-border/40 active:bg-muted/50 transition-colors text-left cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-500/10 p-2 rounded-xl text-indigo-500"><Database className="w-5 h-5" /></div>
              <span className="font-semibold text-foreground text-sm">View Raw Data Database</span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>

          <button onClick={exportCSV} className="w-full flex items-center justify-between p-4 border-b border-border/40 active:bg-muted/50 transition-colors text-left cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-500/10 p-2 rounded-xl text-emerald-500"><Download className="w-5 h-5" /></div>
              <span className="font-semibold text-foreground text-sm">Export Data to CSV</span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
          
          <button onClick={() => setShowWipeModal(true)} className="w-full flex items-center justify-between p-4 active:bg-red-500/10 transition-colors text-left group cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="bg-red-500/10 p-2 rounded-xl text-red-500 group-hover:bg-red-500/20 transition-colors"><Trash2 className="w-5 h-5" /></div>
              <span className="font-semibold text-red-600 text-sm">Clear All Data</span>
            </div>
          </button>
        </div>
      </div>

      {/* Logout Overlay */}
      <div className="pt-2">
         <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 p-4 bg-red-500/10 hover:bg-red-500/20 text-red-600 rounded-[2rem] font-bold transition-colors active:scale-[0.98]">
            <LogOut className="w-5 h-5" /> Sign Out
         </button>
      </div>

      {/* Categories Reorder Modal overlay */}
      <AnimatePresence>
        {showCategoriesModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCategoriesModal(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
             <motion.div initial={{ y: 20, opacity: 0, scale: 0.95 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 20, opacity: 0, scale: 0.95 }} className="bg-card w-full max-w-sm rounded-[2rem] shadow-heavy z-10 overflow-hidden flex flex-col max-h-[85vh]">
                <div className="p-5 border-b border-border/40 flex justify-between items-center bg-muted/20">
                   <h3 className="font-bold text-foreground">Manage Categories</h3>
                   <button onClick={() => setShowCategoriesModal(false)} className="p-1.5 hover:bg-muted rounded-full transition-colors"><X className="w-5 h-5 text-muted-foreground"/></button>
                </div>
                
                <p className="px-5 pt-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-center">Drag to reorder mapping</p>

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

      {/* Raw Data Modal Full Screen overlay */}
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
                              <th className="p-4 border-b border-border/50">ID</th>
                              <th className="p-4 border-b border-border/50">Type</th>
                              <th className="p-4 border-b border-border/50">Amount</th>
                              <th className="p-4 border-b border-border/50">Category</th>
                              <th className="p-4 border-b border-border/50">Date</th>
                           </tr>
                        </thead>
                        <tbody>
                           {transactions.length === 0 ? (
                              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground font-medium">No transaction records found.</td></tr>
                           ) : (
                              transactions.map((tx, i) => (
                                 <tr key={tx.id || i} className="even:bg-muted/30 hover:bg-muted/50 transition-colors">
                                    <td className="p-4 border-b border-border/30 font-mono text-xs">{tx.id || 'N/A'}</td>
                                    <td className="p-4 border-b border-border/30 font-semibold">{tx.type}</td>
                                    <td className="p-4 border-b border-border/30">RM {tx.amount}</td>
                                    <td className="p-4 border-b border-border/30 text-muted-foreground max-w-[120px] truncate">{tx.category}</td>
                                    <td className="p-4 border-b border-border/30 text-muted-foreground">{tx.date}</td>
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

    </div>
  )
}
