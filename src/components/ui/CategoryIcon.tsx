import clsx from "clsx";

const PATHS: Record<string, React.ReactNode> = {
  "Food & drink": (
    <>
      <path d="M7 3v8M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 11v10M15 3v18M15 3c3 1 4.5 3.5 4.5 7H15" />
    </>
  ),
  Transport: (
    <>
      <path d="M5 17h14l-1-7a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2l-1 7ZM7 8l1.5-3h7L17 8M3 14h18" />
      <circle cx="7" cy="18" r="1.5" />
      <circle cx="17" cy="18" r="1.5" />
    </>
  ),
  Lodging: (
    <>
      <path d="M3 20V9M21 20V12a3 3 0 0 0-3-3H9v8M3 14h18M6 9h3v5H6a3 3 0 0 1-3-3 2 2 0 0 1 2-2h1Z" />
    </>
  ),
  Groceries: (
    <>
      <path d="M3 4h2l2.2 10h10.5l2-7H6M9 18h.01M17 18h.01" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="17" cy="18" r="1.5" />
    </>
  ),
  Shopping: (
    <>
      <path d="M6 8h12l-1 12H7L6 8ZM9 8a3 3 0 0 1 6 0" />
    </>
  ),
  Activities: (
    <>
      <path d="M4 7h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4V7ZM12 7v2M12 12v2M12 17v2" />
    </>
  ),
  Other: (
    <>
      <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
};

export function CategoryIcon({
  category,
  className,
}: {
  category: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={clsx("size-[18px]", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[category] ?? PATHS.Other}
    </svg>
  );
}
