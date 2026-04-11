"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Plus, Trash2, Rss, Film, Tv, X } from "lucide-react";
import Link from "next/link";
import { useAppContext } from "@/lib/context";
import { supabase } from "@/lib/supabase";

type RadarSource = {
  id: string;
  user_id?: string;
  source_type: "rss" | "tmdb_cinema" | "tmdb_streaming";
  name: string;
  url: string | null;
  keywords: string | null;
};

const TYPE_META: Record<string, { icon: React.ReactNode; label: string; color: string; bg: string }> = {
  rss: { icon: <Rss className="w-4 h-4" />, label: "RSS Feed", color: "text-orange-500", bg: "bg-orange-500/10" },
  tmdb_cinema: { icon: <Film className="w-4 h-4" />, label: "In Cinemas (MY)", color: "text-pink-500", bg: "bg-pink-500/10" },
  tmdb_streaming: { icon: <Tv className="w-4 h-4" />, label: "Streaming Drops", color: "text-violet-500", bg: "bg-violet-500/10" },
};

export default function RadarSettingsPage() {
  const { session, accentColor, triggerToast, confirmAction } = useAppContext();
  const [sources, setSources] = useState<RadarSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Form state
  const [formType, setFormType] = useState<"rss" | "tmdb_cinema" | "tmdb_streaming">("rss");
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formKeywords, setFormKeywords] = useState("");

  useEffect(() => {
    if (!session?.user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("radar_sources")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });
      if (data) setSources(data as RadarSource[]);
      setLoading(false);
    };
    fetch();
  }, [session]);

  const resetForm = () => {
    setFormType("rss");
    setFormName("");
    setFormUrl("");
    setFormKeywords("");
  };

  const handleAdd = async () => {
    if (!formName.trim()) return triggerToast("Name is required");
    if (formType === "rss" && !formUrl.trim()) return triggerToast("RSS URL is required");

    const payload: any = {
      user_id: session?.user?.id,
      source_type: formType,
      name: formName.trim(),
      url: formType === "rss" ? formUrl.trim() : null,
      keywords: formType === "rss" && formKeywords.trim() ? formKeywords.trim() : null,
    };

    const { data, error } = await supabase.from("radar_sources").insert(payload).select().single();
    if (!error && data) {
      setSources((prev) => [data as RadarSource, ...prev]);
      triggerToast("Source added");
      setShowModal(false);
      resetForm();
    } else {
      triggerToast("Failed to add source");
    }
  };

  const handleDelete = (id: string, name: string) => {
    confirmAction("Delete Source", `Remove "${name}" from your radar?`, async () => {
      const { error } = await supabase.from("radar_sources").delete().eq("id", id);
      if (!error) {
        setSources((prev) => prev.filter((s) => s.id !== id));
        triggerToast("Source removed");
      }
    });
  };

  return (
    <div className="p-6 animate-in fade-in duration-500 space-y-6 pb-32">
      {/* Header */}
      <div className="flex items-center gap-3 pt-2">
        <Link href="/hub/radar" className="p-2 bg-muted rounded-xl hover:bg-border transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Radar Sources</h1>
          <p className="text-xs text-muted-foreground font-medium">Manage your custom feeds & trackers</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          style={{ backgroundColor: accentColor }}
          className="p-2.5 rounded-xl text-white shadow-sm active:scale-95 transition-transform"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Sources List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : sources.length === 0 ? (
        <div className="bg-card p-8 rounded-3xl shadow-soft border border-border/40 text-center">
          <p className="text-3xl mb-3">📡</p>
          <p className="text-muted-foreground text-sm font-medium">No sources yet. Tap + to add your first RSS feed or TMDB tracker.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sources.map((src, i) => {
            const meta = TYPE_META[src.source_type];
            return (
              <motion.div
                key={src.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="bg-card p-4 rounded-2xl shadow-sm border border-border/40"
              >
                <div className="flex items-start gap-3">
                  <div className={`${meta.bg} ${meta.color} p-2.5 rounded-xl shrink-0`}>{meta.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-foreground leading-snug">{src.name}</p>
                    <p className="text-[11px] text-muted-foreground font-medium mt-0.5">{meta.label}</p>
                    {src.url && (
                      <p className="text-[10px] text-muted-foreground truncate mt-1">{src.url}</p>
                    )}
                    {src.keywords && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {src.keywords.split(",").map((kw) => (
                          <span
                            key={kw.trim()}
                            style={{ color: accentColor, backgroundColor: `${accentColor}1A` }}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          >
                            {kw.trim()}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(src.id, src.name)}
                    className="p-2 bg-red-500/10 rounded-xl text-red-500 hover:bg-red-500/20 transition-colors shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Add Source Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[200] flex items-end justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-md"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="bg-card w-full max-w-lg rounded-t-[2rem] shadow-heavy z-10 p-6 space-y-5 border-t border-border/50 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">Add New Source</h2>
                <button onClick={() => setShowModal(false)} className="p-2 bg-muted rounded-xl">
                  <X className="w-4 h-4 text-foreground" />
                </button>
              </div>

              {/* Source Type Selector */}
              <div>
                <label className="text-xs font-bold text-muted-foreground mb-2 block">Source Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["rss", "tmdb_cinema", "tmdb_streaming"] as const).map((t) => {
                    const m = TYPE_META[t];
                    const active = formType === t;
                    return (
                      <button
                        key={t}
                        onClick={() => setFormType(t)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                          active ? "border-current" : "border-border/40 bg-card"
                        }`}
                        style={active ? { borderColor: accentColor, backgroundColor: `${accentColor}0D` } : {}}
                      >
                        <span className={m.color}>{m.icon}</span>
                        <span className="text-[10px] font-bold text-foreground">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="text-xs font-bold text-muted-foreground mb-1.5 block">Name</label>
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={formType === "rss" ? 'e.g. "Photography"' : 'e.g. "Movies"'}
                  className="w-full bg-muted rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/30 text-foreground placeholder:text-muted-foreground"
                />
              </div>

              {/* RSS-specific fields */}
              {formType === "rss" && (
                <>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground mb-1.5 block">RSS Feed URL</label>
                    <input
                      value={formUrl}
                      onChange={(e) => setFormUrl(e.target.value)}
                      placeholder="https://example.com/feed/"
                      className="w-full bg-muted rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/30 text-foreground placeholder:text-muted-foreground"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground mb-1.5 block">
                      Keywords <span className="font-medium">(comma-separated, optional)</span>
                    </label>
                    <input
                      value={formKeywords}
                      onChange={(e) => setFormKeywords(e.target.value)}
                      placeholder="sony, fujifilm, canon"
                      className="w-full bg-muted rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/30 text-foreground placeholder:text-muted-foreground"
                    />
                  </div>
                </>
              )}

              {/* TMDB info */}
              {formType !== "rss" && (
                <div className="bg-muted/50 rounded-xl p-4 border border-border/30">
                  <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                    {formType === "tmdb_cinema"
                      ? "🎬 This will fetch movies currently playing in Malaysian cinemas via TMDB."
                      : "📺 This will fetch trending streaming drops (Netflix, etc.) available in Malaysia via TMDB."}
                  </p>
                </div>
              )}

              {/* Submit */}
              <button
                onClick={handleAdd}
                style={{ backgroundColor: accentColor }}
                className="w-full py-3.5 rounded-xl text-white font-bold text-sm shadow-sm active:scale-[0.98] transition-transform"
              >
                Add Source
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
