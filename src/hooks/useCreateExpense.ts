import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { invalidateExpense } from "@/hooks/useExpense";
import { invalidateRecentEntries } from "@/hooks/useRecentEntries";
import { invalidateBalances } from "@/lib/balanceData";
import { fetchExchangeRate } from "@/hooks/useCurrencyRates";
import { allocateEqualShares } from "@/lib/moneyMath";
import { queueExpense } from "@/lib/offlineExpenseQueue";

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
  // One id per form attempt, kept across failed retries so a create whose
  // response was lost after the server committed dedups instead of
  // duplicating; cleared only once the expense is saved or queued.
  const pendingEntryId = useRef<string | null>(null);

  function claimEntryId() {
    pendingEntryId.current ??= crypto.randomUUID();
    return pendingEntryId.current;
  }

  async function submitCreate(
    tripId: string,
    tripDefaultCurrency: string,
    payload: Record<string, unknown>,
  ) {
    async function saveLocally() {
      await queueExpense(tripId, payload, { tripDefaultCurrency });
      pendingEntryId.current = null;
      setSubmitting(false);
      invalidateRecentEntries(tripId);
      navigate(`/trips/${tripId}`, {
        replace: true,
        state: { toast: "Expense saved locally. It will sync in the background." },
      });
      return true;
    }
    try {
      return await saveLocally();
    } catch (queueError) {
      setSubmitting(false);
      setError(
        queueError instanceof Error
          ? queueError.message
          : "Unable to save expense locally.",
      );
      return false;
    }
  }

  async function createExpense(input: SimpleExpenseInput) {
    setSubmitting(true);
    setError(null);

    const equalShares = allocateEqualShares(input.amount, input.participantIds)
      .map((share) => ({
        user_id: share.userId,
        share_type: "equal",
        share_value: null,
        owed_amount: share.amount,
      }));

    const payload = {
      p_entry_id: claimEntryId(),
      p_trip_id: input.tripId,
      p_amount: input.amount,
      p_currency: input.currency,
      p_exchange_rate:
        input.currency === input.tripDefaultCurrency ? 1 : null,
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
    };
    return submitCreate(input.tripId, input.tripDefaultCurrency, payload);
  }

  async function createItemizedExpense(input: ItemizedExpenseInput) {
    setSubmitting(true);
    setError(null);

    const payload = {
      p_entry_id: claimEntryId(),
      p_trip_id: input.tripId,
      p_amount: input.amount,
      p_currency: input.currency,
      p_exchange_rate:
        input.currency === input.tripDefaultCurrency ? 1 : null,
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
    };
    return submitCreate(input.tripId, input.tripDefaultCurrency, payload);
  }

  async function replaceExpense(
    entryId: string,
    input: ItemizedExpenseInput,
  ) {
    setSubmitting(true);
    setError(null);
    let exchangeRate: number;
    try {
      exchangeRate = await fetchExchangeRate(input.currency, input.tripDefaultCurrency);
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
