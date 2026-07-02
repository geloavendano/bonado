import { supabase } from "@/lib/supabase";

export interface BalanceRow {
  user_id: string;
  balance: number;
  has_estimated_rates: boolean;
  has_activity: boolean;
}

const balanceCache = new Map<string, BalanceRow[]>();

export function invalidateBalances(tripId: string) {
  balanceCache.delete(tripId);
}

export function getCachedBalances(tripId: string) {
  return balanceCache.get(tripId);
}

export async function fetchBalances(tripId: string) {
  const { data, error } = await supabase.rpc("get_trip_balances", {
    p_trip_id: tripId,
  });
  if (error) throw error;
  const rows = ((data as unknown as BalanceRow[] | null) ?? []).map((row) => ({
    ...row,
    balance: Number(row.balance),
  }));
  balanceCache.set(tripId, rows);
  return rows;
}
