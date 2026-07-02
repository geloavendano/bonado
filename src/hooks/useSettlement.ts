import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

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

export function useSettlement(settlementId: string | undefined) {
  const [settlement, setSettlement] = useState<SettlementDetail | null>(null);
  const [loading, setLoading] = useState(Boolean(settlementId));
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!settlementId) return;
    setLoading(true);
    const { data, error: queryError } = await supabase
      .from("settlements")
      .select(`
        id, trip_id, from_user_id, to_user_id, amount, date, created_at, updated_at,
        from_user:users!settlements_from_user_id_fkey(id, name, avatar_url),
        to_user:users!settlements_to_user_id_fkey(id, name, avatar_url),
        payment_account:payment_accounts(id, method, label)
      `)
      .eq("id", settlementId)
      .returns<SettlementDetail[]>()
      .maybeSingle();
    setSettlement(data ? { ...data, amount: Number(data.amount) } : null);
    setError(queryError?.message ?? null);
    setLoading(false);
  }, [settlementId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { settlement, loading, error, reload };
}
