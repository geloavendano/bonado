import { useCallback, useEffect, useState } from "react";
import {
  fetchBalances,
  getCachedBalances,
  type BalanceRow,
} from "@/lib/balanceData";

export function useBalances(tripId: string) {
  const cached = getCachedBalances(tripId);
  const [balances, setBalances] = useState<BalanceRow[]>(cached ?? []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const rows = await fetchBalances(tripId);
      setBalances(rows);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load balances");
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { balances, loading, error, reload };
}
