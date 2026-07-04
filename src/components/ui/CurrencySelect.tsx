import { ChevronDown } from "@/components/ui/ChevronDown";

export interface PinnedCurrencyOption {
  /** Currency code, or "" for a per-row "Original" default. */
  value: string;
  label: string;
}

interface CurrencySelectProps {
  value: string;
  onChange: (value: string) => void;
  currencies: string[];
  disabled?: boolean;
  /**
   * Options pinned above the full list (e.g. Original / Trip default /
   * Preferred), separated from it by a divider row.
   */
  pinned?: PinnedCurrencyOption[];
  "aria-label"?: string;
}

// Pinned duplicates of codes in the main list get a sentinel value so the
// collapsed control keeps showing the short code (the plain option below is
// the one React marks selected), while the dropdown still offers the
// labelled shortcut on top.
const PINNED_PREFIX = "__pinned:";

export function CurrencySelect({
  value,
  onChange,
  currencies,
  disabled,
  pinned,
  "aria-label": ariaLabel = "Display currency",
}: CurrencySelectProps) {
  const pinnedOptions = (pinned ?? []).filter(
    (option, index, all) =>
      all.findIndex((other) => other.value === option.value) === index,
  );
  return (
    <div className="relative">
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => {
          const next = event.target.value;
          onChange(
            next.startsWith(PINNED_PREFIX)
              ? next.slice(PINNED_PREFIX.length)
              : next,
          );
        }}
        className="appearance-none rounded-pill bg-card py-2 pl-3 pr-8 text-[13px] font-extrabold text-teal-dark shadow-[var(--shadow-card)] outline-none disabled:opacity-50"
        aria-label={ariaLabel}
      >
        {pinnedOptions.map((option) => {
          const duplicated = currencies.includes(option.value);
          return (
            <option
              key={`pinned-${option.value}`}
              value={duplicated ? `${PINNED_PREFIX}${option.value}` : option.value}
            >
              {option.label}
            </option>
          );
        })}
        {pinnedOptions.length > 0 && (
          <option value="__separator" disabled>
            ──────────
          </option>
        )}
        {currencies.map((currency) => (
          <option key={currency} value={currency}>
            {currency}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-secondary" />
    </div>
  );
}
