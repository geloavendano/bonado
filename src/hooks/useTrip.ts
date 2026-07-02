import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import type { Trip } from "@/types/schema";

export interface TripWithMembers extends Trip {
  members: { id: string; name: string; avatar_url: string | null }[];
  isOwner: boolean;
  /** Positive = you're owed; negative = you owe. Wired up once the expenses/balances phase lands. */
  yourBalance: number;
}

interface TripRow extends Trip {
  memberships: {
    role: string;
    user: { id: string; name: string; avatar_url: string | null } | null;
  }[];
}

export function useTrip(tripId: string | undefined) {
  const { user } = useAuth();
  const [trip, setTrip] = useState<TripWithMembers | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!tripId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("trips")
      .select("*, memberships(role, user:users(id, name, avatar_url))")
      .eq("id", tripId)
      .returns<TripRow[]>()
      .maybeSingle();

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

    const { memberships, ...rest } = data;
    setTrip({
      ...rest,
      members: memberships.flatMap((m) => (m.user ? [m.user] : [])),
      isOwner: memberships.some((m) => m.user?.id === user?.id && m.role === "owner"),
      yourBalance: 0,
    });
    setLoading(false);
  }, [tripId, user?.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { trip, loading, error, reload };
}
