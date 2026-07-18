import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { registerDataRefresh } from "@/lib/dataRefresh";
import { loadExpenseQueue, type QueuedExpense } from "@/lib/offlineExpenseQueue";

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
  sync_status: "pending" | "synced";
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

function queuedExpenseToHistoryItem(item: QueuedExpense): RecentEntry {
  const payload = item.payload;
  const payers = Array.isArray(payload.p_payers) ? payload.p_payers : [];
  const items = Array.isArray(payload.p_items) ? payload.p_items : [];
  const adjustments = Array.isArray(payload.p_adjustments)
    ? payload.p_adjustments
    : [];

  return {
    type: "expense",
    id: typeof payload.p_entry_id === "string" ? payload.p_entry_id : item.id,
    description: String(payload.p_description ?? "Pending expense"),
    date: String(payload.p_date ?? item.createdAt.slice(0, 10)),
    created_at: item.createdAt,
    last_edited_at: null,
    currency: String(payload.p_currency ?? (item.tripDefaultCurrency || "USD")),
    exchange_rate_to_trip_default: Number(payload.p_exchange_rate) || 1,
    rate_is_estimated: true,
    sync_status: "pending",
    payee:
      typeof payload.p_payee === "string" && payload.p_payee.trim()
        ? payload.p_payee
        : null,
    category: null,
    payments: payers.flatMap((payer) => {
      if (!payer || typeof payer !== "object") return [];
      const row = payer as { user_id?: unknown; amount?: unknown };
      if (typeof row.user_id !== "string") return [];
      return [{
        amount_paid: Number(row.amount) || 0,
        user_id: row.user_id,
        user: null,
      }];
    }),
    line_items: items.map((itemPayload) => {
      const row = itemPayload as { shares?: unknown };
      const shares = Array.isArray(row.shares) ? row.shares : [];
      return {
        line_item_shares: shares.flatMap((sharePayload) => {
          if (!sharePayload || typeof sharePayload !== "object") return [];
          const share = sharePayload as { user_id?: unknown; owed_amount?: unknown };
          if (typeof share.user_id !== "string") return [];
          return [{
            user_id: share.user_id,
            owed_amount: Number(share.owed_amount) || 0,
          }];
        }),
      };
    }),
    adjustments: adjustments.map((adjustmentPayload) => {
      const row = adjustmentPayload as { shares?: unknown };
      const shares = Array.isArray(row.shares) ? row.shares : [];
      return {
        adjustment_shares: shares.flatMap((sharePayload) => {
          if (!sharePayload || typeof sharePayload !== "object") return [];
          const share = sharePayload as { user_id?: unknown; owed_amount?: unknown };
          if (typeof share.user_id !== "string") return [];
          return [{
            user_id: share.user_id,
            owed_amount: Number(share.owed_amount) || 0,
          }];
        }),
      };
    }),
  };
}

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
      const queuedExpenses = (await loadExpenseQueue())
        .filter((item) => item.tripId === tripId)
        .map(queuedExpenseToHistoryItem);
      const [expenseResult, settlementResult] = await Promise.all([
        supabase
          .from("entries")
          .select(
            `id, description, date, created_at, last_edited_at, currency, sync_status,
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
          if (queuedExpenses.length > 0) {
            const cachedServerEntries =
              cachedEntries?.entries.filter(
                (entry) =>
                  entry.type !== "expense" || entry.sync_status !== "pending",
              ) ?? [];
            const cachedServerIds = new Set(cachedServerEntries.map((entry) => entry.id));
            const offlineEntries = [
              ...queuedExpenses.filter((entry) => !cachedServerIds.has(entry.id)),
              ...cachedServerEntries,
            ].sort(
              (a, b) =>
                b.date.localeCompare(a.date) ||
                b.created_at.localeCompare(a.created_at),
            );
            setEntries(offlineEntries);
            setError(null);
            setLoading(false);
            return;
          }
          setError(queryError.message);
          setLoading(false);
          return;
        }
        const serverEntries: HistoryItem[] = [
          ...(expenseResult.data ?? []).map((entry) => ({ ...entry, type: "expense" as const })),
          ...(settlementResult.data ?? []).map((settlement) => ({
            ...settlement,
            amount: Number(settlement.amount),
            type: "settlement" as const,
          })),
        ];
        const serverEntryIds = new Set(serverEntries.map((entry) => entry.id));
        const nextEntries: HistoryItem[] = [
          ...queuedExpenses.filter((entry) => !serverEntryIds.has(entry.id)),
          ...serverEntries,
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
    window.addEventListener("bonado:offline-queue-change", load);
    return () => {
      cancelled = true;
      unregisterRefresh();
      window.removeEventListener("bonado:offline-queue-change", load);
    };
  }, [tripId]);

  async function loadMore() {
    if (loadingMore || (!hasMoreExpenses && !hasMoreSettlements)) return;
    setLoadingMore(true);
    const expenseQuery = hasMoreExpenses
      ? supabase
          .from("entries")
          .select(
            `id, description, date, created_at, last_edited_at, currency, sync_status,
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
