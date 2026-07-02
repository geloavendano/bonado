import { useRef, useState } from "react";
import clsx from "clsx";
import { PageShell } from "@/components/layout/PageShell";
import { StickyActionBar } from "@/components/layout/StickyActionBar";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { Input } from "@/components/ui/Input";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Button } from "@/components/ui/Button";
import { SUGGESTED_CURRENCIES } from "@/lib/currencies";
import { useCreateTrip } from "@/hooks/useCreateTrip";
import { useCoverPhotoUpload } from "@/hooks/useCoverPhotoUpload";
import { useMobileFormFlow } from "@/hooks/useMobileFormFlow";
import { ChevronDown } from "@/components/ui/ChevronDown";

export function CreateTrip() {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [coverPhotoUrl, setCoverPhotoUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const formFlow = useMobileFormFlow(formRef);

  const { createTrip, submitting, error } = useCreateTrip();
  const { upload, uploading, error: uploadError } = useCoverPhotoUpload();

  const canSubmit = name.trim().length > 0 && !submitting;
  const isMoreCurrency = !SUGGESTED_CURRENCIES.some((c) => c.code === currency);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await upload(file);
    if (url) setCoverPhotoUrl(url);
  }

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
        <Input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="City, country"
          enterKeyHint="done"
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
                  : "bg-card text-secondary shadow-card border-2 border-transparent",
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
                  : "bg-card text-secondary font-semibold shadow-card border-2 border-transparent",
              )}
            >
              <option value="" disabled>
                More…
              </option>
              {["JPY", "AUD", "CAD", "CHF", "CNY", "SGD", "HKD", "NZD", "INR", "MXN", "PHP", "THB", "IDR", "KRW", "ZAR", "BRL"].map(
                (code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ),
              )}
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
            suggested photo — coming soon
          </div>
        )}
        <div className="flex items-center gap-2">
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
            className="w-[68px] h-12 rounded-xl bg-card border-[1.5px] border-dashed border-faint-2 flex items-center justify-center text-[11.5px] font-bold text-secondary disabled:opacity-50"
          >
            {uploading ? "…" : "⬆ Own"}
          </button>
        </div>
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
              locationName: location.trim(),
              defaultCurrency: currency,
              coverPhotoUrl,
            });
          }}
        >
          {formFlow.keyboardOpen ? "Next →" : submitting ? "Creating…" : "Create trip"}
        </Button>
      </StickyActionBar>
    </PageShell>
  );
}
