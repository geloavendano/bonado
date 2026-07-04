import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { invalidateRecentEntries } from "@/hooks/useRecentEntries";
import { invalidateBalances } from "@/lib/balanceData";

export function useSettlementMutations() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteSettlement(settlementId: string, tripId: string) {
    setSaving(true);
    setError(null);
    const { error: deleteError } = await supabase.rpc("delete_settlement", {
      p_settlement_id: settlementId,
    });
    setSaving(false);

    if (deleteError) {
      setError(deleteError.message);
      return false;
    }

    invalidateRecentEntries(tripId);
    invalidateBalances(tripId);
    return true;
  }

  return { deleteSettlement, saving, error };
}

