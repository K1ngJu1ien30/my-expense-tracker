"use client";

import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { Maximize2, Minimize2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppContext } from "@/lib/context";
import { PLACE_CATEGORY_COLORS, PLACE_CATEGORY_LABELS } from "@/lib/wanderplanConstants";
import type { WPSavedPlace } from "@/lib/types";

const MapContainer = dynamic(() => import("react-leaflet").then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then(m => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then(m => m.Marker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then(m => m.Popup), { ssr: false });

function MapInner({ places, height }: { places: WPSavedPlace[]; height: string }) {
  const placesWithCoords = places.filter(p => p.location?.lat && p.location?.lng);
  const center = placesWithCoords.length > 0
    ? { lat: placesWithCoords[0].location!.lat, lng: placesWithCoords[0].location!.lng }
    : { lat: 3.139, lng: 101.6869 };

  useEffect(() => {
    import("leaflet/dist/leaflet.css");
  }, []);

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={13}
      className="w-full h-full"
      style={{ minHeight: height }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
      />
      {placesWithCoords.map(place => (
        <Marker key={place.id} position={[place.location!.lat, place.location!.lng]}>
          <Popup>
            <div className="text-sm">
              <p className="font-bold">{place.name}</p>
              <p className="text-xs" style={{ color: PLACE_CATEGORY_COLORS[place.category] }}>
                {PLACE_CATEGORY_LABELS[place.category]}
              </p>
              {place.google_maps_url && (
                <a href={place.google_maps_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 underline mt-1 block">
                  Open in Google Maps
                </a>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

/** Fullscreen overlay portalled to document.body so it escapes overflow:hidden ancestors */
function FullscreenMapPortal({ places, tripName, placeCount, onClose }: {
  places: WPSavedPlace[];
  tripName: string;
  placeCount: number;
  onClose: () => void;
}) {
  // Lock body scroll while fullscreen
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] bg-background flex flex-col"
    >
      {/* Fullscreen header */}
      <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border/40 shrink-0 safe-top">
        <div>
          <p className="font-bold text-sm text-foreground">{tripName}</p>
          <p className="text-[10px] text-muted-foreground font-medium">{placeCount} places</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-xl bg-muted active:scale-95 transition-transform"
        >
          <Minimize2 className="w-4 h-4 text-foreground" />
        </button>
      </div>

      {/* Full map */}
      <div className="flex-1 relative">
        <MapInner places={places} height="100%" />
      </div>

      {/* Floating legend */}
      <div className="absolute bottom-6 left-4 right-4 flex justify-center pb-safe">
        <div className="bg-card/95 backdrop-blur-xl border border-border/50 rounded-full px-4 py-2 shadow-heavy flex gap-3">
          {(Object.keys(PLACE_CATEGORY_COLORS) as (keyof typeof PLACE_CATEGORY_COLORS)[]).map(cat => (
            <div key={cat} className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PLACE_CATEGORY_COLORS[cat] }} />
              {PLACE_CATEGORY_LABELS[cat]}
            </div>
          ))}
        </div>
      </div>
    </motion.div>,
    document.body
  );
}

export default function MapPage() {
  const { accentColor, wpTrips, wpActiveTripId, wpPlaces } = useAppContext();
  const [isFullscreen, setIsFullscreen] = useState(false);

  const trip = wpTrips.find(t => t.id === wpActiveTripId) || wpTrips[0];
  const places = useMemo(() => trip ? wpPlaces.filter(p => p.trip_id === trip.id) : [], [trip, wpPlaces]);
  const hasCoords = useMemo(() => places.some(p => p.location?.lat && p.location?.lng), [places]);

  if (!trip) return <div className="p-6 text-center text-muted-foreground font-medium">Create a trip to see the map.</div>;

  return (
    <>
      <div className="p-6 space-y-4 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">{trip.name} — Map</h2>
          {hasCoords && (
            <button
              onClick={() => setIsFullscreen(true)}
              className="p-2 rounded-xl active:scale-95 transition-transform"
              style={{ backgroundColor: `${accentColor}1A`, color: accentColor }}
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {!hasCoords ? (
          <div className="text-center py-12 space-y-2">
            <p className="text-4xl">📍</p>
            <p className="font-bold text-foreground">No places with coordinates yet</p>
            <p className="text-xs text-muted-foreground font-medium">Add places with addresses in the Places tab to see them on the map.</p>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden border border-border/40 shadow-soft" style={{ height: "60vh" }}>
            <MapInner places={places} height="60vh" />
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap gap-2">
          {(Object.keys(PLACE_CATEGORY_COLORS) as (keyof typeof PLACE_CATEGORY_COLORS)[]).map(cat => (
            <div key={cat} className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PLACE_CATEGORY_COLORS[cat] }} />
              {PLACE_CATEGORY_LABELS[cat]}
            </div>
          ))}
        </div>
      </div>

      {/* Fullscreen map overlay — portalled to body to escape overflow:hidden */}
      <AnimatePresence>
        {isFullscreen && hasCoords && (
          <FullscreenMapPortal
            places={places}
            tripName={trip.name}
            placeCount={places.filter(p => p.location).length}
            onClose={() => setIsFullscreen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
