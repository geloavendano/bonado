import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Trip } from "@/types/schema";
import { fetchBalances } from "@/lib/balanceData";
import { useAuth } from "@/context/AuthContext";

export interface TripWithMembers extends Trip {
  members: { id: string; name: string; avatar_url: string | null }[];
  /** Positive = you're owed; negative = you owe. Wired up once the expenses/balances phase lands. */
  yourBalance: number;
}

interface TripRow extends Trip {
  memberships: { user: { id: string; name: string; avatar_url: string | null } | null }[];
}

export function useTrips() {
  const { user } = useAuth();
  const [trips, setTrips] = useState<TripWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("trips")
        .select("*, memberships(user:users(id, name, avatar_url))")
        .order("last_activity_at", { ascending: false })
        .returns<TripRow[]>();

      if (cancelled) return;

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      const rows = data ?? [];
      const balanceRows = await Promise.all(
        rows.map((trip) => fetchBalances(trip.id).catch(() => [])),
      );
      if (cancelled) return;

      setTrips(
        rows.map(({ memberships, ...trip }, index) => ({
          ...trip,
          members: memberships.flatMap((m) => (m.user ? [m.user] : [])),
          yourBalance:
            balanceRows[index].find((balance) => balance.user_id === user?.id)?.balance ?? 0,
        })),
      );
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return { trips, loading, error };
}
