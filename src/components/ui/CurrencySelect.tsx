import { ChevronDown } from "@/components/ui/ChevronDown";

interface CurrencySelectProps {
  value: string;
  onChange: (value: string) => void;
  currencies: string[];
  disabled?: boolean;
  /** Adds an "Original" option (empty value) for screens with a per-row native-currency default. */
  allowOriginal?: boolean;
  "aria-label"?: string;
}

export function CurrencySelect({
  value,
  onChange,
  currencies,
  disabled,
  allowOriginal,
  "aria-label": ariaLabel = "Display currency",
}: CurrencySelectProps) {
  return (
    <div className="relative">
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="appearance-none rounded-pill bg-card py-2 pl-3 pr-8 text-[13px] font-extrabold text-teal-dark shadow-[var(--shadow-card)] outline-none disabled:opacity-50"
        aria-label={ariaLabel}
      >
        {allowOriginal && <option value="">Original</option>}
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
