"use client";

import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useAppContext } from "@/lib/context";
import { Sparkles, MonitorPlay, Music, Wifi, CreditCard, Zap, Smartphone, Droplet } from "lucide-react";
import React, { useState, useMemo } from "react";

const ICONS: Record<string, React.ReactNode> = {
  MonitorPlay: <MonitorPlay className="w-4 h-4" />,
  Music: <Music className="w-4 h-4" />,
  Wifi: <Wifi className="w-4 h-4" />,
  CreditCard: <CreditCard className="w-4 h-4" />,
  Zap: <Zap className="w-4 h-4" />,
  Smartphone: <Smartphone className="w-4 h-4" />,
  Droplet: <Droplet className="w-4 h-4" />
};

const PieTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const { name, value } = payload[0];
    const color = payload[0].payload.fill || payload[0].payload.color;
    return (
      <div className="bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-heavy p-3 min-w-[140px]">
        <p className="text-xs font-bold text-muted-foreground mb-2 pb-2 border-b border-border/50">{name}</p>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
          <span className="text-sm font-black text-foreground">{payload[0].payload.currency || 'RM'} {Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
      </div>
    );
  }
  return null;
};

const BarTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-heavy p-3 min-w-[150px]">
        <p className="text-xs font-bold text-muted-foreground mb-2 pb-2 border-b border-border/50">{label}</p>
        <div className="space-y-1.5">
          {payload.map((entry: any, i: number) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.fill || entry.color }} />
                <span className="text-xs font-semibold text-muted-foreground truncate">{entry.dataKey}</span>
              </div>
              <span className="text-xs font-black text-foreground shrink-0">{entry.payload?.currency || ''} {Number(entry.value).toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

const VelocityTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-heavy p-3 min-w-[130px]">
        <p className="text-xs font-bold text-muted-foreground mb-2 pb-2 border-b border-border/50">Day {label}</p>
        {payload.map((entry: any, i: number) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.stroke || entry.color }} />
            <span className="text-xs font-black text-foreground">{entry.payload?.currency || ''} {Number(entry.value).toFixed(2)}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function AnalyticsPage() {
  const { 
    subscriptions, utilities,
    triggerToast, accentColor, transactions, accounts, confirmAction,
    currency, formatCurrency
  } = useAppContext();

  const [timeFilter, setTimeFilter] = useState("Month");

  const filteredTxs = useMemo(() => {
     const now = new Date();
     if (timeFilter === "Month") {
       return transactions.filter(t => {
         const d = new Date(t.date);
         return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
       });
     }
     if (timeFilter === "Year") {
       return transactions.filter(t => new Date(t.date).getFullYear() === now.getFullYear());
     }
     return transactions;
  }, [transactions, timeFilter]);

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredTxs.forEach(t => {
       if (t.type !== "Expense") return;
       map[t.category] = (map[t.category] || 0) + Number(t.amount);
    });
    const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4'];
    return Object.entries(map).map(([name, value], i) => ({ name, value, color: colors[i % colors.length], currency })).sort((a,b)=>b.value-a.value);
  }, [filteredTxs]);

  const totalExpense = useMemo(() => categoryData.reduce((acc, curr) => acc + curr.value, 0), [categoryData]);

  const stackedCashFlow = useMemo(() => {
     const data: any[] = [];
     const map: Record<string, any> = {};
     const uniqueCats = new Set<string>();
     
     // Reverse for chronological ordering on the chart
     const chronologicalTxs = [...filteredTxs].reverse();

     chronologicalTxs.forEach(t => {
         if (t.type !== "Expense") return;
         const d = new Date(t.date);
         
         const key = (timeFilter === "Year" || timeFilter === "All") 
              ? `${d.toLocaleString('default', { month: 'short' })} '${d.getFullYear().toString().slice(2)}`
              : `${d.getMonth()+1}/${d.getDate()}`;
              
         if (!map[key]) {
            map[key] = { name: key };
            data.push(map[key]);
         }
         uniqueCats.add(t.category);
         map[key][t.category] = (map[key][t.category] || 0) + Number(t.amount);
     });
     
     // If data is entirely empty, just mock a shell so the chart doesn't crash visually
     if (data.length === 0) {
        data.push({ name: "No Data" });
     }
     
     const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#f43f5e'];
     return { data, categories: Array.from(uniqueCats), colors };
  }, [filteredTxs, timeFilter]);

  const smartInsightText = useMemo(() => {
     if (!transactions || transactions.length === 0) return "Start tracking to uncover your financial personality!";

     const now = new Date();
     const dayOfWeek = now.getDay() || 7;
     const startOfThisWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek + 1).getTime();
     const startOfLastWeek = startOfThisWeek - 7 * 86400000;

     const thisWeekExpenses: Record<string, number> = {};
     let thisWeekTotal = 0;
     let lastWeekTotal = 0;

     transactions.forEach(t => {
       if (t.type !== "Expense") return;
       const txTime = new Date(t.date).getTime();
       const amt = Number(t.amount);
       if (txTime >= startOfThisWeek) {
         thisWeekTotal += amt;
         const cat = t.category || "Other";
         thisWeekExpenses[cat] = (thisWeekExpenses[cat] || 0) + amt;
       } else if (txTime >= startOfLastWeek && txTime < startOfThisWeek) {
         lastWeekTotal += amt;
       }
     });

     if (lastWeekTotal === 0 && thisWeekTotal === 0) return "No spending data for the last two weeks yet.";
     if (lastWeekTotal === 0) return `You've spent ${formatCurrency(thisWeekTotal)} this week. Keep it up!`;

     const pctChange = ((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100;
     const topCategory = Object.entries(thisWeekExpenses).sort((a, b) => b[1] - a[1])[0];
     const direction = pctChange > 0 ? "more" : "less";
     const topCatStr = topCategory ? `, primarily driven by ${topCategory[0]}` : "";

     if (Math.abs(pctChange) < 2) return `Your spending is steady this week — almost identical to last week.`;
     return `You spent ${Math.abs(pctChange).toFixed(0)}% ${direction} this week${topCatStr}.`;
  }, [transactions, formatCurrency]);

  const dateRangeLabel = useMemo(() => {
     const now = new Date();
     if (timeFilter === "Month") return now.toLocaleString('default', { month: 'long', year: 'numeric' });
     if (timeFilter === "Year") return now.getFullYear().toString();
     return "All Time";
  }, [timeFilter]);

  // Velocity Projection (current month only)
  const velocityData = useMemo(() => {
    const now = new Date();
    const currentDay = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    // Build cumulative actual spend by day
    const dailySpend: Record<number, number> = {};
    transactions.forEach(t => {
      if (t.type !== "Expense") return;
      const d = new Date(t.date);
      if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return;
      const day = d.getDate();
      dailySpend[day] = (dailySpend[day] || 0) + Number(t.amount);
    });

    let cumulative = 0;
    const data: { day: number; actual?: number; projected?: number }[] = [];

    // Actual line up to today
    for (let d = 1; d <= daysInMonth; d++) {
      if (d <= currentDay) {
        cumulative += dailySpend[d] || 0;
        data.push({ day: d, actual: cumulative, projected: d === currentDay ? cumulative : undefined });
      } else {
        data.push({ day: d });
      }
    }

    // Projected line from today to end of month
    const dailyAvg = currentDay > 0 ? cumulative / currentDay : 0;
    let projCumulative = cumulative;
    for (let d = currentDay + 1; d <= daysInMonth; d++) {
      projCumulative += dailyAvg;
      const existing = data.find(item => item.day === d);
      if (existing) existing.projected = Math.round(projCumulative * 100) / 100;
    }
    // Set projected on the current day entry to bridge the lines
    const todayEntry = data.find(item => item.day === currentDay);
    if (todayEntry) todayEntry.projected = cumulative;

    const projectedTotal = Math.round(dailyAvg * daysInMonth * 100) / 100;

    return { data, projectedTotal, dailyAvg, currentDay, daysInMonth, totalSoFar: cumulative };
  }, [transactions]);

  // Income by Account — grouped bar chart data respecting time filter
  const incomeByAccount = useMemo(() => {
    const incomeTxs = filteredTxs.filter(t => t.type === "Income");
    const map: Record<string, number> = {};
    incomeTxs.forEach(t => {
      const acc = t.account || "Unknown";
      map[acc] = (map[acc] || 0) + Number(t.amount);
    });
    return Object.entries(map)
      .map(([account, amount]) => ({ account, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredTxs]);

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

      <p className="text-sm font-semibold text-muted-foreground">Viewing: {dateRangeLabel}</p>

      {/* Empty State */}
      {transactions.length === 0 && (
        <div className="bg-card rounded-3xl shadow-soft border border-border/40 p-8 text-center space-y-3">
          <p className="text-5xl">📈</p>
          <p className="font-bold text-foreground text-lg">No data yet</p>
          <p className="text-sm text-muted-foreground font-medium">Start logging transactions with the <strong>+</strong> button to see spending breakdowns, trends, and smart insights here.</p>
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
        <div className="flex items-center justify-center flex-col md:flex-row min-h-[350px]">
          <div className="h-[250px] w-full relative -mt-4">
             <div className="absolute inset-0 flex flex-col items-center justify-center">
               <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total</span>
               <span className="font-black text-xl text-foreground">{formatCurrency(totalExpense)}</span>
             </div>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
                <Pie
                  data={categoryData}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                  labelLine={true}
                  label={({ name, percent, x, y, textAnchor }: any) => (
                    <text x={x} y={y} textAnchor={textAnchor} dominantBaseline="central" className="fill-foreground text-[10px] font-bold">
                      {name} ({(percent * 100).toFixed(0)}%)
                    </text>
                  )}
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  content={<PieTooltip />}
                  allowEscapeViewBox={{ x: true, y: true }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          <div className="flex-1 space-y-3 pl-4 w-full pt-4 md:pt-0">
            {categoryData.map(entry => (
              <div key={entry.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: entry.color }} />
                <div>
                   <p className="text-xs font-bold text-foreground leading-none">{entry.name}</p>
                   <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">{currency} {entry.value.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Month over Month Chart */}
      <div className="bg-card p-6 rounded-[2rem] shadow-soft border border-border/40">
        <h3 className="font-bold text-foreground mb-6">Cash Flow</h3>
        <div className="w-full overflow-x-auto pb-4 hide-scrollbar">
          <div className="h-[220px]" style={{ minWidth: `${Math.max(100, stackedCashFlow.data.length * 60)}px` }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stackedCashFlow.data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)', fontWeight: 600 }} dy={10} interval={0} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--muted-foreground)', fontWeight: 600 }} />
                <Tooltip 
                   content={<BarTooltip />}
                   cursor={{ fill: 'var(--muted)', opacity: 0.2 }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 'bold', paddingTop: '10px' }} />
                {stackedCashFlow.categories.map((cat, i) => (
                  <Bar key={cat} dataKey={cat} stackId="a" fill={stackedCashFlow.colors[i % stackedCashFlow.colors.length]} radius={ i === stackedCashFlow.categories.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0] } maxBarSize={20} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Income by Account Chart */}
      {incomeByAccount.length > 0 && (
        <div className="bg-card p-6 rounded-[2rem] shadow-soft border border-border/40 space-y-4">
          <div>
            <h3 className="font-bold text-foreground">Income by Account</h3>
            <p className="text-[10px] uppercase font-black tracking-wider text-muted-foreground mt-1">
              Total: {formatCurrency(incomeByAccount.reduce((s, a) => s + a.amount, 0))} • {dateRangeLabel}
            </p>
          </div>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={incomeByAccount} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.4} />
                <XAxis dataKey="account" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--muted-foreground)', fontWeight: 600 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--muted-foreground)', fontWeight: 600 }} />
                <Tooltip
                  content={({ active, payload, label }: any) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-heavy p-3 min-w-[130px]">
                        <p className="text-xs font-bold text-muted-foreground mb-2 pb-2 border-b border-border/50">{label}</p>
                        <span className="text-sm font-black text-emerald-500">{formatCurrency(Number(payload[0].value))}</span>
                      </div>
                    );
                  }}
                  cursor={{ fill: 'var(--muted)', opacity: 0.2 }}
                />
                <Bar dataKey="amount" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Account breakdown legend */}
          <div className="flex flex-wrap gap-3 pt-1">
            {incomeByAccount.map((entry, i) => (
              <div key={entry.account} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500" style={{ opacity: 1 - i * 0.15 }} />
                <div>
                  <p className="text-[10px] font-bold text-foreground leading-none">{entry.account}</p>
                  <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">{formatCurrency(entry.amount)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Velocity Projection Chart */}
      {timeFilter === "Month" && velocityData.totalSoFar > 0 && (
        <div className="bg-card p-6 rounded-[2rem] shadow-soft border border-border/40 space-y-4">
          <div>
            <h3 className="font-bold text-foreground">Spending Velocity</h3>
            <p className="text-xs text-muted-foreground font-medium mt-1">
              At your current pace of <span className="font-bold" style={{ color: accentColor }}>{currency} {velocityData.dailyAvg.toFixed(2)}/day</span>, you are projected to spend:
            </p>
            <p className="text-2xl font-black mt-2" style={{ color: accentColor }}>
              {formatCurrency(velocityData.projectedTotal)}
            </p>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">end-of-month projection</p>
          </div>

          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={velocityData.data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.4} />
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: 'var(--muted-foreground)', fontWeight: 600 }}
                  interval={4}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--muted-foreground)', fontWeight: 600 }} />
                <Tooltip content={<VelocityTooltip />} />
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke={accentColor}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5, fill: accentColor }}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="projected"
                  stroke={accentColor}
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  strokeOpacity={0.4}
                  dot={false}
                  activeDot={{ r: 4, fill: accentColor, strokeOpacity: 0.4 }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center gap-4 pt-1">
            <div className="flex items-center gap-2">
              <div className="w-6 h-0.5 rounded-full" style={{ backgroundColor: accentColor }} />
              <span className="text-[10px] font-bold text-muted-foreground">Actual</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-0.5 rounded-full opacity-40" style={{ backgroundColor: accentColor, borderTop: '2px dashed' }} />
              <span className="text-[10px] font-bold text-muted-foreground">Projected</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Recurring Costs Summary (managed in Financial Planning) */}
      {(subscriptions.length > 0 || utilities.length > 0) && (
        <div className="bg-card p-5 rounded-[2rem] shadow-soft border border-border/40 space-y-3">
          <h3 className="font-bold text-foreground text-sm">Recurring Costs</h3>
          {subscriptions.length > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground font-medium">Subscriptions ({subscriptions.length})</span>
              <span className="text-sm font-bold text-foreground">{formatCurrency(subscriptions.reduce((s: number, sub: any) => s + sub.cost, 0))}</span>
            </div>
          )}
          {utilities.length > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground font-medium">Utilities ({utilities.length})</span>
              <span className="text-sm font-bold text-foreground">{formatCurrency(utilities.reduce((s: number, u: any) => s + u.cost, 0))}</span>
            </div>
          )}
          <div className="pt-2 border-t border-border/40 flex justify-between items-center">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Monthly</span>
            <span className="text-sm font-black text-foreground">
              {formatCurrency(subscriptions.reduce((s: number, sub: any) => s + sub.cost, 0) + utilities.reduce((s: number, u: any) => s + u.cost, 0))}
            </span>
          </div>
        </div>
      )}

    </div>
  )
}
