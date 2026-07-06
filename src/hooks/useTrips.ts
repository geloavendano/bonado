import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Trip } from "@/types/schema";
import { fetchBalances } from "@/lib/balanceData";
import { useAuth } from "@/context/AuthContext";
import { registerDataRefresh } from "@/lib/dataRefresh";

const PAGE_SIZE = 10;

export interface TripWithMembers extends Trip {
  members: { id: string; name: string; avatar_url: string | null }[];
  /** Positive = you're owed; negative = you owe. Wired up once the expenses/balances phase lands. */
  yourBalance: number;
}

interface TripRow extends Trip {
  memberships: { user: { id: string; name: string; avatar_url: string | null } | null }[];
}

interface TripsCacheValue {
  trips: TripWithMembers[];
  hasMore: boolean;
}

const tripsCache = new Map<string, TripsCacheValue>();

export function useTrips() {
  const { user } = useAuth();
  const cacheKey = user?.id ?? "guest";
  const cached = tripsCache.get(cacheKey);
  const [trips, setTrips] = useState<TripWithMembers[]>(cached?.trips ?? []);
  const [loading, setLoading] = useState(!cached);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(cached?.hasMore ?? false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (showLoading = false) => {
      if (showLoading && !tripsCache.has(cacheKey)) setLoading(true);
      const { data, error } = await supabase
        .from("trips")
        .select("*, memberships(user:users(id, name, avatar_url))")
        .order("last_activity_at", { ascending: false })
        .range(0, PAGE_SIZE - 1)
        .returns<TripRow[]>();

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      const rows = data ?? [];
      const nextHasMore = rows.length === PAGE_SIZE;
      const balanceRows = await Promise.all(
        rows.map((trip) => fetchBalances(trip.id).catch(() => [])),
      );
      const nextTrips = rows.map(({ memberships, ...trip }, index) => ({
          ...trip,
          members: memberships.flatMap((m) => (m.user ? [m.user] : [])),
          yourBalance:
            balanceRows[index].find((balance) => balance.user_id === user?.id)?.balance ?? 0,
        }));
      tripsCache.set(cacheKey, { trips: nextTrips, hasMore: nextHasMore });
      setTrips(nextTrips);
      setHasMore(nextHasMore);
      setLoading(false);
  }, [cacheKey, user?.id]);

  useEffect(() => {
    const nextCached = tripsCache.get(cacheKey);
    setTrips(nextCached?.trips ?? []);
    setHasMore(nextCached?.hasMore ?? false);
    setLoading(!nextCached);
    void reload(!nextCached);
    return registerDataRefresh(() => reload(false));
  }, [cacheKey, reload]);

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const start = trips.length;
    const { data, error: queryError } = await supabase
      .from("trips")
      .select("*, memberships(user:users(id, name, avatar_url))")
      .order("last_activity_at", { ascending: false })
      .range(start, start + PAGE_SIZE - 1)
      .returns<TripRow[]>();
    if (queryError) {
      setError(queryError.message);
      setLoadingMore(false);
      return;
    }
    const rows = data ?? [];
    const balanceRows = await Promise.all(
      rows.map((trip) => fetchBalances(trip.id).catch(() => [])),
    );
    const nextTrips = [
      ...trips,
      ...rows.map(({ memberships, ...trip }, index) => ({
        ...trip,
        members: memberships.flatMap((m) => (m.user ? [m.user] : [])),
        yourBalance:
          balanceRows[index].find((balance) => balance.user_id === user?.id)?.balance ?? 0,
      })),
    ];
    const nextHasMore = rows.length === PAGE_SIZE;
    tripsCache.set(cacheKey, { trips: nextTrips, hasMore: nextHasMore });
    setTrips(nextTrips);
    setHasMore(nextHasMore);
    setLoadingMore(false);
  }

  return { trips, loading, loadingMore, hasMore, loadMore, error, reload };
}
