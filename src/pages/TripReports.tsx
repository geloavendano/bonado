import { useState } from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { PageShell } from "@/components/layout/PageShell";
import { useTripLayout } from "@/components/trip/useTripLayout";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Skeleton } from "@/components/ui/Skeleton";
import { useTripReports } from "@/hooks/useTripReports";
import { useAuth } from "@/context/AuthContext";
import { formatMoney } from "@/lib/money";
import { TripTabHeader } from "@/components/trip/TripTabHeader";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { ChevronDown } from "@/components/ui/ChevronDown";
import { useCurrencyRates } from "@/hooks/useCurrencyRates";
import { CurrencySelect } from "@/components/ui/CurrencySelect";
import { convertEntryAmount } from "@/lib/convertEntryAmount";
import { useRouteMotion } from "@/hooks/useRouteMotion";
import { useTripDisplayCurrency } from "@/hooks/useTripDisplayCurrency";

function PaymentMethodIcon({ method }: { method: string }) {
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
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden="true" {...common}>
      <circle cx="6" cy="12" r="1" fill="currentColor" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <circle cx="18" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}

export function TripReports() {
  const routeMotion = useRouteMotion();
  const trip = useTripLayout();
  const { user } = useAuth();
  const { report, loading, error } = useTripReports(trip.id, user?.id);
  const { rates, currencies, loading: ratesLoading } = useCurrencyRates(trip.default_currency);
  const [displayCurrency, setDisplayCurrency] = useTripDisplayCurrency({
    tripId: trip.id,
    defaultCurrency: trip.default_currency,
    scope: "reports",
  });
  const displayRate = rates[displayCurrency] ?? 1;
  const preferredCurrency = user?.preferred_currency;
  const preferredRate =
    preferredCurrency === trip.default_currency ? 1 : rates[preferredCurrency ?? ""];
  const showPreferredConversion =
    Boolean(preferredCurrency) &&
    preferredCurrency !== displayCurrency &&
    preferredRate !== undefined;
  const expandedKey = `bonado:reports:${trip.id}:expanded`;
  const [expandedCategory, setExpandedCategory] = useState<string | null>(
    () => sessionStorage.getItem(expandedKey),
  );

  function toggleCategory(name: string) {
    const next = expandedCategory === name ? null : name;
    setExpandedCategory(next);
    if (next) sessionStorage.setItem(expandedKey, next);
    else sessionStorage.removeItem(expandedKey);
  }

  return (
    <PageShell padded={false} wide className={routeMotion}>
      <TripTabHeader tripId={trip.id} title="Reports" />

      <div className="flex flex-col gap-3.5 px-6 pb-24 pt-2.5">
        {loading ? (
          <>
            <Skeleton className="h-[116px] w-full rounded-[20px]" />
            <Skeleton className="h-[240px] w-full rounded-[18px]" />
          </>
        ) : report.groupTotal <= 0 ? (
          <div className="rounded-[18px] bg-card p-6 text-center text-[13.5px] text-secondary shadow-[var(--shadow-card)]">
            Reports will appear once the trip has expenses.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <SectionLabel className="mb-0">Spending in</SectionLabel>
              <CurrencySelect
                value={displayCurrency}
                onChange={setDisplayCurrency}
                currencies={currencies.length > 0 ? currencies : [trip.default_currency]}
                disabled={ratesLoading}
                pinned={[
                  { value: trip.default_currency, label: `Trip default · ${trip.default_currency}` },
                  ...(user ? [{ value: user.preferred_currency, label: `Preferred · ${user.preferred_currency}` }] : []),
                ]}
                aria-label="Reports display currency"
              />
            </div>

            <div className="grid grid-cols-2 divide-x divide-hairline rounded-[20px] bg-card px-2 py-5 shadow-[var(--shadow-card)]">
              <div className="px-3 text-center">
                <div className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-secondary">
                  You spent
                </div>
                <div className="mt-1 text-[21px] font-extrabold tracking-[-0.5px] text-teal-dark">
                  {formatMoney(report.userTotal * displayRate, displayCurrency)}
                </div>
                {showPreferredConversion && (
                  <div className="mt-0.5 text-[11px] text-faint">
                    ≈ {formatMoney(report.userTotal * preferredRate, preferredCurrency!)}
                  </div>
                )}
              </div>
              <div className="px-3 text-center">
                <div className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-secondary">
                  Group spent
                </div>
                <div className="mt-1 text-[21px] font-extrabold tracking-[-0.5px]">
                  {formatMoney(report.groupTotal * displayRate, displayCurrency)}
                </div>
                {showPreferredConversion && (
                  <div className="mt-0.5 text-[11px] text-faint">
                    ≈ {formatMoney(report.groupTotal * preferredRate, preferredCurrency!)}
                  </div>
                )}
              </div>
            </div>

            {report.hasEstimatedRates && (
              <div className="rounded-[14px] bg-track px-3 py-2.5 text-[11.5px] text-secondary">
                Includes estimated foreign-currency amounts.
              </div>
            )}

            <SectionLabel>Payment breakdown</SectionLabel>
            <div className="overflow-hidden rounded-[18px] bg-card px-4 shadow-[var(--shadow-card)]">
              {report.paymentBreakdown.length > 0 ? (
                report.paymentBreakdown.map((payment, index) => {
                  const percent =
                    report.userPaidTotal > 0 ? (payment.amount / report.userPaidTotal) * 100 : 0;
                  return (
                    <div
                      key={payment.key}
                      className={clsx(
                        "flex items-center gap-3 py-3",
                        index < report.paymentBreakdown.length - 1 && "border-b border-hairline",
                      )}
                    >
                      <span className="grid size-10 flex-none place-items-center rounded-[13px] bg-tile text-primary">
                        <PaymentMethodIcon method={payment.method} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] font-extrabold">
                          {payment.label}
                        </div>
                        <div className="text-[10.5px] font-semibold text-secondary">
                          {Math.round(percent)}% of your payments
                        </div>
                      </div>
                      <div className="shrink-0 text-right text-[13px] font-extrabold text-teal-dark">
                        {formatMoney(payment.amount * displayRate, displayCurrency)}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-4 text-center text-[12.5px] text-secondary">
                  Payments you make will appear here by method.
                </div>
              )}
            </div>

            <SectionLabel>Spending breakdown</SectionLabel>
            <div className="rounded-[18px] bg-card px-4 shadow-[var(--shadow-card)]">
              {report.categories.map((category, index) => {
                const expanded = expandedCategory === category.name;
                const userPercent =
                  report.userTotal > 0 ? (category.userAmount / report.userTotal) * 100 : 0;
                const groupPercent = (category.groupAmount / report.groupTotal) * 100;
                return (
                  <div
                    key={category.name}
                    className={clsx(
                      index < report.categories.length - 1 &&
                        !expanded &&
                        "border-b border-hairline",
                    )}
                  >
                    <button
                      onClick={() => toggleCategory(category.name)}
                      className={clsx(
                        "grid w-full grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 bg-card py-3.5 text-left",
                        expanded && "sticky top-[calc(56px+env(safe-area-inset-top))] z-10",
                      )}
                      aria-expanded={expanded}
                    >
                      <span className="grid size-10 flex-none place-items-center rounded-[13px] bg-tile text-[17px]">
                        <CategoryIcon category={category.name} />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13.5px] font-extrabold">
                        {category.name}
                      </span>
                      <ChevronDown
                        className={clsx(
                          "text-secondary transition-transform",
                          expanded && "rotate-180",
                        )}
                      />
                      <span className="col-start-2 col-end-4 grid grid-cols-2 gap-3">
                        <span className="grid min-w-0">
                          <span className="truncate text-[12.5px] font-extrabold text-teal-dark">
                            {formatMoney(category.userAmount * displayRate, displayCurrency)}
                          </span>
                          <span className="text-[9.5px] font-semibold text-secondary">
                            You · {Math.round(userPercent)}% of your total
                          </span>
                        </span>
                        <span className="grid min-w-0 text-right">
                          <span className="truncate text-[12.5px] font-extrabold">
                            {formatMoney(category.groupAmount * displayRate, displayCurrency)}
                          </span>
                          <span className="text-[9.5px] font-semibold text-secondary">
                            Group · {Math.round(groupPercent)}% of total
                          </span>
                        </span>
                      </span>
                    </button>

                    {expanded && (
                      <div className="motion-reveal mb-3 overflow-hidden rounded-[14px] bg-tile/60 px-3">
                        {category.transactions.map((entry, transactionIndex) => {
                          const userDisplay = convertEntryAmount(
                            entry.userAmount,
                            entry.currency,
                            entry.exchange_rate_to_trip_default,
                            displayCurrency,
                            trip.default_currency,
                            rates,
                          );
                          const groupDisplay = convertEntryAmount(
                            entry.groupAmount,
                            entry.currency,
                            entry.exchange_rate_to_trip_default,
                            displayCurrency,
                            trip.default_currency,
                            rates,
                          );
                          return (
                              <Link
                                key={entry.id}
                                to={`/trips/${trip.id}/expenses/${entry.id}`}
                                state={{ transition: "sheet" }}
                            className={clsx(
                              "flex items-center gap-3 py-3",
                              transactionIndex < category.transactions.length - 1 &&
                                "border-b border-hairline",
                            )}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[13px] font-bold">
                                {entry.description}
                              </div>
                              <div className="truncate text-[10.5px] text-secondary">
                                {entry.payee ? `Paid to ${entry.payee}` : "No payee"}
                              </div>
                            </div>
                            <div className="grid shrink-0 grid-cols-2 gap-3 text-right">
                              <div>
                                <div className="text-[12.5px] font-extrabold text-teal-dark">
                                  {userDisplay.converted && (
                                    <span className="mr-0.5 text-faint" title={`Converted from ${entry.currency}`}>
                                      ≈
                                    </span>
                                  )}
                                  {formatMoney(userDisplay.amount, userDisplay.currency)}
                                </div>
                                <div className="text-[9.5px] font-semibold text-secondary">
                                  Your share
                                </div>
                              </div>
                              <div>
                                <div className="text-[12.5px] font-extrabold">
                                  {groupDisplay.converted && (
                                    <span className="mr-0.5 text-faint" title={`Converted from ${entry.currency}`}>
                                      ≈
                                    </span>
                                  )}
                                  {formatMoney(groupDisplay.amount, groupDisplay.currency)}
                                </div>
                                <div className="text-[9.5px] font-semibold text-secondary">
                                  Group
                                </div>
                              </div>
                            </div>
                            <span className="text-[12px] text-faint">›</span>
                          </Link>
                          );
                        })}
                      </div>
                    )}
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
