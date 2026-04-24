import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  // Fail loud in dev, but keep the app from crashing in a bad build by using
  // obviously-broken values. This surfaces misconfiguration via auth errors
  // instead of silently pointing at a fake domain.
  const msg = "[Supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in environment.";
  if (process.env.NODE_ENV !== "production") {
    throw new Error(msg);
  } else {
    console.error(msg);
  }
}

export const supabase = createClient(
  supabaseUrl || "https://invalid.supabase.co",
  supabaseKey || "invalid-key"
);
