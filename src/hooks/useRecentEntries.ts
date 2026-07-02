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
  created_at: string;
  last_edited_at: string | null;
  currency: string;
  payee: string | null;
  category: { name: string; icon: string } | null;
  payments: {
    amount_paid: number;
    user_id: string;
    user: { id: string; name: string } | null;
  }[];
  line_items: {
    line_item_shares: { user_id: string; owed_amount: number }[];
  }[];
  adjustments: {
    adjustment_shares: { user_id: string; owed_amount: number }[];
  }[];
}

interface RecentEntryRow {
  id: string;
  description: string;
  date: string;
  created_at: string;
  last_edited_at: string | null;
  currency: string;
  payee: string | null;
  category: { name: string; icon: string } | null;
  payments: {
    amount_paid: number;
    user_id: string;
    user: { id: string; name: string } | null;
  }[];
  line_items: {
    line_item_shares: { user_id: string; owed_amount: number }[];
  }[];
  adjustments: {
    adjustment_shares: { user_id: string; owed_amount: number }[];
  }[];
}

export function useRecentEntries(tripId: string) {
  const cached = recentEntriesCache.get(tripId);
  const [entries, setEntries] = useState<RecentEntry[]>(cached ?? []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const cachedEntries = recentEntriesCache.get(tripId);
      if (cachedEntries) {
        setEntries(cachedEntries);
        setLoading(false);
      }
      const { data, error: queryError } = await supabase
        .from("entries")
        .select(
          `id, description, date, created_at, last_edited_at, currency, payee,
           category:categories(name, icon),
           payments(amount_paid, user_id, user:users(id, name)),
           line_items(line_item_shares(user_id, owed_amount)),
           adjustments(adjustment_shares(user_id, owed_amount))`,
        )
        .eq("trip_id", tripId)
        .eq("status", "active")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .returns<RecentEntryRow[]>();

      if (!cancelled) {
        if (queryError) {
          setError(queryError.message);
          setLoading(false);
          return;
        }
        const nextEntries = data ?? [];
        recentEntriesCache.set(tripId, nextEntries);
        setEntries(nextEntries);
        setError(null);
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [tripId]);

  return { entries, loading, error };
}
