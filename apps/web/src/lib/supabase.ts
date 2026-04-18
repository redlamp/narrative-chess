import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";

export const hasSupabaseConfig = supabaseUrl.length > 0 && supabasePublishableKey.length > 0;

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient() {
  if (!hasSupabaseConfig) {
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, supabasePublishableKey);
  }

  return supabaseClient;
}
