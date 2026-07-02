import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { invalidateExpense } from "@/hooks/useExpense";
import { invalidateRecentEntries } from "@/hooks/useRecentEntries";
import { invalidateBalances } from "@/lib/balanceData";
import { fetchExchangeRate } from "@/hooks/useCurrencyRates";

export interface PayerAllocation {
  userId: string;
  amount: number;
  paymentMethod: string;
  paymentLabel: string;
}

export interface SimpleExpenseInput {
  tripId: string;
  amount: number;
  currency: string;
  tripDefaultCurrency: string;
  description: string;
  payee: string;
  date: string;
  categoryId: string | null;
  payers: PayerAllocation[];
  participantIds: string[];
}

export interface ItemizedExpenseItem {
  description: string;
  amount: number;
  shares: {
    userId: string;
    shareType: "equal" | "exact" | "percent" | "shares";
    shareValue: number | null;
    owedAmount: number;
  }[];
}

export interface ExpenseAdjustment {
  type: "tax" | "tip" | "service_charge";
  mode: "proportional" | "own_item";
  amount: number;
  shares: { userId: string; owedAmount: number }[];
}

export interface ItemizedExpenseInput extends Omit<SimpleExpenseInput, "participantIds"> {
  items: ItemizedExpenseItem[];
  adjustments: ExpenseAdjustment[];
}

export function useCreateExpense() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resolveRate(input: Pick<SimpleExpenseInput, "currency" | "tripDefaultCurrency">) {
    return fetchExchangeRate(input.currency, input.tripDefaultCurrency);
  }

  async function createExpense(input: SimpleExpenseInput) {
    setSubmitting(true);
    setError(null);
    let exchangeRate: number;
    try {
      exchangeRate = await resolveRate(input);
    } catch (rateError) {
      setSubmitting(false);
      setError(rateError instanceof Error ? rateError.message : "Unable to load exchange rate");
      return false;
    }

    const participantCount = input.participantIds.length;
    const baseShare = Math.floor((input.amount * 100) / participantCount) / 100;
    let allocated = 0;
    const equalShares = input.participantIds.map((userId, index) => {
      const owedAmount =
        index === participantCount - 1
          ? Math.round((input.amount - allocated) * 100) / 100
          : baseShare;
      allocated += owedAmount;
      return {
        user_id: userId,
        share_type: "equal",
        share_value: null,
        owed_amount: owedAmount,
      };
    });

    const { error: createError } = await supabase.rpc("create_itemized_expense_with_rate", {
      p_trip_id: input.tripId,
      p_amount: input.amount,
      p_currency: input.currency,
      p_exchange_rate: exchangeRate,
      p_description: input.description,
      p_payee: input.payee,
      p_date: input.date,
      p_category_id: input.categoryId,
      p_payers: input.payers.map((payer) => ({
        user_id: payer.userId,
        amount: payer.amount,
        payment_method: payer.paymentMethod,
        payment_label: payer.paymentLabel,
      })),
      p_items: [{
        description: input.description,
        amount: input.amount,
        shares: equalShares,
      }],
      p_adjustments: [],
    });

    if (createError) {
      setSubmitting(false);
      setError(createError.message);
      return false;
    }
    setSubmitting(false);

    invalidateRecentEntries(input.tripId);
    invalidateBalances(input.tripId);
    navigate(`/trips/${input.tripId}`, { replace: true });
    return true;
  }

  async function createItemizedExpense(input: ItemizedExpenseInput) {
    setSubmitting(true);
    setError(null);
    let exchangeRate: number;
    try {
      exchangeRate = await resolveRate(input);
    } catch (rateError) {
      setSubmitting(false);
      setError(rateError instanceof Error ? rateError.message : "Unable to load exchange rate");
      return false;
    }

    const { error: createError } = await supabase.rpc("create_itemized_expense_with_rate", {
      p_trip_id: input.tripId,
      p_amount: input.amount,
      p_currency: input.currency,
      p_exchange_rate: exchangeRate,
      p_description: input.description,
      p_payee: input.payee,
      p_date: input.date,
      p_category_id: input.categoryId,
      p_payers: input.payers.map((payer) => ({
        user_id: payer.userId,
        amount: payer.amount,
        payment_method: payer.paymentMethod,
        payment_label: payer.paymentLabel,
      })),
      p_items: input.items.map((item) => ({
        description: item.description,
        amount: item.amount,
        shares: item.shares.map((share) => ({
          user_id: share.userId,
          share_type: share.shareType,
          share_value: share.shareValue,
          owed_amount: share.owedAmount,
        })),
      })),
      p_adjustments: input.adjustments.map((adjustment) => ({
        type: adjustment.type,
        mode: adjustment.mode,
        amount: adjustment.amount,
        shares: adjustment.shares.map((share) => ({
          user_id: share.userId,
          owed_amount: share.owedAmount,
        })),
      })),
    });

    if (createError) {
      setSubmitting(false);
      setError(createError.message);
      return false;
    }
    setSubmitting(false);

    invalidateRecentEntries(input.tripId);
    invalidateBalances(input.tripId);
    navigate(`/trips/${input.tripId}`, { replace: true });
    return true;
  }

  async function replaceExpense(
    entryId: string,
    input: ItemizedExpenseInput,
  ) {
    setSubmitting(true);
    setError(null);
    let exchangeRate: number;
    try {
      exchangeRate = await resolveRate(input);
    } catch (rateError) {
      setSubmitting(false);
      setError(rateError instanceof Error ? rateError.message : "Unable to load exchange rate");
      return false;
    }

    const { error: replaceError } = await supabase.rpc("replace_expense_with_rate", {
      p_entry_id: entryId,
      p_trip_id: input.tripId,
      p_amount: input.amount,
      p_currency: input.currency,
      p_exchange_rate: exchangeRate,
      p_description: input.description,
      p_payee: input.payee,
      p_date: input.date,
      p_category_id: input.categoryId,
      p_payers: input.payers.map((payer) => ({
        user_id: payer.userId,
        amount: payer.amount,
        payment_method: payer.paymentMethod,
        payment_label: payer.paymentLabel,
      })),
      p_items: input.items.map((item) => ({
        description: item.description,
        amount: item.amount,
        shares: item.shares.map((share) => ({
          user_id: share.userId,
          share_type: share.shareType,
          share_value: share.shareValue,
          owed_amount: share.owedAmount,
        })),
      })),
      p_adjustments: input.adjustments.map((adjustment) => ({
        type: adjustment.type,
        mode: adjustment.mode,
        amount: adjustment.amount,
        shares: adjustment.shares.map((share) => ({
          user_id: share.userId,
          owed_amount: share.owedAmount,
        })),
      })),
    });

    if (replaceError) {
      setSubmitting(false);
      setError(replaceError.message);
      return false;
    }
    setSubmitting(false);

    invalidateExpense(entryId);
    invalidateRecentEntries(input.tripId);
    invalidateBalances(input.tripId);
    sessionStorage.setItem(
      "bonado:pending-toast",
      "Transaction changes have been saved.",
    );
    navigate(-1);
    return true;
  }

  return {
    createExpense,
    createItemizedExpense,
    replaceExpense,
    submitting,
    error,
  };
}
