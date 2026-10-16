import { buildSettlementSuggestions, type SuggestedSettlement } from "@/lib/moneyMath";

export interface CurrencyBalance {
  user_id: string;
  currency_balances: Record<string, number>;
}

/** Positive quantities which this payment can clear in each original currency. */
export function pairBalances(rows: CurrencyBalance[], from: string, to: string) {
  const debtor = rows.find((row) => row.user_id === from)?.currency_balances ?? {};
  const creditor = rows.find((row) => row.user_id === to)?.currency_balances ?? {};
  return Object.fromEntries(Object.entries(debtor)
    .map(([currency, amount]) => [currency, Math.min(-amount, creditor[currency] ?? 0)] as const)
    .filter(([, amount]) => amount > 0));
}

/** Convert a native basket once, rounding only the final payment. Missing FX blocks the quote. */
export function totalInCurrency(amounts: Record<string, number>, target: string, base: string, rates: Record<string, number>) {
  let total = 0;
  for (const [currency, amount] of Object.entries(amounts)) {
    if (currency === target) { total += amount; continue; }
    const sourceRate = currency === base ? 1 : rates[currency];
    const targetRate = target === base ? 1 : rates[target];
    if (!(sourceRate > 0) || !(targetRate > 0)) return null;
    total += amount * targetRate / sourceRate;
  }
  return Math.round((total + Number.EPSILON) * 100) / 100;
}

/** RPC snapshot: currency -> trip default (the rates hook exposes the inverse). */
export function settlementRates(rates: Record<string, number>, base: string) {
  const result = Object.fromEntries(Object.entries(rates).filter(([, rate]) => rate > 0 && Number.isFinite(rate)).map(([code, rate]) => [code, 1 / rate]));
  result[base] = 1;
  return result;
}

/** Simplify independently per currency, so FX never erases native debts. */
export function buildCurrencySuggestions(rows: CurrencyBalance[], base: string, rates: Record<string, number>): SuggestedSettlement[] {
  const currencies = [...new Set(rows.flatMap((row) => Object.keys(row.currency_balances)))].sort();
  const grouped = new Map<string, { fromUserId: string; toUserId: string; amounts: Record<string, number> }>();
  for (const currency of currencies) {
    for (const suggestion of buildSettlementSuggestions(rows.map((row) => ({ user_id: row.user_id, balance: row.currency_balances[currency] ?? 0 })))) {
      const key = `${suggestion.fromUserId}:${suggestion.toUserId}`;
      const previous = grouped.get(key) ?? { ...suggestion, amounts: {} };
      previous.amounts[currency] = suggestion.amount;
      grouped.set(key, previous);
    }
  }
  return [...grouped.values()].flatMap(({ fromUserId, toUserId, amounts }) => {
    const amount = totalInCurrency(amounts, base, base, rates);
    return amount === null ? [] : [{ fromUserId, toUserId, amount }];
  });
}
