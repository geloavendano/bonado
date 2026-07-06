import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { registerDataRefresh } from "@/lib/dataRefresh";

const PAGE_SIZE = 20;

interface RecentEntriesCacheValue {
  entries: HistoryItem[];
  expenseCount: number;
  settlementCount: number;
  hasMoreExpenses: boolean;
  hasMoreSettlements: boolean;
}

const recentEntriesCache = new Map<string, RecentEntriesCacheValue>();

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
  exchange_rate_to_trip_default: number;
  rate_is_estimated: boolean;
  payee: string | null;
  category: { name: string; icon: string } | null;
  payments: {
    amount_paid: number;
    user_id: string;
    user: { id: string; name: string; avatar_url: string | null } | null;
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
    user: { id: string; name: string; avatar_url: string | null } | null;
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
  const [entries, setEntries] = useState<HistoryItem[]>(cached?.entries ?? []);
  const [loading, setLoading] = useState(!cached);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expenseCount, setExpenseCount] = useState(cached?.expenseCount ?? 0);
  const [settlementCount, setSettlementCount] = useState(cached?.settlementCount ?? 0);
  const [hasMoreExpenses, setHasMoreExpenses] = useState(cached?.hasMoreExpenses ?? false);
  const [hasMoreSettlements, setHasMoreSettlements] = useState(cached?.hasMoreSettlements ?? false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const cachedEntries = recentEntriesCache.get(tripId);
      if (cachedEntries) {
        setEntries(cachedEntries.entries);
        setLoading(false);
      }
      const [expenseResult, settlementResult] = await Promise.all([
        supabase
          .from("entries")
          .select(
            `id, description, date, created_at, last_edited_at, currency,
             exchange_rate_to_trip_default, rate_is_estimated, payee,
             category:categories(name, icon),
             payments(amount_paid, user_id, user:users(id, name, avatar_url)),
             line_items(line_item_shares(user_id, owed_amount)),
             adjustments(adjustment_shares(user_id, owed_amount))`,
          )
          .eq("trip_id", tripId)
          .eq("status", "active")
          .order("date", { ascending: false })
          .order("created_at", { ascending: false })
          .range(0, PAGE_SIZE - 1)
          .returns<RecentEntryRow[]>(),
        supabase
          .from("settlements")
          .select(
            `id, date, created_at, amount, from_user_id, to_user_id,
             from_user:users!settlements_from_user_id_fkey(id, name),
             to_user:users!settlements_to_user_id_fkey(id, name)`,
          )
          .eq("trip_id", tripId)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false })
          .range(0, PAGE_SIZE - 1)
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
        const nextExpenseCount = expenseResult.data?.length ?? 0;
        const nextSettlementCount = settlementResult.data?.length ?? 0;
        const nextCache = {
          entries: nextEntries,
          expenseCount: nextExpenseCount,
          settlementCount: nextSettlementCount,
          hasMoreExpenses: nextExpenseCount === PAGE_SIZE,
          hasMoreSettlements: nextSettlementCount === PAGE_SIZE,
        };
        recentEntriesCache.set(tripId, nextCache);
        setEntries(nextEntries);
        setExpenseCount(nextCache.expenseCount);
        setSettlementCount(nextCache.settlementCount);
        setHasMoreExpenses(nextCache.hasMoreExpenses);
        setHasMoreSettlements(nextCache.hasMoreSettlements);
        setError(null);
        setLoading(false);
      }
    }

    void load();
    const unregisterRefresh = registerDataRefresh(load);
    return () => {
      cancelled = true;
      unregisterRefresh();
    };
  }, [tripId]);

  async function loadMore() {
    if (loadingMore || (!hasMoreExpenses && !hasMoreSettlements)) return;
    setLoadingMore(true);
    const expenseQuery = hasMoreExpenses
      ? supabase
          .from("entries")
          .select(
            `id, description, date, created_at, last_edited_at, currency,
             exchange_rate_to_trip_default, rate_is_estimated, payee,
             category:categories(name, icon),
             payments(amount_paid, user_id, user:users(id, name, avatar_url)),
             line_items(line_item_shares(user_id, owed_amount)),
             adjustments(adjustment_shares(user_id, owed_amount))`,
          )
          .eq("trip_id", tripId)
          .eq("status", "active")
          .order("date", { ascending: false })
          .order("created_at", { ascending: false })
          .range(expenseCount, expenseCount + PAGE_SIZE - 1)
          .returns<RecentEntryRow[]>()
      : Promise.resolve({ data: [] as RecentEntryRow[], error: null });
    const settlementQuery = hasMoreSettlements
      ? supabase
          .from("settlements")
          .select(
            `id, date, created_at, amount, from_user_id, to_user_id,
             from_user:users!settlements_from_user_id_fkey(id, name),
             to_user:users!settlements_to_user_id_fkey(id, name)`,
          )
          .eq("trip_id", tripId)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false })
          .range(settlementCount, settlementCount + PAGE_SIZE - 1)
          .returns<RecentSettlementRow[]>()
      : Promise.resolve({ data: [] as RecentSettlementRow[], error: null });
    const [expenseResult, settlementResult] = await Promise.all([
      expenseQuery,
      settlementQuery,
    ]);
    const queryError = expenseResult.error ?? settlementResult.error;
    if (queryError) {
      setError(queryError.message);
      setLoadingMore(false);
      return;
    }
    const newExpenses = expenseResult.data ?? [];
    const newSettlements = settlementResult.data ?? [];
    const nextEntries = [
      ...entries,
      ...newExpenses.map((entry) => ({ ...entry, type: "expense" as const })),
      ...newSettlements.map((settlement) => ({
        ...settlement,
        amount: Number(settlement.amount),
        type: "settlement" as const,
      })),
    ].sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        b.created_at.localeCompare(a.created_at),
    );
    const nextExpenseCount = expenseCount + newExpenses.length;
    const nextSettlementCount = settlementCount + newSettlements.length;
    const nextHasMoreExpenses = hasMoreExpenses && newExpenses.length === PAGE_SIZE;
    const nextHasMoreSettlements =
      hasMoreSettlements && newSettlements.length === PAGE_SIZE;
    recentEntriesCache.set(tripId, {
      entries: nextEntries,
      expenseCount: nextExpenseCount,
      settlementCount: nextSettlementCount,
      hasMoreExpenses: nextHasMoreExpenses,
      hasMoreSettlements: nextHasMoreSettlements,
    });
    setEntries(nextEntries);
    setExpenseCount(nextExpenseCount);
    setSettlementCount(nextSettlementCount);
    setHasMoreExpenses(nextHasMoreExpenses);
    setHasMoreSettlements(nextHasMoreSettlements);
    setLoadingMore(false);
  }

  return {
    entries,
    loading,
    loadingMore,
    hasMore: hasMoreExpenses || hasMoreSettlements,
    loadMore,
    error,
  };
}
