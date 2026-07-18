import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { registerDataRefresh } from "@/lib/dataRefresh";
import { useAuth } from "@/context/AuthContext";

const PAGE_SIZE = 20;
const NOTIFICATION_SELECT = `
  id, kind, created_at, trip_id, entry_id, settlement_id,
  actor:users!notifications_actor_id_fkey(id, name, avatar_url),
  trip:trips(id, name, default_currency),
  entry:entries(id, description, status),
  settlement:settlements(id, amount),
  comment:comments(
    id, body,
    comment_mentions(user:users(id, name))
  )
`;

export type NotificationKind =
  | "expense_created"
  | "expense_edited"
  | "expense_deleted"
  | "settlement_created"
  | "settlement_edited"
  | "settlement_deleted"
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
  comment: {
    id: string;
    body: string;
    comment_mentions: {
      user: { id: string; name: string } | null;
    }[];
  } | null;
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const reload = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }
    const { data, count } = await supabase
      .from("notifications")
      .select(NOTIFICATION_SELECT, { count: "exact" })
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .range(0, PAGE_SIZE - 1)
      .returns<NotificationItem[]>();
    setNotifications(data ?? []);
    setUnreadCount(count ?? data?.length ?? 0);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void reload();
    const unregisterRefresh = registerDataRefresh(reload);
    const refetch = () => {
      if (document.visibilityState === "visible") void reload();
    };
    window.addEventListener("focus", refetch);
    document.addEventListener("visibilitychange", refetch);
    return () => {
      unregisterRefresh();
      window.removeEventListener("focus", refetch);
      document.removeEventListener("visibilitychange", refetch);
    };
  }, [reload]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`bonado:notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "bonado",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void reload();
          window.dispatchEvent(new Event("bonado:notifications-changed"));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [reload, user]);

  const markRead = useCallback(async (id: string) => {
    setNotifications((current) => current.filter((n) => n.id !== id));
    setUnreadCount((current) => Math.max(0, current - 1));
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
    window.dispatchEvent(new Event("bonado:notifications-read"));
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications([]);
    setUnreadCount(0);
    await supabase.rpc("mark_all_notifications_read");
    window.dispatchEvent(new Event("bonado:notifications-read"));
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || notifications.length >= unreadCount) return;
    setLoadingMore(true);
    const { data } = await supabase
      .from("notifications")
      .select(NOTIFICATION_SELECT)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .range(notifications.length, notifications.length + PAGE_SIZE - 1)
      .returns<NotificationItem[]>();
    setNotifications((current) => [...current, ...(data ?? [])]);
    setLoadingMore(false);
  }, [loadingMore, notifications.length, unreadCount]);

  return {
    notifications,
    unreadCount,
    loading,
    loadingMore,
    hasMore: notifications.length < unreadCount,
    loadMore,
    reload,
    markRead,
    markAllRead,
  };
}
