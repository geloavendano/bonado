import { describe, expect, it } from "vitest";
import {
  allocateEqualShares,
  buildSettlementSuggestions,
  roundMoney,
} from "@/lib/moneyMath";
import { convertEntryAmount } from "@/lib/convertEntryAmount";

describe("money math", () => {
  it("allocates every cent exactly across equal shares", () => {
    const shares = allocateEqualShares(10, ["a", "b", "c"]);
    expect(shares).toEqual([
      { userId: "a", amount: 3.34 },
      { userId: "b", amount: 3.33 },
      { userId: "c", amount: 3.33 },
    ]);
    expect(roundMoney(shares.reduce((sum, share) => sum + share.amount, 0))).toBe(10);
  });

  it("handles zero participants without invalid numbers", () => {
    expect(allocateEqualShares(12.34, [])).toEqual([]);
  });

  it("converts through the saved trip-default snapshot", () => {
    expect(convertEntryAmount(100, "USD", 55, "EUR", "PHP", { EUR: 0.016 }))
      .toEqual({ amount: 88, currency: "EUR", converted: true });
  });

  it("falls back to original currency when a display rate is unavailable", () => {
    expect(convertEntryAmount(100, "USD", 55, "EUR", "PHP", {}))
      .toEqual({ amount: 100, currency: "USD", converted: false });
  });

  it("settles multiple debtors and creditors without losing cents", () => {
    const suggestions = buildSettlementSuggestions([
      { user_id: "a", balance: -7.01 },
      { user_id: "b", balance: -2.99 },
      { user_id: "c", balance: 6.5 },
      { user_id: "d", balance: 3.5 },
    ]);
    expect(suggestions).toEqual([
      { fromUserId: "a", toUserId: "c", amount: 6.5 },
      { fromUserId: "a", toUserId: "d", amount: 0.51 },
      { fromUserId: "b", toUserId: "d", amount: 2.99 },
    ]);
  });
});

