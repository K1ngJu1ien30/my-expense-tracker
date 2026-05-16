"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Plus, Trash2, Star, Check, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppContext } from "@/lib/context";
import { PLACE_CATEGORIES, PLACE_CATEGORY_LABELS, PLACE_CATEGORY_COLORS } from "@/lib/wanderplanConstants";
import type { WPPlaceCategory } from "@/lib/types";

type NominatimResult = { display_name: string; lat: string; lon: string };

export default function PlacesPage() {
  const {
    accentColor, wpTrips, wpActiveTripId, wpPlaces,
    createWPPlace, deleteWPPlace, toggleWPPlaceVisited, triggerToast,
  } = useAppContext();

  const trip = wpTrips.find(t => t.id === wpActiveTripId) || wpTrips[0];
  const [filter, setFilter] = useState<WPPlaceCategory | "all">("all");
  const [visitedFilter, setVisitedFilter] = useState<"all" | "visited" | "unvisited">("all");

  const places = useMemo(() => {
    if (!trip) return [];
    let list = wpPlaces.filter(p => p.trip_id === trip.id);
    if (filter !== "all") list = list.filter(p => p.category === filter);
    if (visitedFilter === "visited") list = list.filter(p => p.is_visited);
    if (visitedFilter === "unvisited") list = list.filter(p => !p.is_visited);
    return list;
  }, [trip, wpPlaces, filter, visitedFilter]);

  const [showAdd, setShowAdd] = useState(false);
  const [placeName, setPlaceName] = useState("");
  const [placeCat, setPlaceCat] = useState<WPPlaceCategory>("eat");
  const [subCat, setSubCat] = useState("");
  const [rating, setRating] = useState(0);
  const [priceLevel, setPriceLevel] = useState(0);
  const [notes, setNotes] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!searchQuery || searchQuery.length < 3) { setSearchResults([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=5`, { headers: { "User-Agent": "WanderPlan/1.0" } });
        const data: NominatimResult[] = await res.json();
        setSearchResults(data);
      } catch { setSearchResults([]); }
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery]);

  const selectResult = (r: NominatimResult) => {
    setSelectedLocation({ lat: Number(r.lat), lng: Number(r.lon), address: r.display_name });
    setSearchQuery(r.display_name);
    setSearchResults([]);
  };

  const handleAdd = async () => {
    if (!trip || !placeName.trim()) return;
    await createWPPlace(trip.id, {
      name: placeName.trim(),
      category: placeCat,
      sub_category: subCat || null,
      location: selectedLocation,
      google_maps_url: selectedLocation ? `https://www.google.com/maps?q=${selectedLocation.lat},${selectedLocation.lng}` : null,
      website_url: null,
      rating: rating || null,
      price_level: priceLevel || null,
      notes: notes || null,
      tags: [],
      opening_hours: null,
      is_visited: false,
    } as never);
    setShowAdd(false);
    setPlaceName(""); setSubCat(""); setRating(0); setPriceLevel(0); setNotes(""); setSearchQuery(""); setSelectedLocation(null);
    triggerToast("Place saved!");
  };

  if (!trip) return <div className="p-6 text-center text-muted-foreground font-medium">Create a trip first.</div>;

  return (
    <div className="p-6 space-y-4 animate-in fade-in duration-500">
      <h2 className="text-lg font-bold text-foreground">{trip.name} — Saved Places</h2>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
        <button onClick={() => setFilter("all")} className={`px-3 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all ${filter === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>All</button>
        {PLACE_CATEGORIES.map(c => (
          <button key={c} onClick={() => setFilter(c)} className="px-3 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all" style={filter === c ? { backgroundColor: PLACE_CATEGORY_COLORS[c], color: "#fff" } : { backgroundColor: `${PLACE_CATEGORY_COLORS[c]}1A`, color: PLACE_CATEGORY_COLORS[c] }}>
            {PLACE_CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        {(["all", "visited", "unvisited"] as const).map(v => (
          <button key={v} onClick={() => setVisitedFilter(v)} className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${visitedFilter === v ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}>{v}</button>
        ))}
      </div>

      {/* Add button */}
      <button onClick={() => setShowAdd(true)} style={{ backgroundColor: accentColor }} className="w-full py-3 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.97] transition-all">
        <Plus className="w-4 h-4" /> Add Place
      </button>

      {/* Places list */}
      <div className="space-y-3">
        {places.map(place => (
          <div key={place.id} className="bg-card rounded-2xl shadow-soft border border-border/40 p-4">
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-12 rounded-full shrink-0" style={{ backgroundColor: PLACE_CATEGORY_COLORS[place.category] }} />
              <div className="flex-1 min-w-0">
                <p className={`font-bold text-sm ${place.is_visited ? "text-muted-foreground line-through" : "text-foreground"}`}>{place.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${PLACE_CATEGORY_COLORS[place.category]}1A`, color: PLACE_CATEGORY_COLORS[place.category] }}>{PLACE_CATEGORY_LABELS[place.category]}</span>
                  {place.rating && <span className="flex items-center gap-0.5 text-[10px] text-amber-500 font-bold"><Star className="w-3 h-3 fill-amber-500" />{place.rating}</span>}
                  {place.price_level && <span className="text-[10px] text-muted-foreground font-bold">{"$".repeat(place.price_level)}</span>}
                </div>
                {place.notes && <p className="text-[10px] text-muted-foreground mt-1 truncate">{place.notes}</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {place.google_maps_url && (
                  <a href={place.google_maps_url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg text-muted-foreground hover:text-sky-500"><ExternalLink className="w-3.5 h-3.5" /></a>
                )}
                <button onClick={() => toggleWPPlaceVisited(place.id)} className={`p-1.5 rounded-lg ${place.is_visited ? "text-emerald-500" : "text-muted-foreground hover:text-emerald-500"}`}><Check className="w-3.5 h-3.5" /></button>
                <button onClick={() => deleteWPPlace(place.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          </div>
        ))}

        {places.length === 0 && <p className="text-center py-8 text-sm text-muted-foreground font-medium">No places saved yet.</p>}
      </div>

      {/* Add Place Modal */}
      <AnimatePresence>
        {showAdd && (
          <div className="fixed inset-0 z-[200] flex items-end justify-center">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAdd(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 300 }} className="relative w-full max-w-md bg-card rounded-t-[2rem] border-t border-border/50 shadow-heavy p-6 space-y-3 pb-safe max-h-[80vh] overflow-y-auto">
              <div className="w-10 h-1 bg-muted rounded-full mx-auto" />
              <h2 className="text-lg font-bold text-foreground">Save Place</h2>

              <input value={placeName} onChange={e => setPlaceName(e.target.value)} placeholder="Place name" className="w-full bg-muted/60 rounded-xl px-4 py-3 text-sm font-semibold outline-none border border-border text-foreground placeholder:text-muted-foreground" />

              <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                {PLACE_CATEGORIES.map(c => (
                  <button key={c} onClick={() => setPlaceCat(c)} className="whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all" style={placeCat === c ? { backgroundColor: PLACE_CATEGORY_COLORS[c], color: "#fff" } : { backgroundColor: `${PLACE_CATEGORY_COLORS[c]}1A`, color: PLACE_CATEGORY_COLORS[c] }}>
                    {PLACE_CATEGORY_LABELS[c]}
                  </button>
                ))}
              </div>

              <input value={subCat} onChange={e => setSubCat(e.target.value)} placeholder="Sub-category (optional)" className="w-full bg-muted/60 rounded-xl px-4 py-3 text-sm font-semibold outline-none border border-border text-foreground placeholder:text-muted-foreground" />

              {/* Nominatim search */}
              <div className="relative">
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search address..." className="w-full bg-muted/60 rounded-xl px-4 py-3 text-sm font-semibold outline-none border border-border text-foreground placeholder:text-muted-foreground" />
                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border/50 rounded-xl shadow-heavy z-10 max-h-40 overflow-y-auto">
                    {searchResults.map((r, i) => (
                      <button key={i} onClick={() => selectResult(r)} className="w-full text-left px-4 py-2 text-xs text-foreground hover:bg-muted/50 truncate border-b border-border/20 last:border-0">
                        {r.display_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-bold text-muted-foreground mb-1">Rating (1-5)</p>
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map(n => (
                      <button key={n} onClick={() => setRating(rating === n ? 0 : n)} className="p-1"><Star className={`w-5 h-5 ${n <= rating ? "fill-amber-500 text-amber-500" : "text-muted-foreground"}`} /></button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold text-muted-foreground mb-1">Price Level</p>
                  <div className="flex gap-1">
                    {[1,2,3,4].map(n => (
                      <button key={n} onClick={() => setPriceLevel(priceLevel === n ? 0 : n)} className={`px-2 py-1 rounded-lg text-xs font-bold ${n <= priceLevel ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"}`}>{"$".repeat(n)}</button>
                    ))}
                  </div>
                </div>
              </div>

              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes" rows={2} className="w-full bg-muted/60 rounded-xl px-4 py-3 text-sm font-semibold outline-none border border-border text-foreground placeholder:text-muted-foreground resize-none" />

              <button onClick={handleAdd} disabled={!placeName.trim()} style={{ backgroundColor: accentColor }} className="w-full py-4 rounded-2xl text-white font-bold text-sm active:scale-[0.97] transition-all disabled:opacity-40">Save Place</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
