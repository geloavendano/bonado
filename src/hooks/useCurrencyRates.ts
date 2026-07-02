import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

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

export async function fetchExchangeRate(base: string, target: string) {
  if (base === target) return 1;
  const cached = readCache(base);
  if (cached?.rates[target]) return Number(cached.rates[target]);
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: databaseRate } = await supabase
    .from("exchange_rate_cache")
    .select("rate")
    .eq("base_currency", base)
    .eq("target_currency", target)
    .gte("fetched_at", cutoff)
    .maybeSingle();
  if (databaseRate?.rate) return Number(databaseRate.rate);
  const response = await fetch(
    `https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(base)}&symbols=${encodeURIComponent(target)}`,
  );
  if (!response.ok) throw new Error(`No conversion rate is available for ${base} → ${target}.`);
  const result = (await response.json()) as FrankfurterResponse;
  const rate = Number(result.rates[target]);
  if (!rate) throw new Error(`No conversion rate is available for ${base} → ${target}.`);
  void supabase.rpc("cache_exchange_rate", {
    p_base_currency: base,
    p_target_currency: target,
    p_rate: rate,
  });
  return rate;
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
