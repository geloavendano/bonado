import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type NotificationKind =
  | "expense_created"
  | "expense_edited"
  | "expense_deleted"
  | "settlement_created"
  | "settlement_edited"
  | "comment_added"
  | "comment_mention";

interface Person {
  id: string;
  name: string;
  avatar_url: string | null;
}

export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  created_at: string;
  trip_id: string;
  entry_id: string | null;
  settlement_id: string | null;
  actor: Person | null;
  trip: { id: string; name: string; default_currency: string } | null;
  entry: { id: string; description: string; status: string } | null;
  settlement: { id: string; amount: number } | null;
  comment: { id: string; body: string } | null;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const { data } = await supabase
      .from("notifications")
      .select(`
        id, kind, created_at, trip_id, entry_id, settlement_id,
        actor:users!notifications_actor_id_fkey(id, name, avatar_url),
        trip:trips(id, name, default_currency),
        entry:entries(id, description, status),
        settlement:settlements(id, amount),
        comment:comments(id, body)
      `)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(100)
      .returns<NotificationItem[]>();
    setNotifications(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
    const refetch = () => {
      if (document.visibilityState === "visible") void reload();
    };
    window.addEventListener("focus", refetch);
    document.addEventListener("visibilitychange", refetch);
    return () => {
      window.removeEventListener("focus", refetch);
      document.removeEventListener("visibilitychange", refetch);
    };
  }, [reload]);

  const markRead = useCallback(async (id: string) => {
    setNotifications((current) => current.filter((n) => n.id !== id));
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications([]);
    await supabase.rpc("mark_all_notifications_read");
  }, []);

  return { notifications, loading, reload, markRead, markAllRead };
}
