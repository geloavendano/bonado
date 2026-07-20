import { useEffect, useMemo, useState } from "react";

function storageKey(tripId: string, scope: string) {
  return `bonado:trip-display-currency:${tripId}:${scope}`;
}

export function useTripDisplayCurrency({
  tripId,
  defaultCurrency,
  scope,
  allowOriginal = false,
}: {
  tripId: string;
  defaultCurrency: string;
  scope: string;
  allowOriginal?: boolean;
}) {
  const key = useMemo(() => storageKey(tripId, scope), [scope, tripId]);
  const [currency, setCurrencyState] = useState(() => {
    const saved = sessionStorage.getItem(key);
    if (saved === "" && allowOriginal) return "";
    return saved || defaultCurrency;
  });

  useEffect(() => {
    const saved = sessionStorage.getItem(key);
    if (saved === "" && allowOriginal) {
      setCurrencyState("");
      return;
    }
    setCurrencyState(saved || defaultCurrency);
  }, [allowOriginal, defaultCurrency, key]);

  function setCurrency(nextCurrency: string) {
    const normalized = nextCurrency || "";
    if (!normalized && !allowOriginal) {
      sessionStorage.setItem(key, defaultCurrency);
      setCurrencyState(defaultCurrency);
      return;
    }
    sessionStorage.setItem(key, normalized);
    setCurrencyState(normalized);
  }

  return [currency, setCurrency] as const;
}
