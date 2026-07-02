export interface Currency {
  code: string;
  symbol: string;
  name: string;
}

/** Shown as quick-pick chips before the "More" list. */
export const SUGGESTED_CURRENCIES: Currency[] = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
];

/**
 * Every currency selectable anywhere in the app (trip default, expense
 * currency, settlement currency, preferred display currency). Limited to
 * what Frankfurter (our exchange-rate source) actually has rates for --
 * picking anything else breaks conversion/rebase later with a silent 404.
 * https://api.frankfurter.dev/v1/currencies
 */
export const ALL_CURRENCIES: Currency[] = [
  ...SUGGESTED_CURRENCIES,
  { code: "JPY", symbol: "¥", name: "Japanese Yen" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
  { code: "CHF", symbol: "Fr", name: "Swiss Franc" },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar" },
  { code: "HKD", symbol: "HK$", name: "Hong Kong Dollar" },
  { code: "NZD", symbol: "NZ$", name: "New Zealand Dollar" },
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "MXN", symbol: "MX$", name: "Mexican Peso" },
  { code: "PHP", symbol: "₱", name: "Philippine Peso" },
  { code: "THB", symbol: "฿", name: "Thai Baht" },
  { code: "IDR", symbol: "Rp", name: "Indonesian Rupiah" },
  { code: "KRW", symbol: "₩", name: "South Korean Won" },
  { code: "ZAR", symbol: "R", name: "South African Rand" },
  { code: "BRL", symbol: "R$", name: "Brazilian Real" },
  { code: "CZK", symbol: "Kč", name: "Czech Koruna" },
  { code: "DKK", symbol: "kr", name: "Danish Krone" },
  { code: "HUF", symbol: "Ft", name: "Hungarian Forint" },
  { code: "ILS", symbol: "₪", name: "Israeli New Shekel" },
  { code: "ISK", symbol: "ISK", name: "Icelandic Króna" },
  { code: "MYR", symbol: "RM", name: "Malaysian Ringgit" },
  { code: "NOK", symbol: "kr", name: "Norwegian Krone" },
  { code: "PLN", symbol: "zł", name: "Polish Złoty" },
  { code: "RON", symbol: "RON", name: "Romanian Leu" },
  { code: "SEK", symbol: "kr", name: "Swedish Krona" },
  { code: "TRY", symbol: "₺", name: "Turkish Lira" },
];

export function currencySymbol(code: string): string {
  return ALL_CURRENCIES.find((c) => c.code === code)?.symbol ?? code;
}
