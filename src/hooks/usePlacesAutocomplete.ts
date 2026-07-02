import { useEffect, useRef, useState } from "react";
import {
  autocompletePlaces,
  getPlaceDetails,
  newSessionToken,
  type PlaceDetails,
  type PlaceSuggestion,
} from "@/lib/googlePlaces";

export function usePlacesAutocomplete() {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionTokenRef = useRef(newSessionToken());

  useEffect(() => {
    if (input.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      autocompletePlaces(input, sessionTokenRef.current)
        .then((results) => {
          if (!cancelled) {
            setSuggestions(results);
            setError(null);
          }
        })
        .catch((searchError: unknown) => {
          if (!cancelled) {
            setError(searchError instanceof Error ? searchError.message : "Search failed.");
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [input]);

  async function selectPlace(placeId: string): Promise<PlaceDetails | null> {
    const details = await getPlaceDetails(placeId, sessionTokenRef.current);
    // Session tokens are single-use per Google's billing model — mint a
    // fresh one for the next search.
    sessionTokenRef.current = newSessionToken();
    setSuggestions([]);
    return details;
  }

  return { input, setInput, suggestions, loading, error, selectPlace };
}
