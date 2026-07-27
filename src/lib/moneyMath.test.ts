import { describe, expect, it } from "vitest";
import {
  allocateEqualShares,
  buildSettlementSuggestions,
  entryShareForUser,
  roundMoney,
  sumDayShares,
  type DaySummableItem,
} from "@/lib/moneyMath";
import { convertEntryAmount } from "@/lib/convertEntryAmount";

function expense({
  shares = [] as { user_id: string; owed_amount: number }[],
  adjustments = [] as { user_id: string; owed_amount: number }[],
  currency = "USD",
  rate = 1,
  estimated = false,
}) {
  return {
    type: "expense" as const,
    currency,
    exchange_rate_to_trip_default: rate,
    rate_is_estimated: estimated,
    line_items: [{ line_item_shares: shares }],
    adjustments: adjustments.length
      ? [{ adjustment_shares: adjustments }]
      : [],
  };
}

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

describe("per-day share totals", () => {
  it("counts a user's line-item shares plus their cut of tax and tip", () => {
    const entry = expense({
      shares: [
        { user_id: "me", owed_amount: 20 },
        { user_id: "you", owed_amount: 30 },
      ],
      adjustments: [
        { user_id: "me", owed_amount: 2.5 },
        { user_id: "you", owed_amount: 3.75 },
      ],
    });
    expect(entryShareForUser(entry, "me")).toBe(22.5);
    expect(entryShareForUser(entry, "nobody")).toBe(0);
    expect(entryShareForUser(entry, undefined)).toBe(0);
  });

  it("totals a single-currency day exactly", () => {
    const items: DaySummableItem[] = [
      expense({ shares: [{ user_id: "me", owed_amount: 12.34 }] }),
      expense({ shares: [{ user_id: "me", owed_amount: 7.66 }] }),
    ];
    expect(sumDayShares(items, "me", "USD", "USD", {})).toEqual({
      amount: 20,
      currency: "USD",
      approximate: false,
    });
  });

  it("converts a mixed-currency day to the trip default and flags it approximate", () => {
    // "Original" display mode: rows show THB and USD, which cannot be summed.
    const items: DaySummableItem[] = [
      expense({ shares: [{ user_id: "me", owed_amount: 300 }], currency: "THB", rate: 0.03 }),
      expense({ shares: [{ user_id: "me", owed_amount: 40 }], currency: "USD" }),
    ];
    expect(sumDayShares(items, "me", "", "USD", {})).toEqual({
      amount: 49,
      currency: "USD",
      approximate: true,
    });
  });

  it("flags approximate when a contributing entry has an estimated rate", () => {
    const items: DaySummableItem[] = [
      expense({ shares: [{ user_id: "me", owed_amount: 10 }], estimated: true }),
    ];
    expect(sumDayShares(items, "me", "USD", "USD", {})?.approximate).toBe(true);
  });

  it("returns null for a settlement-only day rather than a misleading zero", () => {
    const items: DaySummableItem[] = [{ type: "settlement" }, { type: "settlement" }];
    expect(sumDayShares(items, "me", "USD", "USD", {})).toBeNull();
  });

  it("ignores settlements when expenses are present", () => {
    const items: DaySummableItem[] = [
      expense({ shares: [{ user_id: "me", owed_amount: 25 }] }),
      { type: "settlement" },
    ];
    expect(sumDayShares(items, "me", "USD", "USD", {})?.amount).toBe(25);
  });

  it("still reports zero when expenses exist but the user is in none", () => {
    const items: DaySummableItem[] = [
      expense({ shares: [{ user_id: "someone-else", owed_amount: 40 }] }),
    ];
    expect(sumDayShares(items, "me", "USD", "USD", {})).toEqual({
      amount: 0,
      currency: "USD",
      approximate: false,
    });
  });

  it("returns null instead of mixing currencies when the display rate is missing", () => {
    const items: DaySummableItem[] = [
      expense({ shares: [{ user_id: "me", owed_amount: 10 }], currency: "USD" }),
    ];
    expect(sumDayShares(items, "me", "EUR", "USD", {})).toBeNull();
  });

  it("converts into a selected display currency", () => {
    const items: DaySummableItem[] = [
      expense({ shares: [{ user_id: "me", owed_amount: 10 }], currency: "USD" }),
      expense({ shares: [{ user_id: "me", owed_amount: 10 }], currency: "USD" }),
    ];
    expect(sumDayShares(items, "me", "EUR", "USD", { EUR: 0.5 })).toEqual({
      amount: 10,
      currency: "EUR",
      approximate: true,
    });
  });
});

