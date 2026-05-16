"use client";

import { useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import { useAppContext } from "@/lib/context";
import { PLACE_CATEGORY_COLORS, PLACE_CATEGORY_LABELS } from "@/lib/wanderplanConstants";
import type { WPSavedPlace } from "@/lib/types";

// Dynamic imports for Leaflet (SSR-unsafe)
const MapContainer = dynamic(() => import("react-leaflet").then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then(m => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then(m => m.Marker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then(m => m.Popup), { ssr: false });

function MapInner({ places }: { places: WPSavedPlace[] }) {
  const placesWithCoords = places.filter(p => p.location?.lat && p.location?.lng);
  const center = placesWithCoords.length > 0
    ? { lat: placesWithCoords[0].location!.lat, lng: placesWithCoords[0].location!.lng }
    : { lat: 3.139, lng: 101.6869 };

  // Import leaflet CSS client-side — the proper way vs a <link> in body
  useEffect(() => {
    import("leaflet/dist/leaflet.css");
  }, []);

  return (
    <MapContainer center={[center.lat, center.lng]} zoom={13} className="w-full h-full rounded-3xl" style={{ minHeight: 400 }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>' />
      {placesWithCoords.map(place => (
        <Marker key={place.id} position={[place.location!.lat, place.location!.lng]}>
          <Popup>
            <div className="text-sm">
              <p className="font-bold">{place.name}</p>
              <p className="text-xs" style={{ color: PLACE_CATEGORY_COLORS[place.category] }}>{PLACE_CATEGORY_LABELS[place.category]}</p>
              {place.google_maps_url && (
                <a href={place.google_maps_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 underline mt-1 block">Open in Google Maps</a>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

export default function MapPage() {
  const { wpTrips, wpActiveTripId, wpPlaces } = useAppContext();

  const trip = wpTrips.find(t => t.id === wpActiveTripId) || wpTrips[0];
  const places = useMemo(() => trip ? wpPlaces.filter(p => p.trip_id === trip.id) : [], [trip, wpPlaces]);
  const hasCoords = useMemo(() => places.some(p => p.location?.lat && p.location?.lng), [places]);

  if (!trip) return <div className="p-6 text-center text-muted-foreground font-medium">Create a trip to see the map.</div>;

  return (
    <div className="p-6 space-y-4 animate-in fade-in duration-500">
      <h2 className="text-lg font-bold text-foreground">{trip.name} — Map</h2>

      {!hasCoords ? (
        <div className="text-center py-12 space-y-2">
          <p className="text-4xl">📍</p>
          <p className="font-bold text-foreground">No places with coordinates yet</p>
          <p className="text-xs text-muted-foreground font-medium">Add places with addresses in the Places tab to see them on the map.</p>
        </div>
      ) : (
        <div className="rounded-3xl overflow-hidden border border-border/40 shadow-soft" style={{ height: 450 }}>
          <MapInner places={places} />
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
  );
}
