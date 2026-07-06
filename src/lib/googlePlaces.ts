// Places API (New) via the `places` edge-function proxy. The API key is
// HTTP-referrer restricted and Google's allowlists can't include the
// capacitor:// scheme the native app runs on, so calls go through Supabase —
// which also keeps the key out of the client bundle entirely.

import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export const isPlacesConfigured = isSupabaseConfigured;

export interface PlaceSuggestion {
  placeId: string;
  mainText: string;
  secondaryText: string;
}

export interface PlaceDetails {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  /** ISO 3166-1 alpha-2 country code, when resolvable. */
  countryCode: string | null;
}

interface AutocompleteResponse {
  suggestions?: {
    placePrediction?: {
      placeId: string;
      structuredFormat?: {
        mainText?: { text: string };
        secondaryText?: { text: string };
      };
      text?: { text: string };
    };
  }[];
}

interface PlaceDetailsResponse {
  id: string;
  displayName?: { text: string };
  location?: { latitude: number; longitude: number };
  addressComponents?: { shortText: string; types: string[] }[];
}

export async function autocompletePlaces(
  input: string,
  sessionToken: string,
): Promise<PlaceSuggestion[]> {
  if (input.trim().length < 2) return [];

  const { data, error } = await supabase.functions.invoke<AutocompleteResponse>(
    "places",
    {
      body: {
        action: "autocomplete",
        input,
        sessionToken,
        includedPrimaryTypes: ["locality", "administrative_area_level_3", "country"],
      },
    },
  );
  if (error || !data) {
    throw new Error("Location search is temporarily unavailable.");
  }

  return (data.suggestions ?? []).flatMap((suggestion) => {
    const prediction = suggestion.placePrediction;
    if (!prediction) return [];
    return [
      {
        placeId: prediction.placeId,
        mainText: prediction.structuredFormat?.mainText?.text ?? prediction.text?.text ?? "",
        secondaryText: prediction.structuredFormat?.secondaryText?.text ?? "",
      },
    ];
  });
}

export async function getPlaceDetails(
  placeId: string,
  sessionToken: string,
): Promise<PlaceDetails | null> {
  const { data, error } = await supabase.functions.invoke<PlaceDetailsResponse>(
    "places",
    { body: { action: "details", placeId, sessionToken } },
  );
  if (error || !data?.location) return null;

  const countryComponent = data.addressComponents?.find((component) =>
    component.types.includes("country"),
  );

  return {
    placeId: data.id,
    name: data.displayName?.text ?? "",
    lat: data.location.latitude,
    lng: data.location.longitude,
    countryCode: countryComponent?.shortText ?? null,
  };
}

export function newSessionToken(): string {
  return crypto.randomUUID();
}
