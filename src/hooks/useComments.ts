import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const PAGE_SIZE = 20;

interface Person {
  id: string;
  name: string;
  avatar_url: string | null;
}

export interface CommentItem {
  id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
  author_id: string;
  author: Person | null;
}

export function useComments(target: { entryId?: string; settlementId?: string }) {
  const { entryId, settlementId } = target;
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (requestedLimit = PAGE_SIZE) => {
    if (!entryId && !settlementId) return;
    let query = supabase
      .from("comments")
      .select(
        "id, body, created_at, edited_at, author_id, author:users!comments_author_id_fkey(id, name, avatar_url)",
      )
      .order("created_at", { ascending: false })
      .range(0, requestedLimit - 1);
    query = entryId
      ? query.eq("entry_id", entryId)
      : query.eq("settlement_id", settlementId);
    const { data, error: queryError } = await query.returns<CommentItem[]>();
    if (queryError) {
      setError(queryError.message);
    } else {
      setComments(data ?? []);
      setHasMore((data?.length ?? 0) === requestedLimit);
      setError(null);
    }
    setLoading(false);
  }, [entryId, settlementId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const addComment = useCallback(
    async (body: string, mentionIds: string[]) => {
      const { error: rpcError } = await supabase.rpc("add_comment", {
        p_entry_id: entryId ?? null,
        p_settlement_id: settlementId ?? null,
        p_body: body,
        p_mentions: mentionIds,
      });
      if (rpcError) {
        setError(rpcError.message);
        return false;
      }
      await reload(Math.max(PAGE_SIZE, comments.length + 1));
      return true;
    },
    [comments.length, entryId, settlementId, reload],
  );

  const updateComment = useCallback(
    async (commentId: string, body: string, mentionIds: string[]) => {
      const { error: rpcError } = await supabase.rpc("update_comment", {
        p_comment_id: commentId,
        p_body: body,
        p_mentions: mentionIds,
      });
      if (rpcError) {
        setError(rpcError.message);
        return false;
      }
      await reload(Math.max(PAGE_SIZE, comments.length));
      return true;
    },
    [comments.length, reload],
  );

  const deleteComment = useCallback(
    async (commentId: string) => {
      const { error: rpcError } = await supabase.rpc("delete_comment", {
        p_comment_id: commentId,
      });
      if (rpcError) {
        setError(rpcError.message);
        return false;
      }
      setComments((current) => current.filter((c) => c.id !== commentId));
      return true;
    },
    [],
  );

  const loadMore = useCallback(async () => {
    if ((!entryId && !settlementId) || loadingMore || !hasMore) return;
    setLoadingMore(true);
    let query = supabase
      .from("comments")
      .select(
        "id, body, created_at, edited_at, author_id, author:users!comments_author_id_fkey(id, name, avatar_url)",
      )
      .order("created_at", { ascending: false })
      .range(comments.length, comments.length + PAGE_SIZE - 1);
    query = entryId
      ? query.eq("entry_id", entryId)
      : query.eq("settlement_id", settlementId);
    const { data, error: queryError } = await query.returns<CommentItem[]>();
    if (queryError) {
      setError(queryError.message);
    } else {
      const rows = data ?? [];
      setComments((current) => [...current, ...rows]);
      setHasMore(rows.length === PAGE_SIZE);
    }
    setLoadingMore(false);
  }, [comments.length, entryId, hasMore, loadingMore, settlementId]);

  return {
    comments,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    error,
    addComment,
    updateComment,
    deleteComment,
  };
}
