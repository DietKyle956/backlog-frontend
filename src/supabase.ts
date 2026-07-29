import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://mxxjaefcqgosyqbfyzxk.supabase.co";
const supabaseKey =
  "sb_publishable_ydrFd8SyIcSrzl8I9IH4YQ_u_DEiiW9";

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
