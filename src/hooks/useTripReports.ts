import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface ReportPayment {
  amount_paid: number;
  user_id: string;
  payment_account: {
    id: string;
    user_id: string;
    label: string;
    type: string;
    method: string | null;
  } | null;
}

interface ReportEntry {
  id: string;
  exchange_rate_to_trip_default: number;
  rate_is_estimated: boolean;
  category: { name: string; icon: string } | null;
  payments: ReportPayment[];
}

interface ReportSettlement {
  id: string;
  from_user_id: string;
  to_user_id: string;
  amount: number;
  payment_account: ReportPayment["payment_account"];
}

export interface CategoryReportRow {
  name: string;
  icon: string;
  amount: number;
}

export interface AccountReportRow {
  key: string;
  ownerId: string;
  label: string;
  method: string;
  expenseOut: number;
  transferOut: number;
  transferIn: number;
}

export interface TripReport {
  categories: CategoryReportRow[];
  accounts: AccountReportRow[];
  totalSpend: number;
  hasEstimatedRates: boolean;
}

const EMPTY_REPORT: TripReport = {
  categories: [],
  accounts: [],
  totalSpend: 0,
  hasEstimatedRates: false,
};

export function useTripReports(tripId: string) {
  const [report, setReport] = useState<TripReport>(EMPTY_REPORT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const [entriesResult, settlementsResult] = await Promise.all([
      supabase
        .from("entries")
        .select(`
          id, exchange_rate_to_trip_default, rate_is_estimated,
          category:categories(name, icon),
          payments(
            amount_paid, user_id,
            payment_account:payment_accounts(id, user_id, label, type, method)
          )
        `)
        .eq("trip_id", tripId)
        .eq("status", "active")
        .returns<ReportEntry[]>(),
      supabase
        .from("settlements")
        .select(`
          id, from_user_id, to_user_id, amount,
          payment_account:payment_accounts(id, user_id, label, type, method)
        `)
        .eq("trip_id", tripId)
        .returns<ReportSettlement[]>(),
    ]);

    const queryError = entriesResult.error ?? settlementsResult.error;
    if (queryError) {
      setError(queryError.message);
      setLoading(false);
      return;
    }

    const categories = new Map<string, CategoryReportRow>();
    const accounts = new Map<string, AccountReportRow>();
    let totalSpend = 0;
    let hasEstimatedRates = false;

    function accountRow(
      key: string,
      ownerId: string,
      label: string,
      method: string,
    ) {
      const existing = accounts.get(key);
      if (existing) return existing;
      const row: AccountReportRow = {
        key,
        ownerId,
        label,
        method,
        expenseOut: 0,
        transferOut: 0,
        transferIn: 0,
      };
      accounts.set(key, row);
      return row;
    }

    for (const entry of entriesResult.data ?? []) {
      const rate = Number(entry.exchange_rate_to_trip_default) || 1;
      const amount = entry.payments.reduce(
        (sum, payment) => sum + Number(payment.amount_paid) * rate,
        0,
      );
      totalSpend += amount;
      hasEstimatedRates ||= entry.rate_is_estimated;
      const categoryName = entry.category?.name ?? "Uncategorized";
      const category = categories.get(categoryName) ?? {
        name: categoryName,
        icon: entry.category?.icon ?? "•",
        amount: 0,
      };
      category.amount += amount;
      categories.set(categoryName, category);

      for (const payment of entry.payments) {
        const account = payment.payment_account;
        const row = accountRow(
          account?.id ?? `expense-unassigned:${payment.user_id}`,
          payment.user_id,
          account?.label || "Unspecified account",
          account?.method || account?.type || "Other",
        );
        row.expenseOut += Number(payment.amount_paid) * rate;
      }
    }

    for (const settlement of settlementsResult.data ?? []) {
      const amount = Number(settlement.amount);
      const account = settlement.payment_account;
      accountRow(
        account?.id ?? `transfer-unassigned:${settlement.from_user_id}`,
        settlement.from_user_id,
        account?.label || "Unspecified account",
        account?.method || account?.type || "Other",
      ).transferOut += amount;
      accountRow(
        `received:${settlement.to_user_id}`,
        settlement.to_user_id,
        "Received transfers",
        "Transfer",
      ).transferIn += amount;
    }

    setReport({
      totalSpend,
      hasEstimatedRates,
      categories: [...categories.values()].sort((a, b) => b.amount - a.amount),
      accounts: [...accounts.values()].sort(
        (a, b) =>
          b.expenseOut + b.transferOut + b.transferIn -
          (a.expenseOut + a.transferOut + a.transferIn),
      ),
    });
    setError(null);
    setLoading(false);
  }, [tripId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { report, loading, error, reload };
}
