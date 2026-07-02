import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export interface PayerAllocation {
  userId: string;
  amount: number;
}

interface SimpleExpenseInput {
  tripId: string;
  amount: number;
  description: string;
  payee: string;
  date: string;
  categoryId: string | null;
  payers: PayerAllocation[];
  participantIds: string[];
}

export function useCreateExpense() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createExpense(input: SimpleExpenseInput) {
    setSubmitting(true);
    setError(null);

    const { error: createError } = await supabase.rpc("create_simple_expense", {
      p_trip_id: input.tripId,
      p_amount: input.amount,
      p_description: input.description,
      p_payee: input.payee,
      p_date: input.date,
      p_category_id: input.categoryId,
      p_payers: input.payers.map((payer) => ({
        user_id: payer.userId,
        amount: payer.amount,
      })),
      p_participant_ids: input.participantIds,
    });

    setSubmitting(false);
    if (createError) {
      setError(createError.message);
      return false;
    }

    navigate(`/trips/${input.tripId}`, { replace: true });
    return true;
  }

  return { createExpense, submitting, error };
}
