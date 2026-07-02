import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const recentEntriesCache = new Map<string, RecentEntry[]>();

export function invalidateRecentEntries(tripId: string) {
  recentEntriesCache.delete(tripId);
}

export interface RecentEntry {
  id: string;
  description: string;
  date: string;
  currency: string;
  payee: string | null;
  category: { name: string; icon: string } | null;
  payments: {
    amount_paid: number;
    user: { id: string; name: string } | null;
  }[];
}

interface RecentEntryRow {
  id: string;
  description: string;
  date: string;
  currency: string;
  payee: string | null;
  category: { name: string; icon: string } | null;
  payments: {
    amount_paid: number;
    user: { id: string; name: string } | null;
  }[];
}

export function useRecentEntries(tripId: string) {
  const cached = recentEntriesCache.get(tripId);
  const [entries, setEntries] = useState<RecentEntry[]>(cached ?? []);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const cachedEntries = recentEntriesCache.get(tripId);
      if (cachedEntries) {
        setEntries(cachedEntries);
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("entries")
        .select(
          "id, description, date, currency, payee, category:categories(name, icon), payments(amount_paid, user:users(id, name))",
        )
        .eq("trip_id", tripId)
        .eq("status", "active")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(10)
        .returns<RecentEntryRow[]>();

      if (!cancelled) {
        const nextEntries = data ?? [];
        recentEntriesCache.set(tripId, nextEntries);
        setEntries(nextEntries);
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [tripId]);

  return { entries, loading };
}
