import { Link, useLocation } from "react-router-dom";
import clsx from "clsx";

const TABS = [
  { key: "entries", label: "Entries", icon: "▤", path: "" },
  { key: "balances", label: "Balances", icon: "⇄", path: "/balances" },
  { key: "reports", label: "Reports", icon: "◔", path: "/reports" },
] as const;

export function TripNav({ tripId }: { tripId: string }) {
  const location = useLocation();
  const base = `/trips/${tripId}`;
  const activeIndex = Math.max(
    0,
    TABS.findIndex((tab) => location.pathname === `${base}${tab.path}`),
  );

  return (
    <div className="motion-dock fixed inset-x-0 bottom-0 z-10 pointer-events-none">
      <div
        className="mx-auto flex w-full max-w-[430px] items-center gap-3 px-6"
        style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
      >
        <nav
          className="relative grid min-w-0 flex-1 grid-cols-3 items-center rounded-pill bg-card p-[5px] shadow-[var(--shadow-floating)] pointer-events-auto"
          aria-label="Trip sections"
        >
          <span
            aria-hidden="true"
            className="absolute inset-y-[5px] left-[5px] rounded-pill bg-teal-tint transition-transform duration-300 ease-out"
            style={{
              width: "calc((100% - 10px) / 3)",
              transform: `translateX(${activeIndex * 100}%)`,
            }}
          />
          {TABS.map((tab) => {
            const href = `${base}${tab.path}`;
            const active = location.pathname === href;
            const classes = clsx(
              "relative z-[1] flex min-w-0 items-center justify-center gap-1 rounded-pill px-1.5 py-2 text-[12px] leading-none",
              active ? "text-teal-dark font-extrabold" : "text-secondary font-semibold",
            );
            const content = (
              <>
                <span className="text-sm leading-none">{tab.icon}</span>
                {tab.label}
              </>
            );
            return active ? (
              <button
                key={tab.key}
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className={classes}
                aria-current="page"
              >
                {content}
              </button>
            ) : (
              <Link
                key={tab.key}
                to={href}
                replace={activeIndex !== 0}
                state={{
                  transition: TABS.findIndex((item) => item.key === tab.key) > activeIndex
                    ? "tab-left"
                    : "tab-right",
                }}
                className={classes}
              >
                {content}
              </Link>
            );
          })}
        </nav>
        <Link
          to={`${base}/expenses/new`}
          state={{ transition: "sheet" }}
          className="grid size-10 flex-none place-items-center rounded-full bg-teal text-white shadow-[var(--shadow-fab)] pointer-events-auto"
          aria-label="Add expense"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
