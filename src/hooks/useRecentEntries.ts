import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const recentEntriesCache = new Map<string, HistoryItem[]>();

export function invalidateRecentEntries(tripId: string) {
  recentEntriesCache.delete(tripId);
}

export interface RecentEntry {
  type: "expense";
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

export interface RecentSettlement {
  type: "settlement";
  id: string;
  date: string;
  created_at: string;
  amount: number;
  from_user_id: string;
  to_user_id: string;
  from_user: { id: string; name: string } | null;
  to_user: { id: string; name: string } | null;
}

export type HistoryItem = RecentEntry | RecentSettlement;

interface RecentEntryRow extends Omit<RecentEntry, "type"> {
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

interface RecentSettlementRow extends Omit<RecentSettlement, "type"> {}

export function useRecentEntries(tripId: string) {
  const cached = recentEntriesCache.get(tripId);
  const [entries, setEntries] = useState<HistoryItem[]>(cached ?? []);
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
      const [expenseResult, settlementResult] = await Promise.all([
        supabase
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
          .returns<RecentEntryRow[]>(),
        supabase
          .from("settlements")
          .select(
            `id, date, created_at, amount, from_user_id, to_user_id,
             from_user:users!settlements_from_user_id_fkey(id, name),
             to_user:users!settlements_to_user_id_fkey(id, name)`,
          )
          .eq("trip_id", tripId)
          .returns<RecentSettlementRow[]>(),
      ]);
      const queryError = expenseResult.error ?? settlementResult.error;

      if (!cancelled) {
        if (queryError) {
          setError(queryError.message);
          setLoading(false);
          return;
        }
        const nextEntries: HistoryItem[] = [
          ...(expenseResult.data ?? []).map((entry) => ({ ...entry, type: "expense" as const })),
          ...(settlementResult.data ?? []).map((settlement) => ({
            ...settlement,
            amount: Number(settlement.amount),
            type: "settlement" as const,
          })),
        ].sort(
          (a, b) =>
            b.date.localeCompare(a.date) ||
            b.created_at.localeCompare(a.created_at),
        );
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
