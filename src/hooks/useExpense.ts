import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { registerDataRefresh } from "@/lib/dataRefresh";

const expenseCache = new Map<string, ExpenseDetail>();
const expensePrefetching = new Set<string>();

const EXPENSE_DETAIL_SELECT = `
  id, trip_id, description, date, currency, payee, status,
  created_at, created_by, last_edited_at, last_edited_by, edit_log,
  created_by_user:users!entries_created_by_fkey(id, name, avatar_url),
  last_edited_by_user:users!entries_last_edited_by_fkey(id, name, avatar_url),
  category:categories(id, name, icon),
  payments(
    amount_paid, user_id,
    user:users(id, name, avatar_url),
    payment_account:payment_accounts(id, label, type, method)
  ),
  line_items(
    id, description, amount,
    line_item_shares(
      user_id, share_type, share_value, owed_amount,
      user:users(id, name, avatar_url)
    )
  ),
  adjustments(
    id, type, mode, amount,
    adjustment_shares(
      user_id, owed_amount,
      user:users(id, name, avatar_url)
    )
  ),
  entry_attachments(id, storage_path, uploaded_at)
`;

export function invalidateExpense(entryId: string) {
  expenseCache.delete(entryId);
}

interface Person {
  id: string;
  name: string;
  avatar_url: string | null;
}

export interface ExpenseEditLogChange {
  field: string;
  from: unknown;
  to: unknown;
  currency?: string;
}

export interface ExpenseEditLogEntry {
  at: string;
  by: string | null;
  by_name: string | null;
  changes: ExpenseEditLogChange[];
}

export interface ExpenseDetail {
  id: string;
  trip_id: string;
  description: string;
  date: string;
  currency: string;
  payee: string | null;
  status: string;
  created_at: string;
  created_by: string;
  created_by_user: Person | null;
  last_edited_by: string | null;
  last_edited_at: string | null;
  last_edited_by_user: Person | null;
  edit_log: ExpenseEditLogEntry[];
  category: { id: string; name: string; icon: string } | null;
  payments: {
    amount_paid: number;
    user_id: string;
    user: Person | null;
    payment_account: {
      id: string;
      label: string;
      type: string;
      method: "Cash" | "Card" | "Bank" | "Other";
    } | null;
  }[];
  line_items: {
    id: string;
    description: string;
    amount: number;
    line_item_shares: {
      user_id: string;
      share_type: string;
      share_value: number | null;
      owed_amount: number;
      user: Person | null;
    }[];
  }[];
  adjustments: {
    id: string;
    type: string;
    mode: string;
    amount: number;
    adjustment_shares: {
      user_id: string;
      owed_amount: number;
      user: Person | null;
    }[];
  }[];
  entry_attachments: {
    id: string;
    storage_path: string;
    uploaded_at: string;
  }[];
}

export async function prefetchExpenses(entryIds: string[], limit = 16) {
  const missing = [...new Set(entryIds)]
    .filter((entryId) => !expenseCache.has(entryId) && !expensePrefetching.has(entryId))
    .slice(0, limit);
  if (missing.length === 0) return;

  missing.forEach((entryId) => expensePrefetching.add(entryId));
  const { data } = await supabase
    .from("entries")
    .select(EXPENSE_DETAIL_SELECT)
    .in("id", missing)
    .eq("status", "active")
    .returns<ExpenseDetail[]>();
  data?.forEach((expense) => expenseCache.set(expense.id, expense));
  missing.forEach((entryId) => expensePrefetching.delete(entryId));
}

export function useExpense(entryId: string | undefined) {
  const cached = entryId ? expenseCache.get(entryId) ?? null : null;
  const [expense, setExpense] = useState<ExpenseDetail | null>(cached);
  const [loading, setLoading] = useState(Boolean(entryId && !cached));
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!entryId) return;
    setLoading(true);
    const { data, error: queryError } = await supabase
      .from("entries")
      .select(EXPENSE_DETAIL_SELECT)
      .eq("id", entryId)
      .eq("status", "active")
      .returns<ExpenseDetail[]>()
      .maybeSingle();

    if (queryError) {
      setError(queryError.message);
      setExpense(null);
    } else {
      setExpense(data);
      if (data) expenseCache.set(entryId, data);
      setError(null);
    }
    setLoading(false);
  }, [entryId]);

  useEffect(() => {
    if (!entryId) {
      setLoading(false);
      return;
    }
    const cachedExpense = expenseCache.get(entryId);
    if (cachedExpense) {
      setExpense(cachedExpense);
      setLoading(false);
      return;
    }
    void reload();
  }, [entryId, reload]);

  useEffect(() => registerDataRefresh(reload), [reload]);

  return { expense, loading, error, reload };
}
