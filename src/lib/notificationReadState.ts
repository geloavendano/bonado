import { supabase } from "@/lib/supabase";

/**
 * Clears the viewer's unread notifications for a single transaction.
 * RLS scopes the update to their own notification rows.
 */
export async function markTransactionNotificationsRead(target: {
  entryId?: string;
  settlementId?: string;
}) {
  let query = supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  if (target.entryId) {
    query = query.eq("entry_id", target.entryId);
  } else if (target.settlementId) {
    query = query.eq("settlement_id", target.settlementId);
  } else {
    return;
  }
  await query;
}
