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

export function TripReports() {
  const trip = useTripLayout();
  const { user } = useAuth();
  const { report, loading, error } = useTripReports(trip.id, user?.id);
  const { rates, currencies, loading: ratesLoading } = useCurrencyRates(trip.default_currency);
  const [pickedCurrency, setPickedCurrency] = useState("");
  const displayCurrency = pickedCurrency || trip.default_currency;
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
    <PageShell>
      <TripTabHeader tripId={trip.id} title="Reports" />

      <div className="flex flex-col gap-3.5 pb-24 pt-2.5">
        {loading ? (
          <>
            <Skeleton className="h-[116px] w-full rounded-[20px]" />
            <Skeleton className="h-[240px] w-full rounded-[18px]" />
          </>
        ) : report.groupTotal <= 0 ? (
          <div className="rounded-[18px] bg-card p-6 text-center text-[13.5px] text-secondary shadow-card">
            Reports will appear once the trip has expenses.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <SectionLabel className="mb-0">Spending in</SectionLabel>
              <CurrencySelect
                value={displayCurrency}
                onChange={setPickedCurrency}
                currencies={currencies.length > 0 ? currencies : [trip.default_currency]}
                disabled={ratesLoading}
                aria-label="Reports display currency"
              />
            </div>

            <div className="grid grid-cols-2 divide-x divide-black/5 rounded-[20px] bg-card px-2 py-5 shadow-card">
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

            <SectionLabel>Spending breakdown</SectionLabel>
            <div className="rounded-[18px] bg-card px-4 shadow-card">
              {report.categories.map((category, index) => {
                const expanded = expandedCategory === category.name;
                const userPercent =
                  report.userTotal > 0 ? (category.userAmount / report.userTotal) * 100 : 0;
                const groupPercent = (category.groupAmount / report.groupTotal) * 100;
                return (
                  <div
                    key={category.name}
                    className={clsx(index < report.categories.length - 1 && "border-b border-black/5")}
                  >
                    <button
                      onClick={() => toggleCategory(category.name)}
                      className={clsx(
                        "grid w-full grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 bg-card py-3.5 text-left",
                        expanded && "sticky top-14 z-10",
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
                      <div className="motion-reveal mb-3 overflow-hidden rounded-[14px] bg-bg px-3">
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
                            className={clsx(
                              "flex items-center gap-3 py-3",
                              transactionIndex < category.transactions.length - 1 &&
                                "border-b border-black/5",
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
