import { createClient } from "@supabase/supabase-js";

function readEnv(name: "VITE_SUPABASE_URL" | "VITE_SUPABASE_PUBLISHABLE_KEY") {
  const value = import.meta.env[name];

  if (!value) {
    throw new Error(`Missing ${name}. Add it to apps/web/.env.local.`);
  }

  return value;
}

export const supabase = createClient(
  readEnv("VITE_SUPABASE_URL"),
  readEnv("VITE_SUPABASE_PUBLISHABLE_KEY")
);

