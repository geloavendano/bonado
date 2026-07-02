import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { fetchExchangeRate } from "@/hooks/useCurrencyRates";
import { invalidateBalances } from "@/lib/balanceData";

interface UpdateTripInput {
  name: string;
  locationName: string;
  locationPlaceId: string | null;
  locationLat: number | null;
  locationLng: number | null;
  defaultCurrency: string;
  previousCurrency: string;
  coverPhotoUrl: string | null;
}

export function useUpdateTrip() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function updateTrip(tripId: string, input: UpdateTripInput) {
    setSaving(true);
    setError(null);

    let rates: Record<string, number> = {};
    if (input.defaultCurrency !== input.previousCurrency) {
      const { data: entries, error: entriesError } = await supabase
        .from("entries")
        .select("currency")
        .eq("trip_id", tripId)
        .eq("status", "active");
      if (entriesError) {
        setSaving(false);
        setError(entriesError.message);
        return false;
      }
      const currencies = [
        ...new Set([
          ...(entries ?? []).map((entry) => entry.currency as string),
          input.previousCurrency,
        ]),
      ];
      try {
        rates = Object.fromEntries(
          await Promise.all(
            currencies.map(async (currency) => [
              currency,
              await fetchExchangeRate(currency, input.defaultCurrency),
            ]),
          ),
        );
      } catch (rateError) {
        setSaving(false);
        setError(rateError instanceof Error ? rateError.message : "Unable to convert trip currency");
        return false;
      }
    }

    const { error: updateError } = await supabase.rpc("update_trip_settings", {
      p_trip_id: tripId,
      p_name: input.name,
      p_location_name: input.locationName,
      p_location_place_id: input.locationPlaceId,
      p_location_lat: input.locationLat,
      p_location_lng: input.locationLng,
      p_default_currency: input.defaultCurrency,
      p_cover_photo_url: input.coverPhotoUrl ?? "",
      p_rates: rates,
    });

    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return false;
    }
    invalidateBalances(tripId);
    return true;
  }

  return { updateTrip, saving, error };
}
