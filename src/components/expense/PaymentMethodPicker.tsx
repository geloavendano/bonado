export type PaymentMethod = "" | "Cash" | "Card" | "Bank" | "Other";

function MethodIcon({ method }: { method: PaymentMethod }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (method === "Card") {
    return (
      <svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden="true" {...common}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 9h18M7 15h4" />
      </svg>
    );
  }
  if (method === "Bank") {
    return (
      <svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden="true" {...common}>
        <path d="M3 9h18L12 4 3 9ZM5 10v7M9 10v7M15 10v7M19 10v7M3 20h18" />
      </svg>
    );
  }
  if (method === "Cash") {
    return (
      <svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden="true" {...common}>
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <circle cx="12" cy="12" r="2.5" />
        <path d="M7 9H6v1M17 15h1v-1" />
      </svg>
    );
  }
  if (method === "Other") {
    return (
      <svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden="true" {...common}>
        <circle cx="6" cy="12" r="1" fill="currentColor" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
        <circle cx="18" cy="12" r="1" fill="currentColor" />
      </svg>
    );
  }
  return null;
}

export function PaymentMethodPicker({
  value,
  label,
  onChange,
  onLabelChange,
}: {
  value: PaymentMethod;
  label: string;
  onChange: (value: PaymentMethod) => void;
  onLabelChange: (value: string) => void;
}) {
  const collapsed = value !== "";

  return (
    <div className="relative flex h-10 min-w-0 flex-1 items-center overflow-hidden rounded-xl bg-tile text-secondary">
      {collapsed ? (
        <>
          <div className="relative flex h-full w-[54px] flex-none items-center justify-center">
            <MethodIcon method={value} />
            <svg
              viewBox="0 0 20 20"
              aria-hidden="true"
              className="pointer-events-none absolute right-1 size-4"
              fill="currentColor"
            >
              <path d="m5.5 7.5 4.5 5 4.5-5H5.5Z" />
            </svg>
            <select
              value={value}
              onChange={(event) => onChange(event.target.value as PaymentMethod)}
              aria-label="Payment method"
              className="absolute inset-0 cursor-pointer appearance-none opacity-0"
            >
              <option value="">No payment method</option>
              <option value="Cash">Cash</option>
              <option value="Card">Card</option>
              <option value="Bank">Bank</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="h-6 w-px flex-none bg-black/10" />
          <input
            value={label}
            onChange={(event) => onLabelChange(event.target.value)}
            placeholder={
              value === "Card"
                ? "Card"
                : value === "Bank"
                  ? "Bank"
                  : value === "Cash"
                    ? "Cash label"
                    : "Label"
            }
            aria-label={`${value} name`}
            className="min-w-0 flex-1 bg-transparent px-3 py-2 text-[12.5px] font-semibold outline-none placeholder:text-faint"
          />
        </>
      ) : (
        <>
          <span className="truncate px-3 pr-9 text-[12px] font-semibold">
            Payment method (optional)
          </span>
          <svg
            viewBox="0 0 20 20"
            aria-hidden="true"
            className="pointer-events-none absolute right-2.5 size-4"
            fill="currentColor"
          >
            <path d="m5.5 7.5 4.5 5 4.5-5H5.5Z" />
          </svg>
          <select
            value={value}
            onChange={(event) => onChange(event.target.value as PaymentMethod)}
            aria-label="Payment method"
            className="absolute inset-0 cursor-pointer appearance-none opacity-0"
          >
            <option value="">No payment method</option>
            <option value="Cash">Cash</option>
            <option value="Card">Card</option>
            <option value="Bank">Bank</option>
            <option value="Other">Other</option>
          </select>
        </>
      )}
    </div>
  );
}
