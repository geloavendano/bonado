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
  signInWithGoogle: (redirectTo?: string) => Promise<void>;
  signInAsGuest: (name: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (input: { name?: string; preferredCurrency?: string }) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Fetches (or provisions on first login) the bonado.users row for a Supabase
 * auth session. Also reconciles a guest's row after they claim a full
 * account via linkIdentity — same auth.uid(), but is_anonymous flips to
 * false and real profile data becomes available.
 */
async function loadOrCreateUserRow(session: Session): Promise<User | null> {
  const authUser = session.user;
  const metadata = authUser.user_metadata ?? {};

  const { data: existing, error: selectError } = await supabase
    .from("users")
    .select("*")
    .eq("auth_id", authUser.id)
    .maybeSingle();

  if (selectError) {
    console.error("[bonado] failed to load user row", selectError);
    return null;
  }

  if (existing) {
    const justClaimed = existing.is_registered === false && !authUser.is_anonymous;
    if (!justClaimed) return existing as User;

    const { data: updated, error: updateError } = await supabase
      .from("users")
      .update({
        is_registered: true,
        name: metadata.full_name ?? metadata.name ?? existing.name,
        email: authUser.email ?? existing.email,
        avatar_url: metadata.avatar_url ?? metadata.picture ?? existing.avatar_url,
      })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (updateError) {
      console.error("[bonado] failed to reconcile claimed user row", updateError);
      return existing as User;
    }
    return updated as User;
  }

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

  const signInWithGoogle = useCallback(async (redirectTo?: string) => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo ?? window.location.origin },
    });
  }, []);

  const signInAsGuest = useCallback(async (name: string) => {
    const { error } = await supabase.auth.signInAnonymously({
      options: { data: { full_name: name } },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const updateProfile = useCallback(async (input: {
    name?: string;
    preferredCurrency?: string;
  }) => {
    if (!user) return false;
    const { data, error } = await supabase
      .from("users")
      .update({
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.preferredCurrency !== undefined
          ? { preferred_currency: input.preferredCurrency }
          : {}),
      })
      .eq("id", user.id)
      .select("*")
      .single();
    if (error) return false;
    setUser(data as User);
    return true;
  }, [user]);

  const value = useMemo(
    () => ({ session, user, loading, signInWithGoogle, signInAsGuest, signOut, updateProfile }),
    [session, user, loading, signInWithGoogle, signInAsGuest, signOut, updateProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
