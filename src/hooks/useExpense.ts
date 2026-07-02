import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const expenseCache = new Map<string, ExpenseDetail>();

export function invalidateExpense(entryId: string) {
  expenseCache.delete(entryId);
}

interface Person {
  id: string;
  name: string;
  avatar_url: string | null;
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
  last_edited_at: string | null;
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
      .select(`
        id, trip_id, description, date, currency, payee, status, created_at, last_edited_at,
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
      `)
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

  return { expense, loading, error, reload };
}
