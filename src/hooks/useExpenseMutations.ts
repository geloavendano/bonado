import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { invalidateExpense } from "@/hooks/useExpense";
import { invalidateRecentEntries } from "@/hooks/useRecentEntries";

export function useExpenseMutations() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function updateDetails(
    entryId: string,
    input: { description: string; payee: string; date: string; categoryId: string | null },
  ) {
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase.rpc("update_entry_details", {
      p_entry_id: entryId,
      p_description: input.description,
      p_payee: input.payee,
      p_date: input.date,
      p_category_id: input.categoryId,
    });
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return false;
    }
    return true;
  }

  async function deleteExpense(entryId: string, tripId?: string) {
    setSaving(true);
    setError(null);
    const { error: deleteError } = await supabase.rpc("soft_delete_entry", {
      p_entry_id: entryId,
    });
    setSaving(false);
    if (deleteError) {
      setError(deleteError.message);
      return false;
    }
    invalidateExpense(entryId);
    if (tripId) invalidateRecentEntries(tripId);
    return true;
  }

  return { updateDetails, deleteExpense, saving, error };
}
