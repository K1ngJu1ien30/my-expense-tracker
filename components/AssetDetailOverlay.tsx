"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Plus, X, Calendar, Wrench, Edit2, Trash2, ChevronDown } from "lucide-react";
import { useAppContext } from "@/lib/context";
import { supabase } from "@/lib/supabase";
import type { AssetLog } from "@/lib/context";
import CustomDatePicker from "@/components/CustomDatePicker";

const EMOJI_OPTIONS = ["📱", "💻", "📸", "👟", "⌚", "🎧", "🎮", "🚗", "🏠", "🛋️", "🧳", "👜", "📦", "🔧", "🎸"];

type Props = {
  assetId: string;
  onClose: () => void;
};

export default function AssetDetailOverlay({ assetId, onClose }: Props) {
  const { assets, accentColor, triggerToast, session, updateAsset, deleteAsset, confirmAction, currency } = useAppContext();

  const asset = useMemo(() => assets.find(a => a.id === assetId), [assets, assetId]);

  const [logs, setLogs] = useState<AssetLog[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAddLog, setShowAddLog] = useState(false);
  const [editingLog, setEditingLog] = useState<AssetLog | null>(null);
  const [logDesc, setLogDesc] = useState("");
  const [logCost, setLogCost] = useState("");
  const [logDate, setLogDate] = useState(() => new Date().toISOString().split("T")[0]);

  const [showEdit, setShowEdit] = useState(false);
  const [showEditCatDropdown, setShowEditCatDropdown] = useState(false);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editEmoji, setEditEmoji] = useState("📦");
  const [editDate, setEditDate] = useState("");
  const [editPrice, setEditPrice] = useState("");

  const existingCategories = useMemo(() => [...new Set(assets.map(a => a.category).filter(Boolean))], [assets]);

  useEffect(() => {
    if (!assetId || !session) {
      setLoading(false);
      return;
    }
    const fetchLogs = async () => {
      try {
        const { data } = await supabase
          .from("asset_logs")
          .select("*")
          .eq("asset_id", assetId)
          .order("log_date", { ascending: false });
        if (data) setLogs(data as AssetLog[]);
      } catch (err) {
        console.error("Failed to fetch asset logs:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [assetId, session]);

  const resetLogForm = () => {
    setEditingLog(null);
    setLogDesc("");
    setLogCost("");
    setLogDate(new Date().toISOString().split("T")[0]);
  };

  const openAddLog = () => {
    resetLogForm();
    setShowAddLog(true);
  };

  const openEditLog = (log: AssetLog) => {
    setEditingLog(log);
    setLogDesc(log.description);
    setLogCost(String(log.cost || 0));
    setLogDate(log.log_date);
    setShowAddLog(true);
  };

  const handleSaveLog = async () => {
    if (!logDesc) return;

    if (editingLog) {
      const { data, error } = await supabase
        .from("asset_logs")
        .update({ description: logDesc, cost: Number(logCost) || 0, log_date: logDate })
        .eq("id", editingLog.id)
        .select()
        .single();
      if (!error && data) {
        setLogs(prev => prev.map(l => l.id === editingLog.id ? (data as AssetLog) : l));
        triggerToast("Log updated!");
      }
    } else {
      const payload = { asset_id: assetId, description: logDesc, cost: Number(logCost) || 0, log_date: logDate };
      const { data, error } = await supabase.from("asset_logs").insert(payload).select().single();
      if (!error && data) {
        setLogs(prev => [data as AssetLog, ...prev]);
        triggerToast("Maintenance log added!");
      }
    }

    setShowAddLog(false);
    resetLogForm();
  };

  const handleDeleteLog = (logId: string) => {
    confirmAction("Delete Log", "Remove this maintenance entry?", async () => {
      const { error } = await supabase.from("asset_logs").delete().eq("id", logId);
      if (!error) {
        setLogs(prev => prev.filter(l => l.id !== logId));
        triggerToast("Log removed");
      }
    });
  };

  const openEdit = () => {
    if (!asset) return;
    setEditName(asset.name);
    setEditCategory(asset.category);
    setEditEmoji(asset.emoji_icon || "📦");
    setEditDate(asset.purchase_date || "");
    setEditPrice(String(asset.purchase_price || 0));
    setShowEdit(true);
  };

  const handleSaveEdit = async () => {
    if (!editName) return;
    await updateAsset(assetId, {
      name: editName,
      category: editCategory || "General",
      emoji_icon: editEmoji,
      purchase_date: editDate,
      purchase_price: Number(editPrice) || 0,
    });
    triggerToast("Asset updated!");
    setShowEdit(false);
  };

  const handleDelete = () => {
    if (!asset) return;
    confirmAction("Delete Asset", `Permanently remove "${asset.name}" and all its maintenance logs?`, async () => {
      await deleteAsset(assetId);
      triggerToast("Asset deleted");
      onClose();
    });
  };

  const totalMaintenanceCost = useMemo(() => (logs || []).reduce((sum, l) => sum + Number(l.cost || 0), 0), [logs]);
  const trueTotalInvestment = useMemo(() => Number(asset?.purchase_price || 0) + totalMaintenanceCost, [asset, totalMaintenanceCost]);

  const getDaysActive = (dateStr: string) => {
    if (!dateStr) return 0;
    return Math.max(0, Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / 86400000));
  };

  const costPerDay = useMemo(() => {
    if (!asset) return 0;
    const days = Math.max(1, getDaysActive(asset.purchase_date));
    return trueTotalInvestment / days;
  }, [asset, trueTotalInvestment]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[200] bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-[3px] border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="fixed inset-0 z-[200] bg-background flex flex-col items-center justify-center">
        <p className="text-muted-foreground font-medium">Asset not found</p>
        <button onClick={onClose} className="text-primary font-bold text-sm mt-2">Back to Vault</button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 280 }}
      className="fixed inset-0 z-[200] bg-background overflow-y-auto"
    >
      <div className="p-6 space-y-6 pb-32">
        {/* Header */}
        <div className="flex items-center gap-3 pt-2">
          <button type="button" aria-label="Back" onClick={onClose} className="p-2 bg-muted rounded-xl hover:bg-border transition-colors">
            <ArrowLeft className="w-5 h-5 text-foreground" aria-hidden="true" />
          </button>
          <h1 className="text-xl font-bold flex-1 truncate">{asset.name}</h1>
          <button type="button" aria-label={`Edit ${asset.name}`} onClick={openEdit} className="p-2 text-muted-foreground hover:text-primary transition-colors">
            <Edit2 className="w-4 h-4" aria-hidden="true" />
          </button>
          <button type="button" aria-label={`Delete ${asset.name}`} onClick={handleDelete} className="p-2 text-muted-foreground hover:text-red-500 transition-colors">
            <Trash2 className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Hero Card */}
        <div className="bg-card p-6 rounded-3xl shadow-soft border border-border/40 space-y-4">
          <div className="flex items-center gap-4">
            <div className="text-5xl">{asset.emoji_icon || "📦"}</div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-xl text-foreground leading-tight">{asset.name}</p>
              <p className="text-xs font-semibold text-muted-foreground mt-0.5">{asset.category}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="bg-muted/30 p-3 rounded-xl text-center">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Purchase</p>
              <p className="text-sm font-black text-foreground mt-0.5">{currency} {Number(asset.purchase_price).toFixed(2)}</p>
            </div>
            <div className="bg-muted/30 p-3 rounded-xl text-center">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Active</p>
              <p className="text-sm font-black mt-0.5" style={{ color: accentColor }}>{getDaysActive(asset.purchase_date)} days</p>
            </div>
            <div className="bg-muted/30 p-3 rounded-xl text-center">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Cost / Day</p>
              <p className="text-sm font-black mt-0.5" style={{ color: accentColor }}>{currency} {costPerDay.toFixed(2)}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/30 p-3 rounded-xl text-center">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Maint. Cost</p>
              <p className="text-sm font-black text-foreground mt-0.5">{currency} {totalMaintenanceCost.toFixed(2)}</p>
            </div>
            <div className="bg-muted/30 p-3 rounded-xl text-center">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">True Total</p>
              <p className="text-sm font-black text-foreground mt-0.5">{currency} {trueTotalInvestment.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Maintenance Timeline */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-foreground">Maintenance Log</h3>
            <button onClick={openAddLog} style={{ color: accentColor, backgroundColor: `${accentColor}1A` }} className="p-2 rounded-full hover:scale-105 active:scale-95 transition-all">
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {(logs || []).length === 0 ? (
            <div className="bg-card p-6 rounded-2xl border border-border/40 text-center">
              <Wrench className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground font-medium">No maintenance logs yet.</p>
              <p className="text-xs text-muted-foreground/60 font-medium mt-1">This asset is running clean.</p>
            </div>
          ) : (
            <div className="relative pl-6">
              <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-border" />
              {(logs || []).map((log, i) => (
                <motion.div key={log.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="relative mb-4 last:mb-0">
                  <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full border-2 border-border bg-card" style={i === 0 ? { borderColor: accentColor, backgroundColor: `${accentColor}30` } : {}} />
                  <div className="bg-card p-4 rounded-2xl border border-border/40 shadow-sm ml-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground leading-snug">{log.description}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Calendar className="w-3 h-3 text-muted-foreground" />
                          <p className="text-[10px] font-semibold text-muted-foreground">{formatDate(log.log_date)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {Number(log.cost) > 0 && (
                          <span className="text-xs font-black text-rose-500 bg-rose-500/10 px-2 py-1 rounded-lg">+ {currency} {Number(log.cost).toFixed(2)}</span>
                        )}
                        <button type="button" aria-label="Edit log entry" onClick={() => openEditLog(log)} className="p-1.5 text-muted-foreground hover:text-primary transition-colors">
                          <Edit2 className="w-3 h-3" aria-hidden="true" />
                        </button>
                        <button type="button" aria-label="Delete log entry" onClick={() => handleDeleteLog(log.id)} className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors">
                          <Trash2 className="w-3 h-3" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Log Modal */}
      <AnimatePresence>
        {showAddLog && (
          <div className="fixed inset-0 z-[250] flex items-end justify-center sm:items-center p-0 sm:p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setShowAddLog(false); resetLogForm(); }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="bg-card w-full sm:max-w-md rounded-t-[2.5rem] sm:rounded-[2rem] shadow-heavy z-10 overflow-hidden flex flex-col p-6 space-y-4">
              <div className="w-12 h-1.5 bg-border rounded-full mx-auto mb-2 shrink-0 sm:hidden" />
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg text-foreground">{editingLog ? "Edit Log" : "Add Maintenance Log"}</h3>
                <button type="button" aria-label="Close" onClick={() => { setShowAddLog(false); resetLogForm(); }} className="p-1 px-2 bg-muted hover:bg-border rounded-full transition-colors"><X className="w-5 h-5 text-muted-foreground" aria-hidden="true" /></button>
              </div>
              <input value={logDesc} onChange={e => setLogDesc(e.target.value)} placeholder="Description (e.g. Replaced battery)" className="w-full bg-muted/60 rounded-xl px-4 py-3 text-sm font-semibold outline-none border border-border text-foreground" autoFocus />
              <CustomDatePicker value={logDate} onChange={setLogDate} accentColor={accentColor} />
              <div className="flex items-center gap-2 bg-muted/60 rounded-xl px-4 py-3 border border-border">
                <span className="font-bold text-muted-foreground text-sm">{currency}</span>
                <input value={logCost} onChange={e => setLogCost(e.target.value)} type="number" placeholder="0.00 (optional)" className="flex-1 bg-transparent text-sm font-bold outline-none text-foreground" />
              </div>
              <button onClick={handleSaveLog} style={{ backgroundColor: accentColor, boxShadow: `0 0 15px ${accentColor}4D` }} className="w-full text-white py-4 rounded-xl font-bold shadow-soft hover:scale-[1.02] active:scale-[0.98] transition-all">
                {editingLog ? "Save Changes" : "Save Log Entry"}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Asset Modal */}
      <AnimatePresence>
        {showEdit && (
          <div className="fixed inset-0 z-[250] flex items-end justify-center sm:items-center p-0 sm:p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowEdit(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="bg-card w-full sm:max-w-md rounded-t-[2.5rem] sm:rounded-[2rem] shadow-heavy z-10 overflow-hidden flex flex-col p-6 pb-32 space-y-4 max-h-[85vh] overflow-y-auto hide-scrollbar">
              <div className="w-12 h-1.5 bg-border rounded-full mx-auto mb-2 shrink-0 sm:hidden" />
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg text-foreground">Edit Asset</h3>
                <button type="button" aria-label="Close" onClick={() => setShowEdit(false)} className="p-1 px-2 bg-muted hover:bg-border rounded-full transition-colors"><X className="w-5 h-5 text-muted-foreground" aria-hidden="true" /></button>
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Icon</p>
                <div className="flex flex-wrap gap-2">
                  {EMOJI_OPTIONS.map(e => (
                    <button key={e} onClick={() => setEditEmoji(e)} className={`text-2xl p-2 rounded-xl transition-all ${editEmoji === e ? "bg-primary/10 scale-110 shadow-sm" : "hover:bg-muted"}`}>{e}</button>
                  ))}
                </div>
              </div>
              <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Asset name" className="w-full bg-muted/60 rounded-xl px-4 py-3 text-sm font-semibold outline-none border border-border text-foreground" />

              {/* Category — custom dropdown + free-text */}
              <div className="relative">
                <div className="flex gap-2">
                  <input
                    value={editCategory}
                    onChange={e => setEditCategory(e.target.value)}
                    placeholder="Category"
                    className="flex-1 bg-muted/60 rounded-xl px-4 py-3 text-sm font-semibold outline-none border border-border text-foreground"
                  />
                  {existingCategories.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowEditCatDropdown(!showEditCatDropdown)}
                      className="bg-muted/60 rounded-xl px-3 border border-border text-muted-foreground hover:text-foreground active:scale-95 transition-all"
                    >
                      <ChevronDown className={`w-4 h-4 transition-transform ${showEditCatDropdown ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                </div>
                <AnimatePresence>
                  {showEditCatDropdown && existingCategories.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="absolute top-full left-0 right-0 mt-1.5 z-[60] bg-card border border-border/50 rounded-xl shadow-heavy overflow-hidden max-h-48 overflow-y-auto hide-scrollbar"
                    >
                      {existingCategories.map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => { setEditCategory(c); setShowEditCatDropdown(false); }}
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
              <CustomDatePicker value={editDate} onChange={setEditDate} accentColor={accentColor} />

              <div className="flex items-center gap-2 bg-muted/60 rounded-xl px-4 py-3 border border-border">
                <span className="font-bold text-muted-foreground text-sm">{currency}</span>
                <input value={editPrice} onChange={e => setEditPrice(e.target.value)} type="number" placeholder="0.00" className="flex-1 bg-transparent text-sm font-bold outline-none text-foreground" />
              </div>
              <button onClick={handleSaveEdit} style={{ backgroundColor: accentColor, boxShadow: `0 0 15px ${accentColor}4D` }} className="w-full text-white py-4 rounded-xl font-bold shadow-soft hover:scale-[1.02] active:scale-[0.98] transition-all">
                Save Changes
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
