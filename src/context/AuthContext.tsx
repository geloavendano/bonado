import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { User } from "@/types/schema";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/** Fetches (or provisions on first login) the public.users row for a Supabase auth session. */
async function loadOrCreateUserRow(session: Session): Promise<User | null> {
  const authUser = session.user;

  const { data: existing, error: selectError } = await supabase
    .from("users")
    .select("*")
    .eq("auth_id", authUser.id)
    .maybeSingle();

  if (selectError) {
    console.error("[bonado] failed to load user row", selectError);
    return null;
  }

  if (existing) return existing as User;

  const metadata = authUser.user_metadata ?? {};
  const { data: created, error: insertError } = await supabase
    .from("users")
    .insert({
      auth_id: authUser.id,
      name: metadata.full_name ?? metadata.name ?? authUser.email ?? "New user",
      email: authUser.email ?? null,
      avatar_url: metadata.avatar_url ?? metadata.picture ?? null,
      is_registered: !authUser.is_anonymous,
    })
    .select("*")
    .single();

  if (insertError) {
    console.error("[bonado] failed to create user row", insertError);
    return null;
  }

  return created as User;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function syncUser(nextSession: Session | null) {
      setSession(nextSession);
      if (!nextSession) {
        setUser(null);
        setLoading(false);
        return;
      }
      const row = await loadOrCreateUserRow(nextSession);
      if (!cancelled) {
        setUser(row);
        setLoading(false);
      }
    }

    supabase.auth.getSession().then(({ data }) => syncUser(data.session));

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setLoading(true);
        syncUser(nextSession);
      },
    );

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({ session, user, loading, signInWithGoogle, signOut }),
    [session, user, loading, signInWithGoogle, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
