import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { registerDataRefresh } from "@/lib/dataRefresh";
import { useAuth } from "@/context/AuthContext";

const PAGE_SIZE = 20;
const BASE_NOTIFICATION_SELECT =
  "id, kind, created_at, trip_id, entry_id, settlement_id, comment_id, actor_id";

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

interface NotificationRow {
  id: string;
  kind: NotificationKind;
  created_at: string;
  trip_id: string;
  entry_id: string | null;
  settlement_id: string | null;
  comment_id: string | null;
  actor_id: string;
}

function unique(values: (string | null | undefined)[]) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

async function fetchByIds<T extends { id: string }>(
  table: string,
  columns: string,
  ids: string[],
) {
  if (ids.length === 0) return new Map<string, T>();
  const { data, error } = await supabase
    .from(table)
    .select(columns)
    .in("id", ids)
    .returns<T[]>();
  if (error) {
    console.warn(`Could not load notification ${table}`, error);
    return new Map<string, T>();
  }
  return new Map((data ?? []).map((row) => [row.id, row]));
}

async function hydrateNotifications(
  rows: NotificationRow[],
): Promise<NotificationItem[]> {
  if (rows.length === 0) return [];

  const [actors, trips, entries, settlements, comments] = await Promise.all([
    fetchByIds<Person>("users", "id, name, avatar_url", unique(rows.map((row) => row.actor_id))),
    fetchByIds<{ id: string; name: string; default_currency: string }>(
      "trips",
      "id, name, default_currency",
      unique(rows.map((row) => row.trip_id)),
    ),
    fetchByIds<{ id: string; description: string; status: string }>(
      "entries",
      "id, description, status",
      unique(rows.map((row) => row.entry_id)),
    ),
    fetchByIds<{ id: string; amount: number }>(
      "settlements",
      "id, amount",
      unique(rows.map((row) => row.settlement_id)),
    ),
    fetchByIds<{ id: string; body: string }>(
      "comments",
      "id, body",
      unique(rows.map((row) => row.comment_id)),
    ),
  ]);

  const commentIds = unique(rows.map((row) => row.comment_id));
  let mentionsByComment = new Map<
    string,
    { user: { id: string; name: string } | null }[]
  >();
  if (commentIds.length > 0) {
    const { data: mentions, error: mentionsError } = await supabase
      .from("comment_mentions")
      .select("comment_id, user_id")
      .in("comment_id", commentIds)
      .returns<{ comment_id: string; user_id: string }[]>();
    if (mentionsError) {
      console.warn("Could not load notification comment mentions", mentionsError);
    } else {
      const mentionUsers = await fetchByIds<{ id: string; name: string }>(
        "users",
        "id, name",
        unique(mentions?.map((mention) => mention.user_id) ?? []),
      );
      mentionsByComment = new Map(
        commentIds.map((commentId) => [
          commentId,
          (mentions ?? [])
            .filter((mention) => mention.comment_id === commentId)
            .map((mention) => ({
              user: mentionUsers.get(mention.user_id) ?? null,
            })),
        ]),
      );
    }
  }

  return rows.map((row) => {
    const comment = row.comment_id ? comments.get(row.comment_id) : null;
    return {
      id: row.id,
      kind: row.kind,
      created_at: row.created_at,
      trip_id: row.trip_id,
      entry_id: row.entry_id,
      settlement_id: row.settlement_id,
      actor: actors.get(row.actor_id) ?? null,
      trip: trips.get(row.trip_id) ?? null,
      entry: row.entry_id ? entries.get(row.entry_id) ?? null : null,
      settlement: row.settlement_id
        ? settlements.get(row.settlement_id) ?? null
        : null,
      comment: comment
        ? {
            ...comment,
            comment_mentions: mentionsByComment.get(comment.id) ?? [],
          }
        : null,
    };
  });
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
    setLoading(true);
    const { data, count, error } = await supabase
      .from("notifications")
      .select(BASE_NOTIFICATION_SELECT, { count: "exact" })
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .range(0, PAGE_SIZE - 1)
      .returns<NotificationRow[]>();
    if (error) {
      console.warn("Could not load notifications", error);
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }
    setNotifications(await hydrateNotifications(data ?? []));
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
    const { data, error } = await supabase
      .from("notifications")
      .select(BASE_NOTIFICATION_SELECT)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .range(notifications.length, notifications.length + PAGE_SIZE - 1)
      .returns<NotificationRow[]>();
    if (!error) {
      const hydrated = await hydrateNotifications(data ?? []);
      setNotifications((current) => [...current, ...hydrated]);
    } else {
      console.warn("Could not load more notifications", error);
    }
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
