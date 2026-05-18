"use client";

import { useState, useMemo } from "react";
import { Plus, Trash2, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppContext } from "@/lib/context";
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS, DOCUMENT_TYPE_ICONS } from "@/lib/wanderplanConstants";
import CustomDatePicker from "@/components/CustomDatePicker";
import type { WPDocumentType } from "@/lib/types";

export default function DocumentsPage() {
  const {
    accentColor, wpTrips, wpActiveTripId, wpDocuments,
    createWPDocument, deleteWPDocument, triggerToast,
  } = useAppContext();

  const trip = wpTrips.find(t => t.id === wpActiveTripId) || wpTrips[0];
  const docs = useMemo(() => trip ? wpDocuments.filter(d => d.trip_id === trip.id) : [], [trip, wpDocuments]);

  const [showAdd, setShowAdd] = useState(false);
  const [docType, setDocType] = useState<WPDocumentType>("flight");
  const [title, setTitle] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [bookingRef, setBookingRef] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");

  const handleAdd = async () => {
    if (!trip || !title.trim()) return;
    await createWPDocument(trip.id, {
      type: docType,
      title: title.trim(),
      file_url: null,
      file_type: externalUrl ? "link" : null,
      external_url: externalUrl || null,
      booking_ref: bookingRef || null,
      valid_from: validFrom || null,
      valid_until: validUntil || null,
      notes: notes || null,
    } as never);
    setShowAdd(false);
    setTitle(""); setExternalUrl(""); setBookingRef(""); setValidFrom(""); setValidUntil(""); setNotes("");
    triggerToast("Document saved!");
  };

  if (!trip) return <div className="p-6 text-center text-muted-foreground font-medium">Create a trip first.</div>;

  // Group by type
  const grouped = useMemo(() => {
    const g: Record<string, typeof docs> = {};
    docs.forEach(d => { if (!g[d.type]) g[d.type] = []; g[d.type].push(d); });
    return g;
  }, [docs]);

  return (
    <div className="p-6 space-y-4 animate-in fade-in duration-500">
      <h2 className="text-lg font-bold text-foreground">{trip.name} — Documents</h2>

      <button onClick={() => setShowAdd(true)} style={{ backgroundColor: accentColor }} className="w-full py-3 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.97] transition-all">
        <Plus className="w-4 h-4" /> Add Document
      </button>

      {Object.entries(grouped).map(([type, items]) => (
        <div key={type}>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <span>{DOCUMENT_TYPE_ICONS[type as WPDocumentType]}</span> {DOCUMENT_TYPE_LABELS[type as WPDocumentType]}
          </p>
          <div className="space-y-2">
            {items.map(doc => (
              <div key={doc.id} className="bg-card rounded-2xl shadow-soft border border-border/40 p-4 flex items-start gap-3">
                <span className="text-2xl shrink-0">{DOCUMENT_TYPE_ICONS[doc.type]}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-foreground">{doc.title}</p>
                  {doc.booking_ref && <p className="text-[10px] text-muted-foreground font-medium mt-0.5">Ref: {doc.booking_ref}</p>}
                  {(doc.valid_from || doc.valid_until) && (
                    <p className="text-[10px] text-muted-foreground font-medium">{doc.valid_from || "?"} — {doc.valid_until || "?"}</p>
                  )}
                  {doc.notes && <p className="text-[10px] text-muted-foreground mt-1 truncate">{doc.notes}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {doc.external_url && (
                    <a href={doc.external_url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg text-muted-foreground hover:text-sky-500"><ExternalLink className="w-3.5 h-3.5" /></a>
                  )}
                  <button onClick={() => deleteWPDocument(doc.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {docs.length === 0 && (
        <div className="text-center py-12 space-y-2">
          <p className="text-4xl">📄</p>
          <p className="font-bold text-foreground">No documents yet</p>
          <p className="text-xs text-muted-foreground font-medium">Add your flight bookings, hotel confirmations, insurance docs, etc.</p>
        </div>
      )}

      {/* Add Document Modal */}
      <AnimatePresence>
        {showAdd && (
          <div className="fixed inset-0 z-[200] flex items-end justify-center">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAdd(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 300 }} className="relative w-full max-w-md bg-card rounded-t-[2rem] border-t border-border/50 shadow-heavy p-6 space-y-3 pb-safe">
              <div className="w-10 h-1 bg-muted rounded-full mx-auto" />
              <h2 className="text-lg font-bold text-foreground">Add Document</h2>

              <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                {DOCUMENT_TYPES.map(t => (
                  <button key={t} onClick={() => setDocType(t)} className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all ${docType === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {DOCUMENT_TYPE_ICONS[t]} {DOCUMENT_TYPE_LABELS[t]}
                  </button>
                ))}
              </div>

              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Document title" className="w-full bg-muted/60 rounded-xl px-4 py-3 text-sm font-semibold outline-none border border-border text-foreground placeholder:text-muted-foreground" />
              <input value={externalUrl} onChange={e => setExternalUrl(e.target.value)} placeholder="Booking URL (optional)" className="w-full bg-muted/60 rounded-xl px-4 py-3 text-sm font-semibold outline-none border border-border text-foreground placeholder:text-muted-foreground" />
              <input value={bookingRef} onChange={e => setBookingRef(e.target.value)} placeholder="Booking reference" className="w-full bg-muted/60 rounded-xl px-4 py-3 text-sm font-semibold outline-none border border-border text-foreground placeholder:text-muted-foreground" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground mb-1">Valid from</p>
                  <CustomDatePicker value={validFrom} onChange={setValidFrom} accentColor={accentColor} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground mb-1">Valid until</p>
                  <CustomDatePicker value={validUntil} onChange={setValidUntil} accentColor={accentColor} />
                </div>
              </div>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes" rows={2} className="w-full bg-muted/60 rounded-xl px-4 py-3 text-sm font-semibold outline-none border border-border text-foreground placeholder:text-muted-foreground resize-none" />

              <button onClick={handleAdd} disabled={!title.trim()} style={{ backgroundColor: accentColor }} className="w-full py-4 rounded-2xl text-white font-bold text-sm active:scale-[0.97] transition-all disabled:opacity-40">Save Document</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
