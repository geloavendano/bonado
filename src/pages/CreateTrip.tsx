import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { PageShell } from "@/components/layout/PageShell";
import { StickyActionBar } from "@/components/layout/StickyActionBar";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Button } from "@/components/ui/Button";
import { ALL_CURRENCIES, SUGGESTED_CURRENCIES } from "@/lib/currencies";
import { useCreateTrip } from "@/hooks/useCreateTrip";
import { useCoverPhotoUpload } from "@/hooks/useCoverPhotoUpload";
import { useCoverPhotoSuggestions } from "@/hooks/useCoverPhotoSuggestions";
import { useMobileFormFlow } from "@/hooks/useMobileFormFlow";
import { ChevronDown } from "@/components/ui/ChevronDown";
import { isUnsplashConfigured, trackDownload } from "@/lib/unsplash";
import { LocationField } from "@/components/trip/LocationField";
import { getCurrencyForCountry } from "@/lib/countryCurrency";
import { Input } from "@/components/ui/Input";

const MORE_CURRENCIES = ALL_CURRENCIES.filter(
  (currency) => !SUGGESTED_CURRENCIES.some((c) => c.code === currency.code),
);

export function CreateTrip() {
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [locationName, setLocationName] = useState("");
  const [locationPlaceId, setLocationPlaceId] = useState<string | null>(null);
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [unsplashQuery, setUnsplashQuery] = useState("");
  const [coverPhotoUrl, setCoverPhotoUrl] = useState<string | null>(null);
  const [coverPhotoAttribution, setCoverPhotoAttribution] = useState<string | null>(null);
  const [ownCoverUploaded, setOwnCoverUploaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const formFlow = useMobileFormFlow(formRef);

  const { createTrip, submitting, error } = useCreateTrip();
  const { upload, uploading, error: uploadError } = useCoverPhotoUpload();
  const { photos, loading: photosLoading, shuffle } = useCoverPhotoSuggestions(unsplashQuery);

  const canSubmit = name.trim().length > 0 && !submitting;
  const isMoreCurrency = !SUGGESTED_CURRENCIES.some((c) => c.code === currency);

  useEffect(() => {
    if (photos.length > 0 && !ownCoverUploaded) {
      setCoverPhotoUrl(photos[0].url);
      setCoverPhotoAttribution(photos[0].attribution);
      trackDownload(photos[0].downloadLocation);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await upload(file);
    if (url) {
      setCoverPhotoUrl(url);
      setCoverPhotoAttribution(null);
      setOwnCoverUploaded(true);
    }
  }

  function selectSuggestedPhoto(photo: (typeof photos)[number]) {
    setCoverPhotoUrl(photo.url);
    setCoverPhotoAttribution(photo.attribution);
    setOwnCoverUploaded(false);
    trackDownload(photo.downloadLocation);
  }

  const alternates = photos.filter((photo) => photo.url !== coverPhotoUrl).slice(0, 3);

  return (
    <PageShell>
      <ScreenHeader title="New trip" />

      <div ref={formRef} {...formFlow.formProps} className="flex flex-col gap-3.5 pt-2.5 pb-24">
        <SectionLabel>Trip name</SectionLabel>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Lisbon 2026"
          autoFocus
          enterKeyHint="next"
        />

        <SectionLabel>Where to?</SectionLabel>
        <LocationField
          resolved={Boolean(locationPlaceId)}
          onManualChange={(text) => {
            setLocationName(text);
            setLocationPlaceId(null);
            setLocationLat(null);
            setLocationLng(null);
          }}
          onResolve={(details) => {
            setLocationName(details.name);
            setLocationPlaceId(details.placeId);
            setLocationLat(details.lat);
            setLocationLng(details.lng);
            setUnsplashQuery(details.name);
            const localCurrency = details.countryCode
              ? getCurrencyForCountry(details.countryCode)
              : null;
            if (localCurrency) setCurrency(localCurrency);
          }}
        />

        <SectionLabel>Trip currency</SectionLabel>
        <div className="flex gap-2 flex-wrap">
          {SUGGESTED_CURRENCIES.map((c) => (
            <button
              key={c.code}
              onClick={() => setCurrency(c.code)}
              className={clsx(
                "rounded-pill px-4 py-2 text-[13.5px] font-bold transition-colors",
                currency === c.code
                  ? "bg-teal-tint text-teal-dark border-2 border-teal"
                  : "bg-card text-secondary shadow-[var(--shadow-card)] border-2 border-transparent",
              )}
            >
              {c.code} {c.symbol}
            </button>
          ))}
          <div className="relative">
            <select
              value={isMoreCurrency ? currency : ""}
              onChange={(e) => setCurrency(e.target.value)}
              className={clsx(
                "appearance-none rounded-pill pl-4 pr-7 py-2 text-[13.5px] w-[92px] text-center outline-none transition-colors",
                isMoreCurrency
                  ? "bg-teal-tint text-teal-dark font-bold border-2 border-teal"
                  : "bg-card text-secondary font-semibold shadow-[var(--shadow-card)] border-2 border-transparent",
              )}
            >
              <option value="" disabled>
                More…
              </option>
              {MORE_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code}
                </option>
              ))}
            </select>
            <ChevronDown
              className={clsx(
                "pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2",
                isMoreCurrency ? "text-teal-dark" : "text-secondary",
              )}
            />
          </div>
        </div>

        <SectionLabel>Cover photo</SectionLabel>
        {coverPhotoUrl ? (
          <img
            src={coverPhotoUrl}
            alt="Trip cover"
            className="h-[140px] w-full object-cover rounded-[18px]"
          />
        ) : (
          <div className="cover-placeholder h-[140px] rounded-[18px] flex items-center justify-center text-faint text-[11px] font-mono text-center px-2">
            {photosLoading
              ? "searching for photos…"
              : isUnsplashConfigured
                ? unsplashQuery
                  ? "no photos found"
                  : "pick a location to see suggestions"
                : "suggested photo — coming soon"}
          </div>
        )}
        <div className="flex items-center gap-2">
          {alternates.map((photo) => (
            <button
              key={photo.id}
              onClick={() => selectSuggestedPhoto(photo)}
              className="h-12 w-[68px] flex-none overflow-hidden rounded-xl bg-tile"
            >
              <img src={photo.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-[68px] h-12 flex-none rounded-xl bg-card border-[1.5px] border-dashed border-faint-2 flex items-center justify-center text-[11.5px] font-bold text-secondary disabled:opacity-50"
          >
            {uploading ? "…" : "⬆ Own"}
          </button>
          {photos.length > 0 && (
            <button
              onClick={shuffle}
              aria-label="Shuffle photo suggestions"
              className="ml-auto flex-none text-[18px] text-secondary"
            >
              ↻
            </button>
          )}
        </div>
        {coverPhotoAttribution && (
          <p className="text-[10.5px] text-faint">{coverPhotoAttribution}</p>
        )}
        {uploadError && <p className="text-owe text-[13px]">{uploadError}</p>}

        {error && <p className="text-owe text-[13px]">{error}</p>}
      </div>

      <StickyActionBar bottomOffset={formFlow.keyboardOffset}>
        <Button
          fullWidth
          disabled={!formFlow.keyboardOpen && !canSubmit}
          onPointerDown={(event) => formFlow.keyboardOpen && event.preventDefault()}
          onClick={() => {
            if (formFlow.keyboardOpen) return formFlow.advance();
            void createTrip({
              name: name.trim(),
              locationName: locationName.trim(),
              locationPlaceId,
              locationLat,
              locationLng,
              defaultCurrency: currency,
              coverPhotoUrl,
              coverPhotoAttribution,
            });
          }}
        >
          {formFlow.keyboardOpen ? "Next →" : submitting ? "Creating…" : "Create trip"}
        </Button>
      </StickyActionBar>
    </PageShell>
  );
}
