import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Input } from "@/components/ui/Input";
import { usePlacesAutocomplete } from "@/hooks/usePlacesAutocomplete";
import { isPlacesConfigured, type PlaceDetails } from "@/lib/googlePlaces";

interface LocationFieldProps {
  /** Pre-fills the field once (e.g. a trip's existing location_name when editing). */
  initialValue?: string;
  resolved: boolean;
  onResolve: (details: PlaceDetails) => void;
  onManualChange: (text: string) => void;
}

export function LocationField({
  initialValue = "",
  resolved,
  onResolve,
  onManualChange,
}: LocationFieldProps) {
  const places = usePlacesAutocomplete();
  const [focused, setFocused] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current && initialValue) {
      places.setInput(initialValue);
      initializedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValue]);

  async function handleSelect(placeId: string) {
    const details = await places.selectPlace(placeId);
    if (!details) return;
    places.setInput(details.name);
    setFocused(false);
    onResolve(details);
  }

  return (
    <div className="relative">
      <Input
        value={places.input}
        onChange={(e) => {
          places.setInput(e.target.value);
          onManualChange(e.target.value);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder="City, country"
        enterKeyHint="done"
        className={clsx(resolved && "border-2 border-teal")}
      />
      {resolved && (
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-teal">
          ✓
        </span>
      )}
      {focused && places.suggestions.length > 0 && (
        <div className="absolute z-10 mt-1.5 w-full overflow-hidden rounded-[16px] bg-card shadow-[var(--shadow-floating)]">
          {places.suggestions.map((suggestion) => (
            <button
              key={suggestion.placeId}
              onClick={() => void handleSelect(suggestion.placeId)}
              className="flex w-full flex-col items-start gap-0.5 px-4 py-2.5 text-left hover:bg-track"
            >
              <span className="text-[14px] font-semibold">{suggestion.mainText}</span>
              {suggestion.secondaryText && (
                <span className="text-[12px] text-secondary">{suggestion.secondaryText}</span>
              )}
            </button>
          ))}
        </div>
      )}
      {!isPlacesConfigured && (
        <p className="mt-1.5 text-[11px] text-faint">
          Location search isn’t configured — you can still type a location manually.
        </p>
      )}
    </div>
  );
}
