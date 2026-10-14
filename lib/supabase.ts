import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "[Supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in environment. " +
    "Please ensure .env.local exists with valid credentials before building."
  );
}

if (!supabaseUrl.startsWith("https://")) {
  throw new Error("[Supabase] NEXT_PUBLIC_SUPABASE_URL must be a valid HTTPS URL.");
}

export const supabase = createClient(supabaseUrl, supabaseKey);

