export function roundMoney(amount: number) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
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

