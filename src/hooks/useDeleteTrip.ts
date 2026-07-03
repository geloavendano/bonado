import { useState } from "react";
import { supabase } from "@/lib/supabase";

export function useDeleteTrip() {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteTrip(tripId: string) {
    setDeleting(true);
    setError(null);
    const { error: deleteError } = await supabase.from("trips").delete().eq("id", tripId);
    setDeleting(false);
    if (deleteError) {
      setError(deleteError.message);
      return false;
    }
    return true;
  }

  return { deleteTrip, deleting, error };
}
