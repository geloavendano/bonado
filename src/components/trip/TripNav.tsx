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

  return (
    <div className="fixed inset-x-0 bottom-0 z-10 pointer-events-none">
      <div
        className="mx-auto max-w-[430px] px-6 flex items-center justify-between"
        style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center bg-card rounded-pill p-[5px] shadow-floating pointer-events-auto">
          {TABS.map((tab) => {
            const href = `${base}${tab.path}`;
            const active = location.pathname === href;
            return (
              <Link
                key={tab.key}
                to={href}
                className={clsx(
                  "flex items-center gap-1.5 rounded-pill px-3 py-2 text-[12.5px] leading-none",
                  active ? "bg-teal-tint text-teal-dark font-extrabold" : "text-secondary font-semibold",
                )}
              >
                <span className="text-sm leading-none">{tab.icon}</span>
                {tab.label}
              </Link>
            );
          })}
        </div>
        <Link
          to={`${base}/expenses/new`}
          className="w-[46px] h-[46px] rounded-full bg-teal text-white flex items-center justify-center shadow-fab flex-none pointer-events-auto"
          aria-label="Add expense"
        >
          <span className="text-2xl font-bold leading-none translate-y-[-1px]">+</span>
        </Link>
      </div>
    </div>
  );
}
