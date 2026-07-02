/**
 * Converts an amount stored in an entry's own currency into a chosen display
 * currency, going through the trip's default currency using the entry's own
 * snapshot rate (stable, captured at creation) and then a live rate from
 * trip-default to the display currency (via useCurrencyRates).
 *
 * Returns the original amount/currency unconverted when displayCurrency is
 * empty ("Original" mode) or already matches the entry's own currency.
 */
export function convertEntryAmount(
  amount: number,
  entryCurrency: string,
  exchangeRateToTripDefault: number,
  displayCurrency: string,
  tripDefaultCurrency: string,
  ratesFromTripDefault: Record<string, number>,
): { amount: number; currency: string; converted: boolean } {
  if (!displayCurrency || displayCurrency === entryCurrency) {
    return { amount, currency: entryCurrency, converted: false };
  }
  const tripDefaultAmount = amount * (exchangeRateToTripDefault || 1);
  const displayRate =
    displayCurrency === tripDefaultCurrency ? 1 : ratesFromTripDefault[displayCurrency];
  if (!displayRate) {
    return { amount, currency: entryCurrency, converted: false };
  }
  return { amount: tripDefaultAmount * displayRate, currency: displayCurrency, converted: true };
}
