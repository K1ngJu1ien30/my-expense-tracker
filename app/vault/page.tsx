"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, X, Package, ChevronDown } from "lucide-react";
import { useAppData } from "@/lib/context";
import AssetDetailOverlay from "@/components/AssetDetailOverlay";
import CustomDatePicker from "@/components/CustomDatePicker";
import { roundCurrency } from "@/lib/utils";

const EMOJI_OPTIONS = ["📱", "💻", "📸", "👟", "⌚", "🎧", "🎮", "🚗", "🏠", "🛋️", "🧳", "👜", "📦", "🔧", "🎸"];

export default function VaultPage() {
  const { assets, addAsset, deleteAsset, confirmAction, accentColor, triggerToast, currency } = useAppData();

  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [emoji, setEmoji] = useState("📦");
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [purchasePrice, setPurchasePrice] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [showCatDropdown, setShowCatDropdown] = useState(false);

  const uniqueCategories = useMemo(() => {
    const cats = new Set(assets.map(a => a.category).filter(Boolean));
    return ["All", ...Array.from(cats)];
  }, [assets]);

  const filteredAssets = useMemo(() => {
    if (activeFilter === "All") return assets;
    return assets.filter(a => a.category === activeFilter);
  }, [assets, activeFilter]);

  const totalValue = useMemo(() => roundCurrency(filteredAssets.reduce((sum, a) => sum + Number(a.purchase_price || 0), 0)), [filteredAssets]);

  const avgCostPerDay = useMemo(() => {
    const totalDaily = filteredAssets.reduce((sum, a) => {
      const price = Number(a.purchase_price || 0);
      if (price === 0) return sum;
      const now = new Date();
      const days = Math.max(1, Math.floor((now.getTime() - new Date(a.purchase_date).getTime()) / 86400000));
      return sum + price / days;
    }, 0);
    return roundCurrency(totalDaily);
  }, [filteredAssets]);

  const existingCategories = useMemo(() => [...new Set(assets.map(a => a.category).filter(Boolean))], [assets]);

  const handleAdd = async () => {
    if (!name) return;
    await addAsset({
      name,
      category: category || "General",
      emoji_icon: emoji,
      purchase_date: purchaseDate,
      purchase_price: Number(purchasePrice) || 0,
    });
    triggerToast(`${emoji} ${name} added to Vault!`);
    setShowAdd(false);
    setName("");
    setCategory("");
    setEmoji("📦");
    setPurchasePrice("");
  };

  const getDaysActive = (dateStr: string) => {
    if (!dateStr) return 0;
    const diff = new Date().getTime() - new Date(dateStr).getTime();
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  };

  return (
    <div className="p-6 animate-in fade-in duration-500 space-y-6 pb-32">
      <div className="flex justify-between items-center pt-2">
        <h1 className="text-2xl font-bold">Asset Vault</h1>
        <button onClick={() => setShowAdd(true)} style={{ backgroundColor: accentColor }} className="text-white p-2 rounded-full shadow-soft hover:scale-105 active:scale-95 transition-transform">
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3 lg:gap-6">
        <div className="bg-card p-4 lg:p-6 rounded-2xl shadow-soft border border-border/40">
          <p className="text-[10px] lg:text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Total Value</p>
          <p className="text-lg lg:text-2xl font-black text-foreground">{currency} {totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-card p-4 lg:p-6 rounded-2xl shadow-soft border border-border/40">
          <p className="text-[10px] lg:text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Items</p>
          <p className="text-lg lg:text-2xl font-black text-foreground">{filteredAssets.length}</p>
        </div>
        <div className="bg-card p-4 lg:p-6 rounded-2xl shadow-soft border border-border/40">
          <p className="text-[10px] lg:text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Cost / Day</p>
          <p className="text-lg lg:text-2xl font-black" style={{ color: accentColor }}>{currency} {avgCostPerDay.toFixed(2)}</p>
        </div>
      </div>

      {/* Category Filter Pills */}
      {uniqueCategories.length > 1 && (
        <div className="-mx-6 px-6 overflow-x-auto hide-scrollbar">
          <div className="flex gap-2 pb-1 w-max">
            {uniqueCategories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveFilter(cat)}
                style={activeFilter === cat ? { backgroundColor: accentColor, color: "#fff" } : {}}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${activeFilter === cat ? "shadow-sm scale-105" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Asset Grid */}
      {filteredAssets.length === 0 ? (
        <div className="bg-card p-8 rounded-3xl shadow-soft border border-border/40 text-center">
          <Package className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm font-medium">
            {assets.length === 0 ? "No assets tracked yet. Tap + to add your first item!" : "No assets in this category."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredAssets.map(asset => (
            <div key={asset.id} onClick={() => setSelectedAssetId(asset.id)} className="block cursor-pointer">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card p-4 rounded-2xl shadow-soft border border-border/40 hover:scale-[1.02] active:scale-95 transition-all relative group"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    confirmAction("Delete Asset", `Remove "${asset.name}"?`, () => deleteAsset(asset.id));
                  }}
                  className="absolute top-2 right-2 p-1.5 text-muted-foreground hover:text-red-500 opacity-60 hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <div className="text-3xl mb-2">{asset.emoji_icon || "📦"}</div>
                <p className="font-bold text-sm text-foreground leading-tight truncate">{asset.name}</p>
                <p className="text-[10px] font-semibold text-muted-foreground mt-0.5">{asset.category}</p>
                <div className="mt-2 pt-2 border-t border-border/30">
                  <p className="text-xs font-black" style={{ color: accentColor }}>Active for {getDaysActive(asset.purchase_date)} days</p>
                  {Number(asset.purchase_price) > 0 && (
                    <p className="text-[10px] font-semibold text-muted-foreground mt-0.5">{currency} {Number(asset.purchase_price).toFixed(2)}</p>
                  )}
                </div>
              </motion.div>
            </div>
          ))}
        </div>
      )}

      {/* Add Asset Modal */}
      <AnimatePresence>
        {showAdd && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-0 sm:p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAdd(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="bg-card w-full sm:max-w-md rounded-t-[2.5rem] sm:rounded-[2rem] shadow-heavy z-10 overflow-hidden flex flex-col p-6 pb-32 space-y-4 max-h-[85vh] overflow-y-auto hide-scrollbar">
              <div className="w-12 h-1.5 bg-border rounded-full mx-auto mb-2 shrink-0 sm:hidden" />
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg text-foreground">Add Asset</h3>
                <button type="button" aria-label="Close" onClick={() => setShowAdd(false)} className="p-1 px-2 bg-muted hover:bg-border rounded-full transition-colors"><X className="w-5 h-5 text-muted-foreground" aria-hidden="true" /></button>
              </div>

              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Icon</p>
                <div className="flex flex-wrap gap-2">
                  {EMOJI_OPTIONS.map(e => (
                    <button key={e} onClick={() => setEmoji(e)} className={`text-2xl p-2 rounded-xl transition-all ${emoji === e ? "bg-primary/10 scale-110 shadow-sm" : "hover:bg-muted"}`}>
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              <input value={name} onChange={e => setName(e.target.value)} placeholder="Asset name (e.g. MacBook Pro)" className="w-full bg-muted/60 rounded-xl px-4 py-3 text-sm font-semibold outline-none border border-border text-foreground" autoFocus />

              {/* Category — custom dropdown + free-text */}
              <div className="relative">
                <div className="flex gap-2">
                  <input
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    placeholder="Category (e.g. Electronics)"
                    className="flex-1 bg-muted/60 rounded-xl px-4 py-3 text-sm font-semibold outline-none border border-border text-foreground"
                  />
                  {existingCategories.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowCatDropdown(!showCatDropdown)}
                      className="bg-muted/60 rounded-xl px-3 border border-border text-muted-foreground hover:text-foreground active:scale-95 transition-all"
                    >
                      <ChevronDown className={`w-4 h-4 transition-transform ${showCatDropdown ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                </div>
                <AnimatePresence>
                  {showCatDropdown && existingCategories.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-card border border-border/50 rounded-xl shadow-heavy overflow-hidden max-h-48 overflow-y-auto hide-scrollbar"
                    >
                      {existingCategories.map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => { setCategory(c); setShowCatDropdown(false); }}
                          className="w-full text-left px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors border-b border-border/30 last:border-0"
                        >
                          {c}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Date — iOS-style picker */}
              <CustomDatePicker value={purchaseDate} onChange={setPurchaseDate} accentColor={accentColor} />

              <div className="flex items-center gap-2 bg-muted/60 rounded-xl px-4 py-3 border border-border">
                <span className="font-bold text-muted-foreground text-sm">{currency}</span>
                <input value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} type="number" placeholder="0.00" className="flex-1 bg-transparent text-sm font-bold outline-none text-foreground" />
              </div>

              <button onClick={handleAdd} style={{ backgroundColor: accentColor, boxShadow: `0 0 15px ${accentColor}4D` }} className="w-full text-white py-4 rounded-xl font-bold shadow-soft hover:scale-[1.02] active:scale-[0.98] transition-all">
                Add to Vault
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Asset Detail Overlay */}
      <AnimatePresence>
        {selectedAssetId && (
          <AssetDetailOverlay assetId={selectedAssetId} onClose={() => setSelectedAssetId(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
