import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface UnreadNotificationRow {
  entry_id: string | null;
  settlement_id: string | null;
}

export function useUnreadTransactions(tripId: string) {
  const [entryIds, setEntryIds] = useState<Set<string>>(new Set());
  const [settlementIds, setSettlementIds] = useState<Set<string>>(new Set());

  const reload = useCallback(async () => {
    const { data } = await supabase
      .from("notifications")
      .select("entry_id, settlement_id")
      .eq("trip_id", tripId)
      .is("read_at", null)
      .returns<UnreadNotificationRow[]>();
    const rows = data ?? [];
    setEntryIds(new Set(rows.flatMap((row) => row.entry_id ? [row.entry_id] : [])));
    setSettlementIds(
      new Set(rows.flatMap((row) => row.settlement_id ? [row.settlement_id] : [])),
    );
  }, [tripId]);

  useEffect(() => {
    void reload();
    const refresh = () => void reload();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("bonado:notifications-read", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("bonado:notifications-read", refresh);
    };
  }, [reload]);

  return { entryIds, settlementIds, reload };
}

