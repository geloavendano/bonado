import { useMemo, useState } from "react";
import clsx from "clsx";
import { PageShell } from "@/components/layout/PageShell";
import { useTripLayout } from "@/components/trip/useTripLayout";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Skeleton } from "@/components/ui/Skeleton";
import { useTripReports } from "@/hooks/useTripReports";
import { formatMoney } from "@/lib/money";

const CHART_COLORS = ["#159580", "#82c9bd", "#f1aa72", "#d5848a", "#8fa9d1", "#a69bc6"];

function DonutChart({
  rows,
  total,
  currency,
}: {
  rows: { name: string; amount: number }[];
  total: number;
  currency: string;
}) {
  let offset = 0;
  const segments = rows.map((row, index) => {
    const percent = total > 0 ? (row.amount / total) * 100 : 0;
    const segment = { ...row, percent, offset, color: CHART_COLORS[index % CHART_COLORS.length] };
    offset += percent;
    return segment;
  });

  return (
    <div className="relative mx-auto size-[190px]" role="img" aria-label="Spending by category chart">
      <svg viewBox="0 0 42 42" className="size-full -rotate-90">
        <circle cx="21" cy="21" r="15.9155" fill="none" stroke="#efefed" strokeWidth="7" />
        {segments.map((segment) => (
          <circle
            key={segment.name}
            cx="21"
            cy="21"
            r="15.9155"
            fill="none"
            stroke={segment.color}
            strokeWidth="7"
            strokeDasharray={`${segment.percent} ${100 - segment.percent}`}
            strokeDashoffset={-segment.offset}
          />
        ))}
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-secondary">
          Total spent
        </div>
        <div className="mt-1 text-[20px] font-extrabold tracking-[-0.4px]">
          {formatMoney(total, currency)}
        </div>
      </div>
    </div>
  );
}

export function TripReports() {
  const trip = useTripLayout();
  const { report, loading, error } = useTripReports(trip.id);
  const [view, setView] = useState<"categories" | "accounts">("categories");
  const memberNames = useMemo(
    () => Object.fromEntries(trip.members.map((member) => [member.id, member.name])),
    [trip.members],
  );
  const hasActivity = report.totalSpend > 0 || report.accounts.length > 0;

  return (
    <PageShell>
      <div className="pb-2 pt-4 text-center text-[16px] font-bold">Reports</div>

      <div className="flex flex-col gap-3.5 pb-24 pt-2.5">
        <div className="grid grid-cols-2 rounded-pill bg-track p-1">
          {(["categories", "accounts"] as const).map((option) => (
            <button
              key={option}
              onClick={() => setView(option)}
              className={clsx(
                "rounded-pill px-3 py-2 text-[12.5px] font-bold capitalize transition-colors",
                view === option ? "bg-card text-teal-dark shadow-card" : "text-secondary",
              )}
            >
              {option === "categories" ? "By category" : "By account"}
            </button>
          ))}
        </div>

        {loading ? (
          <>
            <Skeleton className="mx-auto size-[190px] rounded-full" />
            <Skeleton className="h-[176px] w-full rounded-[18px]" />
          </>
        ) : !hasActivity ? (
          <div className="rounded-[18px] bg-card p-6 text-center text-[13.5px] text-secondary shadow-card">
            Reports will appear once the trip has expenses or settlements.
          </div>
        ) : view === "categories" ? (
          <>
            <div className="rounded-[22px] bg-card py-5 shadow-card">
              <DonutChart
                rows={report.categories}
                total={report.totalSpend}
                currency={trip.default_currency}
              />
            </div>
            {report.hasEstimatedRates && (
              <div className="rounded-[14px] bg-track px-3 py-2.5 text-[11.5px] text-secondary">
                Includes estimated foreign-currency amounts.
              </div>
            )}
            <SectionLabel>Spending breakdown</SectionLabel>
            <div className="overflow-hidden rounded-[18px] bg-card px-4 shadow-card">
              {report.categories.map((category, index) => (
                <div
                  key={category.name}
                  className={clsx(
                    "flex items-center gap-3 py-3",
                    index < report.categories.length - 1 && "border-b border-black/5",
                  )}
                >
                  <span className="grid size-9 place-items-center rounded-full bg-track text-[16px]">
                    {category.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-bold">{category.name}</div>
                    <div className="text-[11px] text-secondary">
                      {report.totalSpend > 0
                        ? `${Math.round((category.amount / report.totalSpend) * 100)}% of spending`
                        : "0% of spending"}
                    </div>
                  </div>
                  <div className="text-[13px] font-extrabold">
                    {formatMoney(category.amount, trip.default_currency)}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="rounded-[16px] bg-teal-tint px-4 py-3">
              <div className="text-[11px] font-bold uppercase tracking-[0.07em] text-teal-dark/65">
                Account activity
              </div>
              <div className="mt-1 text-[13px] font-semibold text-teal-dark">
                Expense payments and transfers, grouped by payment account.
              </div>
            </div>
            <div className="flex flex-col gap-2.5">
              {report.accounts.map((account) => {
                const outgoing = account.expenseOut + account.transferOut;
                return (
                  <div key={account.key} className="rounded-[18px] bg-card p-4 shadow-card">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-extrabold">{account.label}</div>
                        <div className="mt-0.5 text-[11px] text-secondary">
                          {memberNames[account.ownerId] ?? "Member"} · {account.method}
                        </div>
                      </div>
                      <div className={clsx("text-right text-[14px] font-extrabold", account.transferIn > outgoing ? "text-owed" : "text-ink")}>
                        {account.transferIn > 0
                          ? `+${formatMoney(account.transferIn, trip.default_currency)}`
                          : formatMoney(outgoing, trip.default_currency)}
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 border-t border-black/5 pt-3">
                      {[
                        ["Expenses", account.expenseOut],
                        ["Sent", account.transferOut],
                        ["Received", account.transferIn],
                      ].map(([label, amount]) => (
                        <div key={String(label)}>
                          <div className="text-[10px] font-semibold text-secondary">{label}</div>
                          <div className="mt-0.5 truncate text-[11.5px] font-bold">
                            {formatMoney(Number(amount), trip.default_currency)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
        {error && <p className="text-[12.5px] text-owe">{error}</p>}
      </div>
    </PageShell>
  );
}
