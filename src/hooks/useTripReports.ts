import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { registerDataRefresh } from "@/lib/dataRefresh";

export interface ReportTransaction {
  id: string;
  description: string;
  payee: string | null;
  date: string;
  currency: string;
  exchange_rate_to_trip_default: number;
  groupAmount: number;
  userAmount: number;
  userPaid: number;
  payerNames: string[];
}

export interface CategoryReportRow {
  name: string;
  groupAmount: number;
  userAmount: number;
  transactions: ReportTransaction[];
}

interface ReportEntry {
  id: string;
  description: string;
  payee: string | null;
  date: string;
  currency: string;
  exchange_rate_to_trip_default: number;
  rate_is_estimated: boolean;
  category: { name: string } | null;
  payments: {
    amount_paid: number;
    user_id: string;
    user: { name: string } | null;
  }[];
  line_items: {
    line_item_shares: { user_id: string; owed_amount: number }[];
  }[];
  adjustments: {
    adjustment_shares: { user_id: string; owed_amount: number }[];
  }[];
}

export interface TripReport {
  categories: CategoryReportRow[];
  groupTotal: number;
  userTotal: number;
  hasEstimatedRates: boolean;
}

const EMPTY_REPORT: TripReport = {
  categories: [],
  groupTotal: 0,
  userTotal: 0,
  hasEstimatedRates: false,
};

const reportCache = new Map<string, TripReport>();

export function useTripReports(tripId: string, userId: string | undefined) {
  const cacheKey = `${tripId}:${userId ?? "guest"}`;
  const cached = reportCache.get(cacheKey);
  const [report, setReport] = useState<TripReport>(cached ?? EMPTY_REPORT);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!reportCache.has(cacheKey)) setLoading(true);
    const { data, error: queryError } = await supabase
      .from("entries")
      .select(`
        id, description, payee, date, currency, exchange_rate_to_trip_default, rate_is_estimated,
        category:categories(name),
        payments(amount_paid, user_id, user:users(name)),
        line_items(line_item_shares(user_id, owed_amount)),
        adjustments(adjustment_shares(user_id, owed_amount))
      `)
      .eq("trip_id", tripId)
      .eq("status", "active")
      .order("date", { ascending: false })
      .returns<ReportEntry[]>();

    if (queryError) {
      setError(queryError.message);
      setLoading(false);
      return;
    }

    const categories = new Map<string, CategoryReportRow>();
    let groupTotal = 0;
    let userTotal = 0;
    let hasEstimatedRates = false;

    for (const entry of data ?? []) {
      const rate = Number(entry.exchange_rate_to_trip_default) || 1;
      const groupAmount = entry.payments.reduce(
        (sum, payment) => sum + Number(payment.amount_paid),
        0,
      );
      const userAmount = userId
        ? entry.line_items.reduce(
            (sum, item) =>
              sum +
              item.line_item_shares
                .filter((share) => share.user_id === userId)
                .reduce((shareSum, share) => shareSum + Number(share.owed_amount), 0),
            0,
          ) +
          entry.adjustments.reduce(
            (sum, adjustment) =>
              sum +
              adjustment.adjustment_shares
                .filter((share) => share.user_id === userId)
                .reduce((shareSum, share) => shareSum + Number(share.owed_amount), 0),
            0,
          )
        : 0;
      const userPaid = userId
        ? entry.payments
            .filter((payment) => payment.user_id === userId)
            .reduce((sum, payment) => sum + Number(payment.amount_paid), 0)
        : 0;
      const name = entry.category?.name ?? "Other";
      const row = categories.get(name) ?? {
        name,
        groupAmount: 0,
        userAmount: 0,
        transactions: [],
      };

      row.groupAmount += groupAmount * rate;
      row.userAmount += userAmount * rate;
      row.transactions.push({
        id: entry.id,
        description: entry.description,
        payee: entry.payee,
        date: entry.date,
        currency: entry.currency,
        exchange_rate_to_trip_default: rate,
        groupAmount,
        userAmount,
        userPaid,
        payerNames: entry.payments.flatMap((payment) =>
          payment.user?.name ? [payment.user.name] : [],
        ),
      });
      categories.set(name, row);
      groupTotal += groupAmount * rate;
      userTotal += userAmount * rate;
      hasEstimatedRates ||= entry.rate_is_estimated;
    }

    const nextReport = {
      groupTotal,
      userTotal,
      hasEstimatedRates,
      categories: [...categories.values()].sort((a, b) => b.groupAmount - a.groupAmount),
    };
    reportCache.set(cacheKey, nextReport);
    setReport(nextReport);
    setError(null);
    setLoading(false);
  }, [cacheKey, tripId, userId]);

  useEffect(() => {
    const nextCached = reportCache.get(cacheKey);
    setReport(nextCached ?? EMPTY_REPORT);
    setLoading(!nextCached);
    void reload();
    return registerDataRefresh(reload);
  }, [cacheKey, reload]);

  return { report, loading, error, reload };
}
