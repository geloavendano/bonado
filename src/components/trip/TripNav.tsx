import { Link, useLocation, useNavigate } from "react-router-dom";
import clsx from "clsx";
import { runTripPaneTransition } from "@/lib/tripPaneTransition";

const TABS = [
  { key: "entries", label: "Entries", icon: "▤", path: "" },
  { key: "balances", label: "Balances", icon: "⇄", path: "/balances" },
  { key: "reports", label: "Reports", icon: "◔", path: "/reports" },
] as const;

export function TripNav({ tripId }: { tripId: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const base = `/trips/${tripId}`;
  const activeIndex = Math.max(
    0,
    TABS.findIndex((tab) => location.pathname === `${base}${tab.path}`),
  );

  return (
    <div className="trip-bottom-nav motion-dock fixed inset-x-0 bottom-0 z-10 pointer-events-none">
      <div
        className="mx-auto flex w-full max-w-[430px] items-center gap-3 px-6"
        style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
      >
        <nav
          className="relative grid min-w-0 flex-1 grid-cols-3 items-stretch rounded-[28px] border border-white/15 bg-card/75 p-2 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.35),var(--shadow-floating)] backdrop-blur-xl backdrop-saturate-150 pointer-events-auto"
          aria-label="Trip sections"
        >
          <span
            aria-hidden="true"
            className="absolute inset-y-2 left-2 rounded-[20px] bg-teal-tint transition-transform duration-300 ease-out"
            style={{
              width: "calc((100% - 16px) / 3)",
              transform: `translateX(${activeIndex * 100}%)`,
            }}
          />
          {TABS.map((tab) => {
            const href = `${base}${tab.path}`;
            const active = location.pathname === href;
            const classes = clsx(
              "relative z-[1] flex min-w-0 min-h-11 flex-col items-center justify-center gap-0.5 rounded-[20px] px-1.5 py-2.5 text-[10.5px] leading-none",
              active ? "text-teal-dark font-extrabold" : "text-secondary font-semibold",
            );
            const content = (
              <>
                <span className="text-[19px] leading-none">{tab.icon}</span>
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
                replace
                onClick={(event) => {
                  event.preventDefault();
                  const direction =
                    TABS.findIndex((item) => item.key === tab.key) > activeIndex
                      ? "left"
                      : "right";
                  runTripPaneTransition(direction, (usingViewTransition) => {
                    navigate(href, {
                      replace: true,
                      state: {
                        transition: usingViewTransition
                          ? "tab-view"
                          : direction === "left"
                            ? "tab-left"
                            : "tab-right",
                      },
                    });
                  });
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
          className="grid size-12 flex-none place-items-center rounded-full bg-teal text-white shadow-[var(--shadow-fab)] pointer-events-auto"
          aria-label="Add expense"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-6"
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
