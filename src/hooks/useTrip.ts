import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import type { Trip } from "@/types/schema";
import { fetchBalances } from "@/lib/balanceData";
import { registerDataRefresh } from "@/lib/dataRefresh";

export interface TripMember {
  id: string;
  name: string;
  avatar_url: string | null;
  role: string;
  is_registered: boolean;
}

export interface TripWithMembers extends Trip {
  members: TripMember[];
  isOwner: boolean;
  /** Positive = you're owed; negative = you owe. Wired up once the expenses/balances phase lands. */
  yourBalance: number;
}

interface TripRow extends Trip {
  memberships: {
    role: string;
    user: { id: string; name: string; avatar_url: string | null; is_registered: boolean } | null;
  }[];
}

const tripCache = new Map<string, TripWithMembers>();

export function useTrip(tripId: string | undefined) {
  const { user } = useAuth();
  const cacheKey = tripId ? `${tripId}:${user?.id ?? "guest"}` : "";
  const cached = cacheKey ? tripCache.get(cacheKey) ?? null : null;
  const [trip, setTrip] = useState<TripWithMembers | null>(cached);
  const [loading, setLoading] = useState(Boolean(tripId && !cached));
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  const reload = useCallback(async (showLoading = false) => {
    if (!tripId) return;
    const requestId = ++requestRef.current;
    if (showLoading && !tripCache.has(cacheKey)) setLoading(true);
    const { data, error } = await supabase
      .from("trips")
      .select("*, memberships(role, user:users(id, name, avatar_url, is_registered))")
      .eq("id", tripId)
      .returns<TripRow[]>()
      .maybeSingle();

    if (requestId !== requestRef.current) return;
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (!data) {
      setTrip(null);
      setLoading(false);
      return;
    }

    const balanceRows = await fetchBalances(tripId).catch(() => []);
    if (requestId !== requestRef.current) return;
    const { memberships, ...rest } = data;
    const nextTrip = {
      ...rest,
      members: memberships.flatMap((m) =>
        m.user ? [{ ...m.user, role: m.role }] : [],
      ),
      isOwner: memberships.some((m) => m.user?.id === user?.id && m.role === "owner"),
      yourBalance:
        balanceRows.find((balance) => balance.user_id === user?.id)?.balance ?? 0,
    };
    tripCache.set(cacheKey, nextTrip);
    setTrip(nextTrip);
    setLoading(false);
  }, [cacheKey, tripId, user?.id]);

  useEffect(() => {
    const nextCached = cacheKey ? tripCache.get(cacheKey) ?? null : null;
    setTrip(nextCached);
    setLoading(Boolean(tripId && !nextCached));
    void reload(!nextCached);
    return registerDataRefresh(() => reload(false));
  }, [cacheKey, tripId, reload]);

  return { trip, loading, error, reload };
}
