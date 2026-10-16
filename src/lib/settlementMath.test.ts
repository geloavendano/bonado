import { describe, expect, it } from "vitest";
import { buildCurrencySuggestions, pairBalances, settlementRates, totalInCurrency } from "./settlementMath";

const rows = [
  { user_id: "A", currency_balances: { PHP: 100, JPY: 10000 } },
  { user_id: "B", currency_balances: { PHP: -100, JPY: -10000 } },
];

describe("native-currency settlements", () => {
  it("quotes the remaining PHP 100 + JPY 10000 in either payment currency", () => {
    const basket = pairBalances(rows, "B", "A");
    expect(basket).toEqual({ PHP: 100, JPY: 10000 });
    expect(totalInCurrency(basket, "JPY", "JPY", { PHP: 0.4 })).toBe(10250);
    expect(totalInCurrency(basket, "PHP", "JPY", { PHP: 0.4 })).toBe(4100);
    expect(pairBalances(rows, "A", "B")).toEqual({});
  });
  it("never substitutes a made-up FX rate when a quote is unavailable", () => {
    expect(totalInCurrency({ PHP: 100 }, "JPY", "JPY", {})).toBeNull();
    expect(totalInCurrency({ PHP: 100 }, "PHP", "JPY", {})).toBe(100);
    expect(settlementRates({ PHP: 0.4, USD: 0, EUR: NaN }, "JPY")).toEqual({ PHP: 2.5, JPY: 1 });
  });
  it("rounds the total once, rather than each original-currency component", () => {
    const tiny = [
      { user_id: "A", currency_balances: { PHP: 0.01, USD: 0.01 } },
      { user_id: "B", currency_balances: { PHP: -0.01, USD: -0.01 } },
    ];
    expect(buildCurrencySuggestions(tiny, "JPY", { PHP: 2.5, USD: 2.5 })).toEqual([{ fromUserId: "B", toUserId: "A", amount: 0.01 }]);
  });
  it("does not hide offsetting native balances behind a zero converted total", () => {
    const mixed = [
      { user_id: "A", currency_balances: { PHP: 100, JPY: -250 } },
      { user_id: "B", currency_balances: { PHP: -100, JPY: 250 } },
    ];
    expect(buildCurrencySuggestions(mixed, "JPY", { PHP: 0.4 })).toEqual([
      { fromUserId: "A", toUserId: "B", amount: 250 },
      { fromUserId: "B", toUserId: "A", amount: 250 },
    ]);
  });
});
