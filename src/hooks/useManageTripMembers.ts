import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { invalidateBalances } from "@/lib/balanceData";

export function useManageTripMembers() {
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function removeMember(tripId: string, memberId: string) {
    setBusyMemberId(memberId);
    setError(null);
    const { error: removeError } = await supabase.rpc("remove_trip_member", {
      p_trip_id: tripId,
      p_member_id: memberId,
    });
    setBusyMemberId(null);

    if (removeError) {
      setError(removeError.message);
      return false;
    }

    invalidateBalances(tripId);
    return true;
  }

  return { removeMember, busyMemberId, error };
}

