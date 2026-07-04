import { createClient } from "@supabase/supabase-js";
import { Capacitor } from "@capacitor/core";
import { nativeAuthStorage } from "@/lib/nativeStorage";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn(
    "[bonado] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set. " +
      "Copy .env.example to .env.local and fill in your Supabase project credentials.",
  );
}

export const supabase = createClient(
  supabaseUrl ?? "https://placeholder.supabase.co",
  supabaseAnonKey ?? "placeholder-anon-key",
  {
    db: { schema: "bonado" },
    // In the native shell, sessions live in app-scoped storage and OAuth
    // redirects arrive via appUrlOpen deep links (see NativeShell), not the
    // page URL.
    auth: Capacitor.isNativePlatform()
      ? {
          storage: nativeAuthStorage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        }
      : {},
  },
);
