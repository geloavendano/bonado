import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { invalidateSettlement } from "@/hooks/useSettlement";
import { invalidateBalances } from "@/lib/balanceData";
import { invalidateRecentEntries } from "@/hooks/useRecentEntries";

export function useUpdateSettlement() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function updateSettlement(input: {
    settlementId: string;
    tripId: string;
    fromUserId: string;
    toUserId: string;
    amount: number;
    currency: string;
    rates: Record<string, number>;
    date: string;
    paymentMethod: string;
    paymentLabel: string;
  }) {
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase.rpc("update_settlement_in_currency", {
      p_settlement_id: input.settlementId,
      p_trip_id: input.tripId,
      p_from_user_id: input.fromUserId,
      p_to_user_id: input.toUserId,
      p_amount: input.amount,
      p_currency: input.currency,
      p_rates: input.rates,
      p_date: input.date,
      p_payment_method: input.paymentMethod,
      p_payment_label: input.paymentLabel,
    });
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return false;
    }
    invalidateSettlement(input.settlementId);
    invalidateBalances(input.tripId);
    invalidateRecentEntries(input.tripId);
    sessionStorage.setItem("bonado:pending-toast", "Settlement changes have been saved.");
    navigate(-1);
    return true;
  }

  return { updateSettlement, saving, error };
}
