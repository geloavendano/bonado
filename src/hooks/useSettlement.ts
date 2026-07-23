import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { registerDataRefresh } from "@/lib/dataRefresh";

export interface SettlementDetail {
  id: string;
  trip_id: string;
  from_user_id: string;
  to_user_id: string;
  amount: number;
  date: string;
  created_at: string;
  updated_at: string | null;
  from_user: { id: string; name: string; avatar_url: string | null } | null;
  to_user: { id: string; name: string; avatar_url: string | null } | null;
  payment_account: {
    id: string;
    method: "Cash" | "Card" | "Bank" | "Other";
    label: string;
  } | null;
}

const settlementCache = new Map<string, SettlementDetail>();
const settlementPrefetching = new Set<string>();

const SETTLEMENT_DETAIL_SELECT = `
  id, trip_id, from_user_id, to_user_id, amount, date, created_at, updated_at,
  from_user:users!settlements_from_user_id_fkey(id, name, avatar_url),
  to_user:users!settlements_to_user_id_fkey(id, name, avatar_url),
  payment_account:payment_accounts(id, method, label)
`;

export async function prefetchSettlements(settlementIds: string[], limit = 16) {
  const missing = [...new Set(settlementIds)]
    .filter((settlementId) => !settlementCache.has(settlementId) && !settlementPrefetching.has(settlementId))
    .slice(0, limit);
  if (missing.length === 0) return;

  missing.forEach((settlementId) => settlementPrefetching.add(settlementId));
  const { data } = await supabase
    .from("settlements")
    .select(SETTLEMENT_DETAIL_SELECT)
    .in("id", missing)
    .returns<SettlementDetail[]>();
  data?.forEach((settlement) =>
    settlementCache.set(settlement.id, { ...settlement, amount: Number(settlement.amount) }),
  );
  missing.forEach((settlementId) => settlementPrefetching.delete(settlementId));
}

export function useSettlement(settlementId: string | undefined) {
  const cached = settlementId ? settlementCache.get(settlementId) ?? null : null;
  const [settlement, setSettlement] = useState<SettlementDetail | null>(cached);
  const [loading, setLoading] = useState(Boolean(settlementId && !cached));
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!settlementId) return;
    if (!settlementCache.has(settlementId)) setLoading(true);
    const { data, error: queryError } = await supabase
      .from("settlements")
      .select(SETTLEMENT_DETAIL_SELECT)
      .eq("id", settlementId)
      .returns<SettlementDetail[]>()
      .maybeSingle();
    const nextSettlement = data ? { ...data, amount: Number(data.amount) } : null;
    if (nextSettlement) settlementCache.set(settlementId, nextSettlement);
    setSettlement(nextSettlement);
    setError(queryError?.message ?? null);
    setLoading(false);
  }, [settlementId]);

  useEffect(() => {
    if (!settlementId) return;
    const nextCached = settlementCache.get(settlementId) ?? null;
    setSettlement(nextCached);
    setLoading(!nextCached);
    void reload();
    return registerDataRefresh(reload);
  }, [reload, settlementId]);

  return { settlement, loading, error, reload };
}
