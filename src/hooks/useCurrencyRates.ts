import { useEffect, useState } from "react";

interface FrankfurterResponse {
  date: string;
  base: string;
  rates: Record<string, number>;
}

interface CachedRates extends FrankfurterResponse {
  cachedAt: string;
}

function cacheKey(base: string) {
  return `bonado:rates:${base}`;
}

function readCache(base: string) {
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey(base)) ?? "null") as CachedRates | null;
    if (!cached) return null;
    const age = Date.now() - new Date(cached.cachedAt).getTime();
    return age < 24 * 60 * 60 * 1000 ? cached : null;
  } catch {
    return null;
  }
}

export function useCurrencyRates(baseCurrency: string) {
  const cached = readCache(baseCurrency);
  const [rates, setRates] = useState<Record<string, number>>(cached?.rates ?? {});
  const [rateDate, setRateDate] = useState(cached?.date ?? "");
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const current = readCache(baseCurrency);
    if (current) {
      setRates(current.rates);
      setRateDate(current.date);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch(`https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(baseCurrency)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Exchange rates are temporarily unavailable.");
        return response.json() as Promise<FrankfurterResponse>;
      })
      .then((result) => {
        if (cancelled) return;
        const nextRates = { ...result.rates, [baseCurrency]: 1 };
        setRates(nextRates);
        setRateDate(result.date);
        localStorage.setItem(
          cacheKey(baseCurrency),
          JSON.stringify({ ...result, rates: nextRates, cachedAt: new Date().toISOString() }),
        );
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load rates.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [baseCurrency]);

  return {
    rates,
    rateDate,
    loading,
    error,
    currencies: [baseCurrency, ...Object.keys(rates).filter((code) => code !== baseCurrency)].sort(),
  };
}
