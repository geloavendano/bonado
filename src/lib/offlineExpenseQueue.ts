import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { supabase } from "@/lib/supabase";
import { invalidateBalances } from "@/lib/balanceData";

const KEY = "bonado:offline-expense-queue";

export interface QueuedExpense {
  id: string;
  authUserId: string;
  tripId: string;
  tripDefaultCurrency: string;
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
  options: { tripDefaultCurrency?: string } = {},
) {
  const { data } = await supabase.auth.getSession();
  const authUserId = data.session?.user.id;
  if (!authUserId) throw new Error("Sign in before saving an offline expense.");
  const queue = await loadExpenseQueue();
  const entryId = typeof payload.p_entry_id === "string"
    ? payload.p_entry_id
    : crypto.randomUUID();
  const nextItem: QueuedExpense = {
    id: entryId,
    authUserId,
    tripId,
    tripDefaultCurrency: options.tripDefaultCurrency ?? "",
    createdAt: new Date().toISOString(),
    payload: { ...payload, p_entry_id: entryId },
  };
  await writeStore([
    ...queue.filter((item) => item.id !== entryId),
    nextItem,
  ]);
}

export async function removeQueuedExpense(entryId: string): Promise<void> {
  const queue = await loadExpenseQueue();
  await writeStore(queue.filter((item) => item.id !== entryId));
}

async function resolveQueuedExchangeRate(item: QueuedExpense) {
  const payload = item.payload;
  const currentRate = Number(payload.p_exchange_rate);
  if (Number.isFinite(currentRate) && currentRate > 0) return currentRate;

  const base = String(payload.p_currency ?? "");
  let target = item.tripDefaultCurrency;
  if (!target) {
    const { data } = await supabase
      .from("trips")
      .select("default_currency")
      .eq("id", item.tripId)
      .maybeSingle();
    target = data?.default_currency ?? "";
  }
  if (!base || !target) throw new Error("Currency information is missing.");
  if (base === target) return 1;

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: cachedRate } = await supabase
    .from("exchange_rate_cache")
    .select("rate")
    .eq("base_currency", base)
    .eq("target_currency", target)
    .gte("fetched_at", cutoff)
    .maybeSingle();
  if (cachedRate?.rate) return Number(cachedRate.rate);

  const response = await fetch(
    `https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(base)}&symbols=${encodeURIComponent(target)}`,
  );
  if (!response.ok) throw new Error(`No conversion rate is available for ${base} → ${target}.`);
  const result = (await response.json()) as { rates?: Record<string, number> };
  const rate = Number(result.rates?.[target]);
  if (!rate) throw new Error(`No conversion rate is available for ${base} → ${target}.`);
  void supabase.rpc("cache_exchange_rate", {
    p_base_currency: base,
    p_target_currency: target,
    p_rate: rate,
  });
  return rate;
}

export async function flushExpenseQueue() {
  const queue = await loadExpenseQueue();
  if (!navigator.onLine) return { synced: 0, remaining: queue.length };
  const { data } = await supabase.auth.getSession();
  const authUserId = data.session?.user.id;
  if (!authUserId) return { synced: 0, remaining: queue.length };

  const remaining: QueuedExpense[] = [];
  let synced = 0;
  for (let index = 0; index < queue.length; index += 1) {
    const item = queue[index];
    if (item.authUserId !== authUserId) {
      remaining.push(item);
      continue;
    }
    try {
      const exchangeRate = await resolveQueuedExchangeRate(item);
      // Older queue items predate p_entry_id in the payload; the queue item id
      // is already a UUID, so reuse it as the idempotency key for those.
      const { error } = await supabase.rpc("create_expense_idempotent", {
        ...item.payload,
        p_entry_id: item.id,
        p_exchange_rate: exchangeRate,
      });
      if (error) {
        remaining.push(item);
        continue;
      }
    } catch {
      remaining.push(item);
      if (!navigator.onLine) {
        remaining.push(...queue.slice(index + 1));
        break;
      }
      continue;
    }
    synced += 1;
    invalidateBalances(item.tripId);
  }
  await writeStore(remaining);
  return { synced, remaining: remaining.length };
}
