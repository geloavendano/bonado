import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { invalidateBalances } from "@/lib/balanceData";
import { invalidateRecentEntries } from "@/hooks/useRecentEntries";

interface SettlementInput {
  tripId: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  date: string;
  paymentMethod: string;
  paymentLabel: string;
}

export function useRecordSettlement() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function recordSettlement(input: SettlementInput) {
    setSaving(true);
    setError(null);
    const { error: settlementError } = await supabase.rpc("record_settlement", {
      p_trip_id: input.tripId,
      p_from_user_id: input.fromUserId,
      p_to_user_id: input.toUserId,
      p_amount: input.amount,
      p_date: input.date,
      p_payment_method: input.paymentMethod,
      p_payment_label: input.paymentLabel,
    });
    setSaving(false);
    if (settlementError) {
      setError(settlementError.message);
      return false;
    }
    invalidateBalances(input.tripId);
    invalidateRecentEntries(input.tripId);
    return true;
  }

  return { recordSettlement, saving, error };
}
