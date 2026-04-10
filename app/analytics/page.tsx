"use client";

import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useAppContext } from "@/lib/context";
import { MonitorPlay, Music, Wifi, CreditCard, Plus, Trash2, Edit2, Zap, Smartphone, Droplet, X, Sparkles } from "lucide-react";
import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

const ICONS: Record<string, React.ReactNode> = {
  MonitorPlay: <MonitorPlay className="w-4 h-4" />,
  Music: <Music className="w-4 h-4" />,
  Wifi: <Wifi className="w-4 h-4" />,
  CreditCard: <CreditCard className="w-4 h-4" />,
  Zap: <Zap className="w-4 h-4" />,
  Smartphone: <Smartphone className="w-4 h-4" />,
  Droplet: <Droplet className="w-4 h-4" />
};

const ACCOUNT_ICONS: Record<string, string> = {
  "Bank (MBB)": "🏦",
  "Bank (HSBC)": "🏦",
  "TNG eWallet": "📱",
  "TNG Card": "💳",
  "Cash": "💵",
};

export default function AnalyticsPage() {
  const { 
    subscriptions, addSubscription, deleteSubscription, updateSubscription,
    utilities, addUtility, deleteUtility, updateUtility,
    triggerToast, accentColor, transactions, accounts, confirmAction
  } = useAppContext();

  const [timeFilter, setTimeFilter] = useState("Month");

  // Compute live balance per account from transactions
  const accountBalances = useMemo(() => {
    return accounts.map(accountName => {
      const balance = transactions.reduce((acc, tx) => {
        if (tx.account?.toLowerCase().trim() === accountName.toLowerCase().trim()) {
           if (tx.type === "Income") return acc + Number(tx.amount);
           if (tx.type === "Expense" || tx.type === "Transfer") return acc - Number(tx.amount);
        }
        return acc;
      }, 0);
      return { name: accountName, balance };
    });
  }, [accounts, transactions]);
  
  // Modals
  const [showAddModal, setShowAddModal] = useState<"Sub" | "Util" | null>(null);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  
  const [newItemName, setNewItemName] = useState("");
  const [newItemCost, setNewItemCost] = useState("");
  
  // Advanced Sub properties
  const [autoDeduct, setAutoDeduct] = useState(true);
  const [billingDay, setBillingDay] = useState("15");
  const [sourceAcc, setSourceAcc] = useState("Bank MBB");

  const openAddModal = (type: "Sub" | "Util") => {
     setShowAddModal(type);
     setEditItemId(null);
     setNewItemName("");
     setNewItemCost("");
     setAutoDeduct(true);
     setBillingDay("15");
     setSourceAcc(accounts[0] || "Bank");
  }

  const openEditModal = (type: "Sub" | "Util", item: any) => {
     setShowAddModal(type);
     setEditItemId(item.id);
     setNewItemName(item.name);
     setNewItemCost(String(item.cost));
     setAutoDeduct(item.autoDeduct ?? true);
     setBillingDay(String(item.billingDay || 15));
     setSourceAcc(item.sourceAccount || accounts[0] || "Bank");
  }

  const handleSave = () => {
     if (!newItemName || !newItemCost) return;
     
     const payload = { 
        name: newItemName, 
        cost: Number(newItemCost), 
        autoDeduct,
        billingDay: Number(billingDay),
        sourceAccount: sourceAcc
     };

     if (editItemId) {
        if (showAddModal === "Sub") updateSubscription(editItemId, payload);
        else updateUtility(editItemId, payload);
        triggerToast(`Updated successfully!`);
     } else {
        const newItem = {
           ...payload,
           icon: showAddModal === "Sub" ? "CreditCard" : "Zap", 
           bg: "bg-muted", 
           color: "text-foreground"
        };
        if (showAddModal === "Sub") addSubscription(newItem);
        else addUtility(newItem);
        triggerToast(`${newItemName} added successfully!`);
     }
     
     setShowAddModal(null);
  }

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.forEach(t => {
       if (t.type !== "Expense") return;
       map[t.category] = (map[t.category] || 0) + Number(t.amount);
    });
    const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4'];
    return Object.entries(map).map(([name, value], i) => ({ name, value, color: colors[i % colors.length] }));
  }, [transactions, timeFilter]);

  const totalExpense = useMemo(() => categoryData.reduce((acc, curr) => acc + curr.value, 0), [categoryData]);

  const stackedCashFlow = useMemo(() => {
     const data = [];
     const map: Record<string, any> = {};
     for (let i = 6; i >= 0; i--) {
       const d = new Date();
       d.setDate(d.getDate() - i);
       const key = `${d.getMonth()+1}/${d.getDate()}`;
       const item = { name: key };
       map[key] = item;
       data.push(item);
     }
     
     const weekAgo = new Date();
     weekAgo.setDate(weekAgo.getDate() - 7);
     const uniqueCats = new Set<string>();
     
     transactions.forEach(t => {
        const d = new Date(t.date);
        if (d < weekAgo || t.type !== "Expense") return;
        
        const key = `${d.getMonth()+1}/${d.getDate()}`;
        if (map[key]) {
           uniqueCats.add(t.category);
           map[key][t.category] = (map[key][t.category] || 0) + Number(t.amount);
        }
     });
     
     const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#f43f5e'];
     return { data, categories: Array.from(uniqueCats), colors };
  }, [transactions]);

  const smartInsightText = useMemo(() => {
     if (transactions && transactions.length === 0) return "Start tracking to uncover your financial personality!";
     if (timeFilter === "Month") return "Great job! You've successfully mapped 15% fewer discretionary spending outputs this week.";
     if (timeFilter === "Year") return "You are currently projecting to hit your primary Savings Goal significantly ahead of schedule!";
     return "Your long-term financial health is strictly optimal based on historical averages.";
  }, [timeFilter, transactions]);

  return (
    <div className="p-6 animate-in fade-in duration-500 space-y-6 pb-[120px] relative min-h-screen overflow-x-hidden">
      
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-2xl font-bold">Analytics</h1>
        
        <div className="flex bg-muted/60 p-1 rounded-xl">
           {["Month", "Year", "All"].map(filter => (
             <button 
               key={filter}
               onClick={() => { setTimeFilter(filter); if(navigator.vibrate) navigator.vibrate(20); }}
               style={timeFilter === filter ? { backgroundColor: accentColor, color: '#fff' } : {}}
               className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${timeFilter === filter ? 'shadow-sm scale-110 z-10' : 'text-muted-foreground hover:text-foreground'}`}
             >
               {filter}
             </button>
           ))}
        </div>
      </div>

      {/* Account Balance Pills */}
      {accountBalances.length > 0 && (
        <div className="-mx-6 px-6 overflow-x-auto hide-scrollbar">
          <div className="flex gap-3 pb-1 w-max">
            {accountBalances.map(({ name, balance }) => (
              <div
                key={name}
                className="flex items-center gap-2 bg-card border border-border/50 shadow-soft rounded-2xl px-4 py-3 shrink-0"
              >
                <span className="text-lg leading-none">{ACCOUNT_ICONS[name] || "💰"}</span>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider leading-none mb-0.5">{name}</p>
                  <p className={`text-sm font-black leading-none ${balance >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                    {balance < 0 ? "-" : ""}RM {Math.abs(balance).toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Smart Insights Array */}
      <div style={{ backgroundColor: `${accentColor}1A`, borderColor: `${accentColor}30` }} className="border p-4 rounded-2xl flex items-start gap-4">
         <div style={{ backgroundColor: accentColor, boxShadow: `0 0 15px ${accentColor}60` }} className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-1 pb-0.5 shadow-soft text-white">
            <Sparkles className="w-5 h-5"/>
         </div>
         <div className="flex-1 pr-2">
            <p style={{ color: accentColor }} className="text-xs font-black uppercase tracking-wider mb-1">Smart Insights</p>
            <p className="text-sm font-semibold text-foreground/90 leading-snug">{smartInsightText}</p>
         </div>
      </div>

      {/* Spending Breakdown */}
      <div className="bg-card p-6 rounded-[2rem] shadow-heavy shadow-black/5 border border-border/40 relative">
        <h3 className="font-bold text-foreground mb-6">Spending Category</h3>
        <div className="flex items-center justify-center">
          <div className="h-[200px] w-[200px] relative">
             <div className="absolute inset-0 flex flex-col items-center justify-center">
               <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total</span>
               <span className="font-black text-xl text-foreground">RM {totalExpense.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
             </div>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  innerRadius={60}
                  outerRadius={75}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  allowEscapeViewBox={{ x: true, y: true }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: 'var(--shadow-heavy)', backgroundColor: 'var(--card)' }}
                  itemStyle={{ color: 'var(--foreground)', fontWeight: 'bold' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          <div className="flex-1 space-y-3 pl-4">
            {categoryData.map(entry => (
              <div key={entry.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: entry.color }} />
                <div>
                   <p className="text-xs font-bold text-foreground leading-none">{entry.name}</p>
                   <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">RM {entry.value.toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Month over Month Chart */}
      <div className="bg-card p-6 rounded-[2rem] shadow-soft border border-border/40">
        <h3 className="font-bold text-foreground mb-6">Cash Flow</h3>
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stackedCashFlow.data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--muted-foreground)', fontWeight: 600 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--muted-foreground)', fontWeight: 600 }} />
              <Tooltip 
                 cursor={{ fill: 'var(--muted)', opacity: 0.2 }}
                 contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: 'var(--shadow-heavy)', backgroundColor: 'var(--card)' }}
                 itemStyle={{ fontWeight: 'bold' }}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 'bold', paddingTop: '10px' }} />
              {stackedCashFlow.categories.map((cat, i) => (
                <Bar key={cat} dataKey={cat} stackId="a" fill={stackedCashFlow.colors[i % stackedCashFlow.colors.length]} radius={ i === stackedCashFlow.categories.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0] } maxBarSize={20} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Subscriptions & Utilities Hub */}
      <div className="space-y-6 pt-4">
        
        {/* Active Subscriptions Block */}
        <div className="bg-card p-6 rounded-[2rem] shadow-soft border border-border/40 relative space-y-4">
           <div className="flex justify-between items-start">
             <div>
                <h3 className="font-bold">Subscriptions</h3>
                <p className="text-[10px] uppercase font-black tracking-wider text-muted-foreground mt-1">Total: RM {subscriptions.reduce((sum, s) => sum + s.cost, 0).toFixed(2)} / mo</p>
             </div>
             <button onClick={() => openAddModal("Sub")} style={{ color: accentColor, backgroundColor: `${accentColor}1A` }} className="p-2 rounded-full hover:scale-105 active:scale-95 transition-all"><Plus className="w-4 h-4"/></button>
           </div>
           
           <div className="space-y-3 pt-2">
             {subscriptions.map(sub => (
               <div key={sub.id} className="flex flex-col bg-muted/20 p-3 rounded-2xl border border-border/50">
                  <div className="flex items-center gap-4">
                      <div className={`${sub.bg} p-2.5 rounded-xl ${sub.color}`}>
                        {ICONS[sub.icon] || <CreditCard className="w-4 h-4" />}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-sm text-foreground">{sub.name}</p>
                        <p className="font-semibold text-xs text-primary mt-0.5">RM {sub.cost.toFixed(2)} {sub.autoDeduct ? '/mo' : ''}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                         <button onClick={() => openEditModal("Sub", sub)} className="p-2 text-muted-foreground hover:text-primary transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                         <button onClick={() => confirmAction("Delete Subscription", `Remove ${sub.name}?`, () => deleteSubscription(sub.id))} className="p-2 text-muted-foreground hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                  </div>
                  {/* Dynamic QoL Info Map */}
                  {sub.autoDeduct && (
                     <div className="mt-3 ml-[52px] bg-muted/60 px-3 py-2 rounded-xl text-[10px] font-bold text-muted-foreground leading-tight flex items-center gap-2">
                         <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                         <span>Auto-deducts on {sub.billingDay ? `Day ${sub.billingDay}` : 'Day 1'} via {sub.sourceAccount || "Bank MBB"}</span>
                     </div>
                  )}
               </div>
             ))}
             {subscriptions.length === 0 && <p className="text-xs font-semibold text-center text-muted-foreground py-2">No active subscriptions!</p>}
           </div>
        </div>

        {/* Utilities Block */}
        <div className="bg-card p-6 rounded-[2rem] shadow-soft border border-border/40 relative space-y-4">
           <div className="flex justify-between items-start">
             <div>
                <h3 className="font-bold">Utilities</h3>
                <p className="text-[10px] uppercase font-black tracking-wider text-muted-foreground mt-1">Total: RM {utilities.reduce((sum, s) => sum + s.cost, 0).toFixed(2)} / mo</p>
             </div>
             <button onClick={() => openAddModal("Util")} style={{ color: accentColor, backgroundColor: `${accentColor}1A` }} className="p-2 rounded-full hover:scale-105 active:scale-95 transition-all"><Plus className="w-4 h-4"/></button>
           </div>
           
           <div className="space-y-3 pt-2">
             {utilities.map(sub => (
               <div key={sub.id} className="flex flex-col bg-muted/20 p-3 rounded-2xl border border-border/50">
                  <div className="flex items-center gap-4">
                      <div className={`${sub.bg} p-2.5 rounded-xl ${sub.color}`}>
                        {ICONS[sub.icon] || <CreditCard className="w-4 h-4" />}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-sm text-foreground">{sub.name}</p>
                        <p className="font-semibold text-xs text-primary mt-0.5">RM {sub.cost.toFixed(2)}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                         <button onClick={() => openEditModal("Util", sub)} className="p-2 text-muted-foreground hover:text-primary transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                         <button onClick={() => confirmAction("Delete Utility", `Remove ${sub.name}?`, () => deleteUtility(sub.id))} className="p-2 text-muted-foreground hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                  </div>
                  {sub.autoDeduct && (
                     <div className="mt-3 ml-[52px] bg-muted/60 px-3 py-2 rounded-xl text-[10px] font-bold text-muted-foreground leading-tight flex items-center gap-2">
                         <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                         <span>Auto-deducts on {sub.billingDay ? `Day ${sub.billingDay}` : 'Day 1'} via {sub.sourceAccount || "Bank MBB"}</span>
                     </div>
                  )}
               </div>
             ))}
             {utilities.length === 0 && <p className="text-xs font-semibold text-center text-muted-foreground py-2">No active utility loops!</p>}
           </div>
        </div>

      </div>

      {/* Advanced Add Item Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-0 sm:p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddModal(null)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
             <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="bg-card w-full sm:max-w-md rounded-t-[2.5rem] sm:rounded-[2rem] shadow-heavy z-10 overflow-hidden flex flex-col p-6 space-y-5 max-h-[85vh] overflow-y-auto hide-scrollbar">
                
                <div className="w-12 h-1.5 bg-border rounded-full mx-auto mb-2 shrink-0 sm:hidden" />
                <div className="flex justify-between items-center pb-2">
                   <h3 className="font-bold text-lg text-foreground">{editItemId ? "Edit" : "Add"} {showAddModal === "Sub" ? "Subscription" : "Utility"}</h3>
                   <button onClick={() => setShowAddModal(null)} className="p-1 px-2 bg-muted hover:bg-border rounded-full transition-colors"><X className="w-5 h-5 text-muted-foreground"/></button>
                </div>
                
                <div className="space-y-4">
                   <input 
                      value={newItemName} 
                      onChange={e=>setNewItemName(e.target.value)} 
                      type="text" 
                      placeholder="Name (e.g. Netflix)" 
                      className="w-full bg-muted/60 rounded-xl px-4 py-3 text-sm font-semibold outline-none border border-border text-foreground focus:border-primary/50 transition-colors" 
                      autoFocus
                   />
                   <div className="flex items-center gap-2 bg-muted/60 rounded-xl px-4 py-3 border border-border focus-within:border-primary/50 transition-colors">
                      <span className="font-bold text-muted-foreground text-sm">RM</span>
                      <input 
                         value={newItemCost} 
                         onChange={e=>setNewItemCost(e.target.value)} 
                         type="number" 
                         placeholder="0.00" 
                         className="flex-1 bg-transparent text-sm font-bold outline-none text-foreground" 
                      />
                   </div>

                   {/* Advanced Routing Configurations */}
                   <div className="p-4 rounded-2xl border border-border/50 bg-muted/10 space-y-4">
                      
                      {/* Auto Deduct */}
                      <div className="flex items-center justify-between cursor-pointer" onClick={() => setAutoDeduct(!autoDeduct)}>
                         <span className="text-sm font-bold">Auto-Deduct Monthly</span>
                         <button className={`w-12 h-7 rounded-full transition-colors relative flex items-center pointer-events-none ${autoDeduct ? 'border-transparent' : 'bg-muted border border-border'}`} style={autoDeduct ? { backgroundColor: accentColor } : {}}>
                           <div className={`w-5 h-5 bg-card rounded-full shadow-sm absolute transition-transform ${autoDeduct ? 'translate-x-[24px]' : 'translate-x-[3px]'}`} />
                         </button>
                      </div>

                      {/* Expandable Meta Configs - Replaced Selects with Premium Scrolling Arrays */}
                      <AnimatePresence>
                        {autoDeduct && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="space-y-5 overflow-hidden pt-4 border-t border-border/50">
                             
                             <div className="flex flex-col gap-2 relative">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Billing Date</span>
                                <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                                    {Array.from({length:28}, (_,i) => i+1).map(d => (
                                        <button 
                                           key={d} 
                                           onClick={() => { setBillingDay(String(d)); if(navigator.vibrate) navigator.vibrate(20); }} 
                                           style={billingDay === String(d) ? { backgroundColor: accentColor, color: '#fff' } : {}}
                                           className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${billingDay === String(d) ? 'shadow-soft scale-105' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}
                                        >
                                           Day {d}
                                        </button>
                                    ))}
                                </div>
                                {/* Gradient fade right side */}
                                <div className="absolute right-0 top-6 bottom-0 w-8 bg-gradient-to-l from-card to-transparent pointer-events-none" />
                             </div>

                             <div className="flex flex-col gap-2">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Source Account</span>
                                <div className="flex flex-wrap gap-2">
                                   {accounts.map(acc => (
                                      <button 
                                         key={acc} 
                                         onClick={() => { setSourceAcc(acc); if(navigator.vibrate) navigator.vibrate(20); }}
                                         style={sourceAcc === acc ? { backgroundColor: accentColor, color: '#fff' } : {}}
                                         className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex-1 ${sourceAcc === acc ? 'shadow-soft scale-[1.02]' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}
                                      >
                                         {acc}
                                      </button>
                                   ))}
                                </div>
                             </div>

                          </motion.div>
                        )}
                      </AnimatePresence>
                   </div>

                   <button style={{ backgroundColor: accentColor, boxShadow: `0 0 15px ${accentColor}4D` }} onClick={handleSave} className="w-full text-white py-4 rounded-xl font-bold shadow-soft hover:scale-[1.02] active:scale-[0.98] transition-all mt-4">
                      {editItemId ? "Update Tracking Sequence" : "Deploy Tracking Vector"}
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}
