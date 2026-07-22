import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { PaymentAccount, PaymentMethod } from "@/types/schema";

const methodType = (method: PaymentMethod): PaymentAccount["type"] => {
  if (method === "Cash") return "cash";
  if (method === "Bank") return "bank";
  return "other";
};

export interface PaymentAccountInput {
  method: PaymentMethod;
  label: string;
  accountNumber: string;
  currency: string;
}

export function usePaymentAccounts(userId: string | undefined, sharedOnly = true) {
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!userId) {
      setAccounts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let query = supabase
      .from("payment_accounts")
      .select("id, user_id, type, method, label, currency, is_shared, account_number")
      .eq("user_id", userId)
      .order("method", { ascending: true })
      .order("label", { ascending: true });

    if (sharedOnly) query = query.eq("is_shared", true);

    const { data, error: queryError } = await query.returns<PaymentAccount[]>();
    setAccounts(data ?? []);
    setError(queryError?.message ?? null);
    setLoading(false);
  }, [sharedOnly, userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function upsertAccount(account: PaymentAccountInput, id?: string) {
    if (!userId) return false;
    setError(null);
    const payload = {
      user_id: userId,
      type: methodType(account.method),
      method: account.method,
      label: account.label.trim() || account.method,
      account_number: account.accountNumber.trim() || null,
      currency: account.currency,
      is_shared: true,
    };

    const { error: mutationError } = id
      ? await supabase.from("payment_accounts").update(payload).eq("id", id)
      : await supabase.from("payment_accounts").insert(payload);

    if (mutationError) {
      setError(mutationError.message);
      return false;
    }
    await reload();
    return true;
  }

  async function deleteAccount(id: string) {
    setError(null);
    const { error: mutationError } = await supabase
      .from("payment_accounts")
      .delete()
      .eq("id", id);
    if (mutationError) {
      setError(mutationError.message);
      return false;
    }
    await reload();
    return true;
  }

  return { accounts, loading, error, reload, upsertAccount, deleteAccount };
}
