import { convertEntryAmount } from "@/lib/convertEntryAmount";

export function roundMoney(amount: number) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

interface OwedShare {
  user_id: string;
  owed_amount: number;
}

export interface ShareBearingEntry {
  type: "expense";
  currency: string;
  exchange_rate_to_trip_default: number;
  rate_is_estimated?: boolean;
  line_items: { line_item_shares: OwedShare[] }[];
  adjustments: { adjustment_shares: OwedShare[] }[];
}

export type DaySummableItem = ShareBearingEntry | { type: "settlement" };

/**
 * What `userId` personally owes on one expense: their line-item shares plus
 * their cut of any tax/tip adjustments. This is the figure each history row
 * shows as its primary amount, so the per-day header total must call this too
 * — if the two ever diverge, the header silently stops matching the column
 * beneath it.
 */
export function entryShareForUser(
  entry: ShareBearingEntry,
  userId: string | undefined,
): number {
  if (!userId) return 0;
  const sumShares = (shares: OwedShare[]) =>
    shares.reduce(
      (total, share) =>
        share.user_id === userId ? total + Number(share.owed_amount) : total,
      0,
    );
  return (
    entry.line_items.reduce(
      (total, item) => total + sumShares(item.line_item_shares),
      0,
    ) +
    entry.adjustments.reduce(
      (total, adjustment) => total + sumShares(adjustment.adjustment_shares),
      0,
    )
  );
}

export interface DayShareTotal {
  amount: number;
  currency: string;
  /** Any contributing entry was rate-converted or carries an estimated rate. */
  approximate: boolean;
}

/**
 * Totals one date group's expense shares for `userId`.
 *
 * Settlements are excluded: they move money between members without anything
 * being spent, so counting them would distort what the day cost.
 *
 * In "Original" display mode (`displayCurrency` empty) rows render in their own
 * currencies, which cannot be summed — so the total falls back to the trip
 * default, reached through each entry's stored snapshot rate, and is flagged
 * `approximate`.
 *
 * Returns null when there is nothing honest to show: no expenses in the group,
 * or the target currency's live rate has not loaded yet (summing part-converted
 * amounts would mix currencies silently).
 */
export function sumDayShares(
  items: readonly DaySummableItem[],
  userId: string | undefined,
  displayCurrency: string,
  tripDefaultCurrency: string,
  ratesFromTripDefault: Record<string, number>,
): DayShareTotal | null {
  const target = displayCurrency || tripDefaultCurrency;
  const expenses = items.filter(
    (item): item is ShareBearingEntry => item.type === "expense",
  );
  if (expenses.length === 0) return null;

  let total = 0;
  let approximate = !displayCurrency;

  for (const entry of expenses) {
    const share = entryShareForUser(entry, userId);
    const converted = convertEntryAmount(
      share,
      entry.currency,
      entry.exchange_rate_to_trip_default,
      target,
      tripDefaultCurrency,
      ratesFromTripDefault,
    );
    // A mismatch means the target rate is missing; summing on would silently
    // add up two different currencies.
    if (converted.currency !== target) return null;
    if (converted.converted || entry.rate_is_estimated) approximate = true;
    total += converted.amount;
  }

  return { amount: roundMoney(total), currency: target, approximate };
}

export function allocateEqualShares(amount: number, userIds: string[]) {
  if (userIds.length === 0) return [];
  const totalCents = Math.round(amount * 100);
  const baseCents = Math.floor(totalCents / userIds.length);
  const remainder = totalCents - baseCents * userIds.length;
  return userIds.map((userId, index) => ({
    userId,
    amount: (baseCents + (index < remainder ? 1 : 0)) / 100,
  }));
}

export interface SuggestedSettlement {
  fromUserId: string;
  toUserId: string;
  amount: number;
}

export function buildSettlementSuggestions(
  balances: { user_id: string; balance: number }[],
): SuggestedSettlement[] {
  const debtors = balances
    .filter((row) => row.balance < -0.005)
    .map((row) => ({ id: row.user_id, cents: Math.round(-row.balance * 100) }))
    .sort((a, b) => b.cents - a.cents);
  const creditors = balances
    .filter((row) => row.balance > 0.005)
    .map((row) => ({ id: row.user_id, cents: Math.round(row.balance * 100) }))
    .sort((a, b) => b.cents - a.cents);
  const suggestions: SuggestedSettlement[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const cents = Math.min(debtor.cents, creditor.cents);
    if (cents > 0) {
      suggestions.push({
        fromUserId: debtor.id,
        toUserId: creditor.id,
        amount: cents / 100,
      });
    }
    debtor.cents -= cents;
    creditor.cents -= cents;
    if (debtor.cents === 0) debtorIndex += 1;
    if (creditor.cents === 0) creditorIndex += 1;
  }
  return suggestions;
}

