import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

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
  const [entries, setEntries] = useState<RecentEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
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
        setEntries(data ?? []);
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
