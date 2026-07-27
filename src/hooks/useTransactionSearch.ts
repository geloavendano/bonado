import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { registerDataRefresh } from "@/lib/dataRefresh";
import { loadExpenseQueue } from "@/lib/offlineExpenseQueue";
import {
  ENTRY_SELECT,
  SETTLEMENT_SELECT,
  compareHistoryItems,
  queuedExpenseToHistoryItem,
  toRecentEntry,
  toRecentSettlement,
  type HistoryItem,
  type RecentEntry,
  type RecentEntryRow,
  type RecentSettlementRow,
} from "@/hooks/useRecentEntries";

const PAGE_SIZE = 20;
const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 250;
/** Ceiling on discovered ids, so a one-letter-ish query can't pull a whole trip. */
const MAX_MATCHES = 500;

interface NamedRow {
  id: string;
  name: string;
}

interface MatchRef {
  type: "expense" | "settlement";
  id: string;
  date: string;
  created_at: string;
}

/**
 * PostgREST's `.or()` takes a raw filter string that supabase-js only
 * URL-encodes, so the filter grammar is ours to get right.
 *
 * We strip rather than escape `% _ *`: PostgREST exposes no ESCAPE clause, so a
 * user-typed `%` would otherwise act as an unintended wildcard and match
 * everything. Stripping `\` and `"` removes the only characters that would need
 * escaping inside the quoted literal we build, so no escaping logic remains and
 * `, . : ( )` are safe inside the quotes.
 */
export function sanitizeSearchTerm(raw: string): string {
  return raw
    .trim()
    .replace(/[\\"%_*]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

/** Only treat a query as an amount when it is purely a plain number. */
function amountCandidate(term: string): number | null {
  const digits = term.replace(/[^\d.]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(digits)) return null;
  const value = Number(digits);
  return Number.isFinite(value) ? value : null;
}

function idsMatchingName(rows: readonly NamedRow[], needle: string): string[] {
  return rows
    .filter((row) => row.name.toLowerCase().includes(needle))
    .map((row) => row.id);
}

export interface TransactionSearchOptions {
  categories: readonly NamedRow[];
  members: readonly NamedRow[];
}

export function useTransactionSearch(
  tripId: string,
  rawQuery: string,
  { categories, members }: TransactionSearchOptions,
) {
  const term = sanitizeSearchTerm(rawQuery);
  const active = term.length >= MIN_QUERY_LENGTH;

  const [matches, setMatches] = useState<MatchRef[]>([]);
  const [entries, setEntries] = useState<HistoryItem[]>([]);
  const [offlineMatches, setOfflineMatches] = useState<RecentEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runIdRef = useRef(0);

  // Stable primitive deps: these arrays are rebuilt on every render upstream.
  const categoryKey = categories.map((row) => `${row.id}:${row.name}`).join("|");
  const memberKey = members.map((row) => `${row.id}:${row.name}`).join("|");

  const hydrate = useCallback(
    async (slice: MatchRef[]): Promise<HistoryItem[]> => {
      const entryIds = slice.filter((m) => m.type === "expense").map((m) => m.id);
      const settlementIds = slice
        .filter((m) => m.type === "settlement")
        .map((m) => m.id);

      const [entryResult, settlementResult] = await Promise.all([
        entryIds.length
          ? supabase
              .from("entries")
              .select(ENTRY_SELECT)
              .in("id", entryIds)
              .returns<RecentEntryRow[]>()
          : Promise.resolve({ data: [] as RecentEntryRow[], error: null }),
        settlementIds.length
          ? supabase
              .from("settlements")
              .select(SETTLEMENT_SELECT)
              .in("id", settlementIds)
              .returns<RecentSettlementRow[]>()
          : Promise.resolve({ data: [] as RecentSettlementRow[], error: null }),
      ]);
      const queryError = entryResult.error ?? settlementResult.error;
      if (queryError) throw new Error(queryError.message);

      return [
        ...(entryResult.data ?? []).map(toRecentEntry),
        ...(settlementResult.data ?? []).map(toRecentSettlement),
      ].sort(compareHistoryItems);
    },
    [],
  );

  useEffect(() => {
    if (!active || !tripId) {
      setMatches([]);
      setEntries([]);
      setOfflineMatches([]);
      setLoading(false);
      setError(null);
      return;
    }

    const runId = ++runIdRef.current;
    let cancelled = false;
    const isStale = () => cancelled || runId !== runIdRef.current;

    setLoading(true);

    async function run() {
      const needle = term.toLowerCase();
      const categoryIds = idsMatchingName(categories, needle);
      const memberIds = idsMatchingName(members, needle);
      const amount = amountCandidate(term);
      const pattern = `"*${term}*"`;

      // Offline-queued expenses live only on this device, so they are matched
      // client-side against the same fields and merged in.
      const queued = (await loadExpenseQueue())
        .filter((item) => item.tripId === tripId)
        .map(queuedExpenseToHistoryItem)
        .filter((entry) => {
          const categoryName =
            categories.find((row) => row.id === entry.category_id)?.name ?? "";
          const payerNames = entry.payments
            .map((p) => members.find((row) => row.id === p.user_id)?.name ?? "")
            .join(" ");
          return [entry.description, entry.payee ?? "", categoryName, payerNames]
            .join(" ")
            .toLowerCase()
            .includes(needle);
        });

      const textParts = [
        `description.ilike.${pattern}`,
        `payee.ilike.${pattern}`,
        ...(categoryIds.length ? [`category_id.in.(${categoryIds.join(",")})`] : []),
      ];
      const settlementParts = [
        ...(memberIds.length
          ? [
              `from_user_id.in.(${memberIds.join(",")})`,
              `to_user_id.in.(${memberIds.join(",")})`,
            ]
          : []),
        ...(amount !== null ? [`amount.eq.${amount}`] : []),
      ];

      const [textResult, payerResult, settlementResult] = await Promise.all([
        supabase
          .from("entries")
          .select("id, date, created_at")
          .eq("trip_id", tripId)
          .eq("status", "active")
          .or(textParts.join(","))
          .limit(MAX_MATCHES),
        // Payer matching needs its own query: filtering `payments!inner(...)`
        // prunes the embedded array too, so hydrating through it would return
        // only the matched payment and render wrong row totals.
        memberIds.length
          ? supabase
              .from("entries")
              .select("id, date, created_at, payments!inner(user_id)")
              .eq("trip_id", tripId)
              .eq("status", "active")
              .in("payments.user_id", memberIds)
              .limit(MAX_MATCHES)
          : Promise.resolve({ data: [], error: null }),
        settlementParts.length
          ? supabase
              .from("settlements")
              .select("id, date, created_at")
              .eq("trip_id", tripId)
              .or(settlementParts.join(","))
              .limit(MAX_MATCHES)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (isStale()) return;
      const queryError =
        textResult.error ?? payerResult.error ?? settlementResult.error;
      if (queryError) {
        setError(queryError.message);
        setLoading(false);
        return;
      }

      const seen = new Set<string>();
      const nextMatches: MatchRef[] = [];
      const push = (type: MatchRef["type"], rows: unknown[]) => {
        for (const row of rows as { id: string; date: string; created_at: string }[]) {
          if (seen.has(row.id)) continue;
          seen.add(row.id);
          nextMatches.push({ type, id: row.id, date: row.date, created_at: row.created_at });
        }
      };
      push("expense", textResult.data ?? []);
      push("expense", payerResult.data ?? []);
      push("settlement", settlementResult.data ?? []);
      nextMatches.sort(compareHistoryItems);

      try {
        const firstPage = await hydrate(nextMatches.slice(0, PAGE_SIZE));
        if (isStale()) return;
        const hydratedIds = new Set(firstPage.map((entry) => entry.id));
        setMatches(nextMatches);
        setOfflineMatches(queued);
        setEntries(
          [...queued.filter((entry) => !hydratedIds.has(entry.id)), ...firstPage].sort(
            compareHistoryItems,
          ),
        );
        setError(null);
        setLoading(false);
      } catch (hydrationError) {
        if (isStale()) return;
        setError(
          hydrationError instanceof Error
            ? hydrationError.message
            : "Unable to load search results",
        );
        setLoading(false);
      }
    }

    const timer = window.setTimeout(() => void run(), DEBOUNCE_MS);
    const unregisterRefresh = registerDataRefresh(() => void run());
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      unregisterRefresh();
    };
    // `categories`/`members` are new arrays each render; the joined keys below
    // are the stable identity. They also arrive async, so a search fired before
    // they load must re-run once they do.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, term, active, categoryKey, memberKey, hydrate]);

  const serverLoaded = entries.filter(
    (entry) => !offlineMatches.some((queued) => queued.id === entry.id),
  ).length;
  const hasMore = active && serverLoaded < matches.length;

  async function loadMore() {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    const runId = runIdRef.current;
    try {
      const nextPage = await hydrate(
        matches.slice(serverLoaded, serverLoaded + PAGE_SIZE),
      );
      if (runId !== runIdRef.current) return;
      setEntries((current) => {
        const existing = new Set(current.map((entry) => entry.id));
        return [...current, ...nextPage.filter((entry) => !existing.has(entry.id))].sort(
          compareHistoryItems,
        );
      });
    } catch (loadError) {
      if (runId !== runIdRef.current) return;
      setError(
        loadError instanceof Error ? loadError.message : "Unable to load more results",
      );
    } finally {
      setLoadingMore(false);
    }
  }

  return useMemo(
    () => ({
      active,
      entries,
      loading,
      loadingMore,
      hasMore,
      loadMore,
      error,
      resultCount: matches.length + offlineMatches.length,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active, entries, loading, loadingMore, hasMore, error, matches.length, offlineMatches.length],
  );
}
