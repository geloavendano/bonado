import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
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

// In the native shell the queue lives in Capacitor Preferences (app-scoped
// storage the OS won't evict with WebView site data); the web keeps
// localStorage. An in-memory mirror keeps count reads synchronous.
let cache: QueuedExpense[] | null = null;

async function readStore(): Promise<QueuedExpense[]> {
  try {
    const raw = Capacitor.isNativePlatform()
      ? (await Preferences.get({ key: KEY })).value
      : localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as QueuedExpense[]) : [];
  } catch {
    return [];
  }
}

async function writeStore(queue: QueuedExpense[]): Promise<void> {
  cache = queue;
  const raw = JSON.stringify(queue);
  if (Capacitor.isNativePlatform()) {
    await Preferences.set({ key: KEY, value: raw });
  } else {
    localStorage.setItem(KEY, raw);
  }
  window.dispatchEvent(new Event("bonado:offline-queue-change"));
}

export async function loadExpenseQueue(): Promise<QueuedExpense[]> {
  cache ??= await readStore();
  return cache;
}

/** Synchronous count from the in-memory mirror (0 until first load). */
export function queuedExpenseCount(): number {
  return cache?.length ?? 0;
}

export async function queueExpense(
  tripId: string,
  payload: Record<string, unknown>,
) {
  const { data } = await supabase.auth.getSession();
  const authUserId = data.session?.user.id;
  if (!authUserId) throw new Error("Sign in before saving an offline expense.");
  const queue = await loadExpenseQueue();
  await writeStore([
    ...queue,
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
  const queue = await loadExpenseQueue();
  if (!navigator.onLine) return { synced: 0, remaining: queue.length };
  const { data } = await supabase.auth.getSession();
  const authUserId = data.session?.user.id;
  if (!authUserId) return { synced: 0, remaining: queue.length };

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
  await writeStore(remaining);
  return { synced, remaining: remaining.length };
}
