import { useState } from "react";
import { supabase } from "@/lib/supabase";

export function useManageTripGuests() {
  const [busyGuestId, setBusyGuestId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addGuest(tripId: string, name: string) {
    setAdding(true);
    setError(null);
    const { error: addError } = await supabase.rpc("add_temporary_trip_member", {
      p_trip_id: tripId,
      p_name: name,
    });
    setAdding(false);
    if (addError) {
      setError(addError.message);
      return false;
    }
    return true;
  }

  async function renameGuest(tripId: string, guestId: string, name: string) {
    setBusyGuestId(guestId);
    setError(null);
    const { error: renameError } = await supabase.rpc("rename_trip_guest", {
      p_trip_id: tripId,
      p_guest_id: guestId,
      p_name: name,
    });
    setBusyGuestId(null);
    if (renameError) {
      setError(renameError.message);
      return false;
    }
    return true;
  }

  async function removeGuest(tripId: string, guestId: string) {
    setBusyGuestId(guestId);
    setError(null);
    const { error: removeError } = await supabase.rpc("remove_trip_guest", {
      p_trip_id: tripId,
      p_guest_id: guestId,
    });
    setBusyGuestId(null);
    if (removeError) {
      setError(removeError.message);
      return false;
    }
    return true;
  }

  return { addGuest, renameGuest, removeGuest, adding, busyGuestId, error };
}
