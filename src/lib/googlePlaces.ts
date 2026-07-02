// Places API (New) via plain REST calls — avoids loading the full Maps
// JavaScript SDK for what's just an autocomplete input + one details fetch.
// https://developers.google.com/maps/documentation/places/web-service/place-autocomplete

const API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY as string | undefined;

export const isPlacesConfigured = Boolean(API_KEY);

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
  if (!API_KEY || input.trim().length < 2) return [];

  const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": API_KEY,
    },
    body: JSON.stringify({
      input,
      sessionToken,
      includedPrimaryTypes: ["locality", "administrative_area_level_3", "country"],
    }),
  });

  if (!response.ok) {
    throw new Error("Location search is temporarily unavailable.");
  }

  const data = (await response.json()) as AutocompleteResponse;
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
  if (!API_KEY) return null;

  const response = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?sessionToken=${encodeURIComponent(sessionToken)}`,
    {
      headers: {
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": "id,displayName,location,addressComponents",
      },
    },
  );

  if (!response.ok) return null;

  const data = (await response.json()) as PlaceDetailsResponse;
  if (!data.location) return null;

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
