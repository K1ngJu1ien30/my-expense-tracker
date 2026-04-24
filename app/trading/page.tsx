"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, DollarSign, Package, TrendingUp, Trash2 } from "lucide-react";
import { useAppContext } from "@/lib/context";

export default function TradingPage() {
  const { tradeItems, addTradeItem, updateTradeItem, deleteTradeItem, accentColor, formatCurrency, currency, confirmAction, triggerToast } = useAppContext();

  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBuyPrice, setNewBuyPrice] = useState("");
  const [newDate, setNewDate] = useState(() => new Date().toISOString().split("T")[0]);

  const [sellItemId, setSellItemId] = useState<string | null>(null);
  const [sellPrice, setSellPrice] = useState("");

  const heldItems = useMemo(() => tradeItems.filter(t => t.status === "held"), [tradeItems]);
  const soldItems = useMemo(() => tradeItems.filter(t => t.status === "sold"), [tradeItems]);

  const capitalInvested = useMemo(() => heldItems.reduce((sum, t) => sum + Number(t.buy_price), 0), [heldItems]);
  const realizedProfit = useMemo(() => soldItems.reduce((sum, t) => sum + (Number(t.sell_price || 0) - Number(t.buy_price)), 0), [soldItems]);

  const handleAdd = async () => {
    if (!newName || !newBuyPrice) return;
    await addTradeItem({
      item_name: newName,
      buy_price: Number(newBuyPrice),
      status: "held",
      date_acquired: new Date(newDate).toISOString(),
    });
    triggerToast(`"${newName}" added to inventory!`);
    setNewName("");
    setNewBuyPrice("");
    setNewDate(new Date().toISOString().split("T")[0]);
    setShowAddModal(false);
  };

  const handleSell = async () => {
    if (!sellItemId || !sellPrice) return;
    await updateTradeItem(sellItemId, {
      sell_price: Number(sellPrice),
      status: "sold",
      date_sold: new Date().toISOString(),
    });
    const item = tradeItems.find(t => t.id === sellItemId);
    const profit = Number(sellPrice) - Number(item?.buy_price || 0);
    triggerToast(`Sold! ${profit >= 0 ? "Profit" : "Loss"}: ${formatCurrency(Math.abs(profit))}`);
    setSellItemId(null);
    setSellPrice("");
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="p-6 animate-in fade-in duration-500 space-y-6 pb-[120px]">
      {/* Header */}
      <div className="flex justify-between items-center pt-2">
        <div>
          <h1 className="text-2xl font-bold">Trading</h1>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">Buy low, sell high</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          style={{ backgroundColor: accentColor }}
          className="text-white p-2.5 rounded-full shadow-soft hover:scale-105 active:scale-95 transition-transform"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Dashboard Metrics */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card p-4 rounded-2xl shadow-soft border border-border/40">
          <div className="flex items-center gap-2 mb-2">
            <div style={{ backgroundColor: `${accentColor}1A` }} className="p-1.5 rounded-lg">
              <DollarSign style={{ color: accentColor }} className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Invested</p>
          <p className="text-sm font-black text-foreground mt-0.5">{formatCurrency(capitalInvested)}</p>
        </div>
        <div className="bg-card p-4 rounded-2xl shadow-soft border border-border/40">
          <div className="flex items-center gap-2 mb-2">
            <div className={`p-1.5 rounded-lg ${realizedProfit >= 0 ? "bg-emerald-500/10" : "bg-rose-500/10"}`}>
              <TrendingUp className={`w-3.5 h-3.5 ${realizedProfit >= 0 ? "text-emerald-500" : "text-rose-500"}`} />
            </div>
          </div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Profit</p>
          <p className={`text-sm font-black mt-0.5 ${realizedProfit >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
            {realizedProfit >= 0 ? "+" : "-"}{formatCurrency(Math.abs(realizedProfit))}
          </p>
        </div>
        <div className="bg-card p-4 rounded-2xl shadow-soft border border-border/40">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-blue-500/10 p-1.5 rounded-lg">
              <Package className="w-3.5 h-3.5 text-blue-500" />
            </div>
          </div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Inventory</p>
          <p className="text-sm font-black text-foreground mt-0.5">{heldItems.length} item{heldItems.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Active Inventory */}
      <div className="space-y-3">
        <h3 className="font-bold text-foreground text-sm uppercase tracking-wider px-1">Active Inventory</h3>
        {heldItems.length === 0 ? (
          <div className="bg-card p-8 rounded-3xl border border-border/40 text-center">
            <Package className="w-10 h-10 text-muted-foreground mx-auto mb-3 stroke-[1.5]" />
            <p className="text-sm text-muted-foreground font-medium">No items in inventory.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Tap + to add your first trade item.</p>
          </div>
        ) : (
          heldItems.map(item => (
            <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card p-5 rounded-3xl shadow-soft border border-border/40 relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-500" />
              <div className="flex justify-between items-start pl-2">
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-foreground text-lg leading-tight truncate">{item.item_name}</h4>
                  <p className="text-xs text-muted-foreground font-medium mt-0.5">Acquired {formatDate(item.date_acquired)}</p>
                  <p className="text-sm font-black mt-1.5" style={{ color: accentColor }}>
                    {formatCurrency(Number(item.buy_price))}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <button
                    onClick={() => { setSellItemId(item.id); setSellPrice(""); }}
                    style={{ backgroundColor: `${accentColor}1A`, color: accentColor, borderColor: `${accentColor}33` }}
                    className="px-3 py-2 rounded-xl text-xs font-bold border active:scale-95 transition-all"
                  >
                    Mark Sold
                  </button>
                  <button
                    onClick={() => confirmAction("Delete Item", `Remove "${item.item_name}" from inventory?`, () => deleteTradeItem(item.id))}
                    className="p-2 text-muted-foreground hover:text-rose-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Sold Items */}
      {soldItems.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-bold text-foreground text-sm uppercase tracking-wider px-1">Sold Items</h3>
          {soldItems.map(item => {
            const profit = Number(item.sell_price || 0) - Number(item.buy_price);
            const isProfitable = profit >= 0;
            return (
              <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card p-5 rounded-3xl shadow-soft border border-border/40 relative overflow-hidden">
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${isProfitable ? "bg-emerald-500" : "bg-rose-500"}`} />
                <div className="flex justify-between items-start pl-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-foreground leading-tight truncate">{item.item_name}</h4>
                    <div className="flex items-center gap-3 mt-1.5 text-xs font-semibold text-muted-foreground">
                      <span>Buy: {formatCurrency(Number(item.buy_price))}</span>
                      <span>→</span>
                      <span>Sell: {formatCurrency(Number(item.sell_price || 0))}</span>
                    </div>
                    {item.date_sold && (
                      <p className="text-[10px] text-muted-foreground/60 font-medium mt-1">Sold {formatDate(item.date_sold)}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end shrink-0 ml-3">
                    <p className={`font-black text-lg ${isProfitable ? "text-emerald-500" : "text-rose-500"}`}>
                      {isProfitable ? "+" : "-"}{formatCurrency(Math.abs(profit))}
                    </p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">{isProfitable ? "Profit" : "Loss"}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Add Item Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-0 sm:p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddModal(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="bg-card w-full sm:max-w-md rounded-t-[2.5rem] sm:rounded-[2rem] shadow-heavy z-10 overflow-hidden flex flex-col p-6 pb-32 space-y-4">
              <div className="w-12 h-1.5 bg-border rounded-full mx-auto mb-2 shrink-0 sm:hidden" />
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg text-foreground">Add Trade Item</h3>
                <button type="button" aria-label="Close" onClick={() => setShowAddModal(false)} className="p-1 px-2 bg-muted hover:bg-border rounded-full transition-colors"><X className="w-5 h-5 text-muted-foreground" aria-hidden="true" /></button>
              </div>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Item name (e.g. iPhone 14 Pro)"
                className="w-full bg-muted/60 rounded-xl px-4 py-3 text-sm font-semibold outline-none border border-border text-foreground"
                autoFocus
              />
              <div className="flex items-center gap-2 bg-muted/60 rounded-xl px-4 py-3 border border-border">
                <span className="font-bold text-muted-foreground text-sm">{currency}</span>
                <input
                  value={newBuyPrice}
                  onChange={e => setNewBuyPrice(e.target.value)}
                  type="number"
                  placeholder="Buy price"
                  className="flex-1 bg-transparent text-sm font-bold outline-none text-foreground"
                />
              </div>
              <input
                type="date"
                value={newDate}
                onChange={e => setNewDate(e.target.value)}
                className="w-full bg-muted/60 rounded-xl px-4 py-3 text-sm font-semibold outline-none border border-border text-foreground"
              />
              <button
                onClick={handleAdd}
                style={{ backgroundColor: accentColor, boxShadow: `0 0 15px ${accentColor}4D` }}
                className="w-full text-white py-4 rounded-xl font-bold shadow-soft hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Add to Inventory
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sell Modal */}
      <AnimatePresence>
        {sellItemId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSellItemId(null)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ y: 20, opacity: 0, scale: 0.95 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 20, opacity: 0, scale: 0.95 }} className="bg-card w-full max-w-sm rounded-[2rem] shadow-heavy z-10 overflow-hidden p-6 space-y-5">
              <div>
                <h3 className="font-bold text-lg text-foreground">Mark as Sold</h3>
                <p className="text-sm text-muted-foreground font-medium mt-1">
                  Selling <span className="font-bold text-foreground">{tradeItems.find(t => t.id === sellItemId)?.item_name}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Bought for: <span className="font-bold">{formatCurrency(Number(tradeItems.find(t => t.id === sellItemId)?.buy_price || 0))}</span>
                </p>
              </div>
              <div className="flex items-center gap-2 bg-muted/60 rounded-xl px-4 py-3 border border-border">
                <span className="font-bold text-muted-foreground text-sm">{currency}</span>
                <input
                  value={sellPrice}
                  onChange={e => setSellPrice(e.target.value)}
                  type="number"
                  placeholder="Sell price"
                  className="flex-1 bg-transparent text-sm font-bold outline-none text-foreground"
                  autoFocus
                />
              </div>
              {sellPrice && (() => {
                const buyP = Number(tradeItems.find(t => t.id === sellItemId)?.buy_price || 0);
                const diff = Number(sellPrice) - buyP;
                return (
                  <p className={`text-sm font-black text-center ${diff >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                    {diff >= 0 ? "Profit" : "Loss"}: {diff >= 0 ? "+" : "-"}{formatCurrency(Math.abs(diff))}
                  </p>
                );
              })()}
              <div className="flex gap-3">
                <button onClick={() => setSellItemId(null)} className="flex-1 py-3 bg-muted rounded-xl font-bold text-sm text-muted-foreground hover:bg-border transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleSell}
                  disabled={!sellPrice}
                  style={{ backgroundColor: accentColor }}
                  className="flex-1 py-3 text-white rounded-xl font-bold text-sm active:scale-95 transition-all disabled:opacity-50"
                >
                  Confirm Sale
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
