"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X, MapPin, Loader2 } from "lucide-react";
import { geocodeCity } from "@/lib/weather";

/**
 * Lets the user pin a Primary + Secondary city name for weather-driven
 * theming. Cities are geocoded client-side via Open-Meteo's free API —
 * NO GPS permission, NO API key, NO background service. Coordinates are
 * cached forever once resolved.
 *
 * We validate the input by actually calling the geocoder before saving,
 * so invalid city names don't silently break theming later. Shows a
 * check-mark + country code next to confirmed cities.
 */
export function LocationsModal({
  primary,
  secondary,
  onSavePrimary,
  onSaveSecondary,
  accentColor,
  onClose,
}: {
  primary: string;
  secondary: string;
  onSavePrimary: (val: string) => Promise<void>;
  onSaveSecondary: (val: string) => Promise<void>;
  accentColor: string;
  onClose: () => void;
}) {
  const [primaryInput, setPrimaryInput] = useState(primary);
  const [secondaryInput, setSecondaryInput] = useState(secondary);
  const [primaryVerified, setPrimaryVerified] = useState<{ name: string; country: string } | null>(null);
  const [secondaryVerified, setSecondaryVerified] = useState<{ name: string; country: string } | null>(null);
  const [primaryErr, setPrimaryErr] = useState("");
  const [secondaryErr, setSecondaryErr] = useState("");
  const [saving, setSaving] = useState(false);

  const verify = async (
    name: string,
    setVerified: (v: { name: string; country: string } | null) => void,
    setErr: (e: string) => void
  ) => {
    if (!name.trim()) { setVerified(null); setErr(""); return; }
    setErr("");
    const hit = await geocodeCity(name);
    if (hit) {
      setVerified({ name: hit.name, country: hit.country });
      setErr("");
    } else {
      setVerified(null);
      setErr("City not found. Try a different spelling.");
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await Promise.all([
        onSavePrimary(primaryInput.trim()),
        onSaveSecondary(secondaryInput.trim()),
      ]);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const clearAll = async () => {
    setPrimaryInput("");
    setSecondaryInput("");
    setPrimaryVerified(null);
    setSecondaryVerified(null);
    setPrimaryErr("");
    setSecondaryErr("");
    setSaving(true);
    try {
      await Promise.all([onSavePrimary(""), onSaveSecondary("")]);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={saving ? undefined : onClose}
        aria-hidden="true"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />
      <motion.div
        initial={{ y: 20, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 20, opacity: 0, scale: 0.95 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="locations-title"
        className="bg-card w-full max-w-sm rounded-[2rem] shadow-heavy z-10 overflow-hidden p-6 space-y-5"
      >
        <div className="flex justify-between items-start">
          <div>
            <div
              className="p-3 rounded-2xl w-fit mb-3"
              style={{ backgroundColor: `${accentColor}1A` }}
            >
              <MapPin className="w-6 h-6" style={{ color: accentColor }} aria-hidden="true" />
            </div>
            <h3 id="locations-title" className="font-bold text-lg text-foreground">Weather Locations</h3>
            <p className="text-sm text-muted-foreground font-medium mt-1">
              The dashboard adapts its theme to the weather at your primary city.
              Cities are resolved on-device — no GPS permission needed.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            disabled={saving}
            className="p-1.5 hover:bg-muted rounded-full transition-colors shrink-0 disabled:opacity-50"
          >
            <X className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4">
          <LocationField
            label="Primary city"
            placeholder="e.g. Kuala Lumpur"
            value={primaryInput}
            onChange={(v) => { setPrimaryInput(v); setPrimaryVerified(null); setPrimaryErr(""); }}
            onBlur={() => verify(primaryInput, setPrimaryVerified, setPrimaryErr)}
            verified={primaryVerified}
            err={primaryErr}
            accentColor={accentColor}
          />

          <LocationField
            label="Secondary city (optional)"
            placeholder="e.g. Singapore"
            value={secondaryInput}
            onChange={(v) => { setSecondaryInput(v); setSecondaryVerified(null); setSecondaryErr(""); }}
            onBlur={() => verify(secondaryInput, setSecondaryVerified, setSecondaryErr)}
            verified={secondaryVerified}
            err={secondaryErr}
            accentColor={accentColor}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={clearAll}
            disabled={saving}
            className="flex-1 py-3 bg-muted rounded-xl font-bold text-sm text-muted-foreground hover:bg-border transition-colors disabled:opacity-50"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            style={{ backgroundColor: accentColor }}
            className="flex-1 py-3 text-white rounded-xl font-bold text-sm active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Saving…
              </>
            ) : (
              "Save"
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function LocationField({
  label,
  placeholder,
  value,
  onChange,
  onBlur,
  verified,
  err,
  accentColor,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (val: string) => void;
  onBlur: () => void;
  verified: { name: string; country: string } | null;
  err: string;
  accentColor: string;
}) {
  return (
    <div>
      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-2">
        {label}
      </label>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-label={label}
        autoComplete="off"
        className="w-full bg-muted/60 text-sm font-semibold px-4 py-3 rounded-xl border border-border outline-none transition-colors focus:border-primary/50"
        style={{ borderColor: verified ? `${accentColor}66` : undefined }}
      />
      {verified && (
        <p className="text-[11px] font-semibold mt-1.5 flex items-center gap-1.5" style={{ color: accentColor }}>
          <span aria-hidden="true">✓</span>
          {verified.name}
          {verified.country ? `, ${verified.country}` : ""}
        </p>
      )}
      {err && (
        <p role="alert" className="text-[11px] font-semibold text-rose-500 mt-1.5">
          {err}
        </p>
      )}
    </div>
  );
}
