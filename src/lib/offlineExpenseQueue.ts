import { supabase } from "@/lib/supabase";
import { invalidateRecentEntries } from "@/hooks/useRecentEntries";
import { invalidateBalances } from "@/lib/balanceData";

const KEY = "bonado:offline-expense-queue";

export interface QueuedExpense {
  id: string;
  authUserId: string;
  tripId: string;
  createdAt: string;
  payload: Record<string, unknown>;
}

export function readExpenseQueue(): QueuedExpense[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as QueuedExpense[];
  } catch {
    return [];
  }
}

function writeExpenseQueue(queue: QueuedExpense[]) {
  localStorage.setItem(KEY, JSON.stringify(queue));
  window.dispatchEvent(new Event("bonado:offline-queue-change"));
}

export async function queueExpense(
  tripId: string,
  payload: Record<string, unknown>,
) {
  const { data } = await supabase.auth.getSession();
  const authUserId = data.session?.user.id;
  if (!authUserId) throw new Error("Sign in before saving an offline expense.");
  writeExpenseQueue([
    ...readExpenseQueue(),
    {
      id: crypto.randomUUID(),
      authUserId,
      tripId,
      createdAt: new Date().toISOString(),
      payload,
    },
  ]);
}

export async function flushExpenseQueue() {
  if (!navigator.onLine) return { synced: 0, remaining: readExpenseQueue().length };
  const { data } = await supabase.auth.getSession();
  const authUserId = data.session?.user.id;
  if (!authUserId) return { synced: 0, remaining: readExpenseQueue().length };

  const queue = readExpenseQueue();
  const remaining: QueuedExpense[] = [];
  let synced = 0;
  for (const item of queue) {
    if (item.authUserId !== authUserId) {
      remaining.push(item);
      continue;
    }
    // Older queue items predate p_entry_id in the payload; the queue item id
    // is already a UUID, so reuse it as the idempotency key for those.
    const { error } = await supabase.rpc("create_expense_idempotent", {
      p_entry_id: item.id,
      ...item.payload,
    });
    if (error) {
      remaining.push(item);
      if (!navigator.onLine) {
        remaining.push(...queue.slice(queue.indexOf(item) + 1));
        break;
      }
      continue;
    }
    synced += 1;
    invalidateRecentEntries(item.tripId);
    invalidateBalances(item.tripId);
  }
  writeExpenseQueue(remaining);
  return { synced, remaining: remaining.length };
}

