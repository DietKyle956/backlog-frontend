import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://xqigrwpfofwgxaqzdjht.supabase.co";
const supabaseKey =
  "sb_publishable_B28U-EkI-ocRbmKH455y7Q_3I-fmuXH";

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
