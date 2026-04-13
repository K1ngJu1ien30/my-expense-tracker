import { createClient } from "@supabase/supabase-js";

// Uses process.env or falls back to placeholders temporarily
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://pjlfrbniiwadxaoqmnwt.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_rsvaSpLg64GgWHszAKyQEg_-igBlQFP";

export const supabase = createClient(supabaseUrl, supabaseKey);
