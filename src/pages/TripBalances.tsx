import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { PageShell } from "@/components/layout/PageShell";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Skeleton } from "@/components/ui/Skeleton";
import { Toast } from "@/components/ui/Toast";
import {
  PaymentMethodPicker,
  type PaymentMethod,
} from "@/components/expense/PaymentMethodPicker";
import { useTripLayout } from "@/components/trip/useTripLayout";
import { useBalances } from "@/hooks/useBalances";
import { useRecordSettlement } from "@/hooks/useRecordSettlement";
import { useAuth } from "@/context/AuthContext";
import { formatMoney, formatSignedMoney } from "@/lib/money";
import { TripTabHeader } from "@/components/trip/TripTabHeader";
import { useCurrencyRates } from "@/hooks/useCurrencyRates";
import { createPortal } from "react-dom";
import { ChevronDown } from "@/components/ui/ChevronDown";
import { CurrencySelect } from "@/components/ui/CurrencySelect";
import { useOverlayA11y } from "@/hooks/useOverlayA11y";
import { useRouteMotion } from "@/hooks/useRouteMotion";
import { useTripDisplayCurrency } from "@/hooks/useTripDisplayCurrency";
import { usePaymentAccounts } from "@/hooks/usePaymentAccounts";
import { copyTextToClipboard } from "@/lib/clipboard";
import {
  buildSettlementSuggestions,
  type SuggestedSettlement,
} from "@/lib/moneyMath";

function todayForInput() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function ClipboardIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="8" y="8" width="11" height="13" rx="2" />
      <path d="M16 8V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h1" />
    </svg>
  );
}

export function TripBalances() {
  const routeMotion = useRouteMotion();
  const trip = useTripLayout();
  const { user } = useAuth();
  const { balances, loading, error, reload } = useBalances(trip.id);
  const { recordSettlement, saving, error: settlementError } = useRecordSettlement();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [fromUserId, setFromUserId] = useState("");
  const [toUserId, setToUserId] = useState("");
  const [amount, setAmount] = useState("");
  const [settlementCurrency, setSettlementCurrency] = useState(trip.default_currency);
  const [date, setDate] = useState(todayForInput);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("");
  const [paymentLabel, setPaymentLabel] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [copiedFieldKey, setCopiedFieldKey] = useState<string | null>(null);
  const [displayCurrency, setDisplayCurrency] = useTripDisplayCurrency({
    tripId: trip.id,
    defaultCurrency: trip.default_currency,
    scope: "balances",
  });
  const settlementSheetRef = useOverlayA11y<HTMLDivElement>(
    sheetOpen,
    () => setSheetOpen(false),
  );
  const {
    accounts: recipientAccounts,
    loading: recipientAccountsLoading,
    error: recipientAccountsError,
  } = usePaymentAccounts(sheetOpen && toUserId ? toUserId : undefined);
  const {
    rates,
    currencies,
    rateDate,
    loading: ratesLoading,
    error: ratesError,
  } = useCurrencyRates(trip.default_currency);
  const displayRate = rates[displayCurrency] ?? (displayCurrency === trip.default_currency ? 1 : 0);
  const convert = (amount: number) => amount * displayRate;

  const memberBalances = useMemo(
    () =>
      trip.members.map((member) => ({
        ...member,
        balance:
          balances.find((balance) => balance.user_id === member.id)?.balance ?? 0,
      })),
    [balances, trip.members],
  );
  const suggestions = useMemo(() => buildSettlementSuggestions(balances), [balances]);
  const yourBalance =
    balances.find((balance) => balance.user_id === user?.id)?.balance ?? 0;
  const hasActivity = balances.some((balance) => balance.has_activity);
  const hasEstimatedRates = balances.some((balance) => balance.has_estimated_rates);
  const isSettled =
    hasActivity && balances.every((balance) => Math.abs(balance.balance) < 0.005);

  useEffect(() => {
    if (!sheetOpen) return;
    setSettlementCurrency(trip.default_currency);
    const first = suggestions[0];
    if (first) {
      setFromUserId(first.fromUserId);
      setToUserId(first.toUserId);
      setAmount(String(first.amount));
    } else {
      setFromUserId((current) => current || user?.id || trip.members[0]?.id || "");
      setToUserId((current) =>
        current || trip.members.find((member) => member.id !== user?.id)?.id || "",
      );
    }
  }, [sheetOpen, suggestions, trip.members, user?.id, trip.default_currency]);

  useEffect(() => {
    if (fromUserId && fromUserId === toUserId) {
      setToUserId(
        trip.members.find((member) => member.id !== fromUserId)?.id ?? "",
      );
    }
  }, [fromUserId, toUserId, trip.members]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!copiedFieldKey) return;
    const timer = window.setTimeout(() => setCopiedFieldKey(null), 1800);
    return () => window.clearTimeout(timer);
  }, [copiedFieldKey]);

  function openSuggestion(suggestion?: SuggestedSettlement) {
    if (suggestion) {
      setFromUserId(suggestion.fromUserId);
      setToUserId(suggestion.toUserId);
      setAmount(String(suggestion.amount));
    }
    setSheetOpen(true);
  }

  const settlementRate =
    settlementCurrency === trip.default_currency
      ? 1
      : rates[settlementCurrency]
        ? 1 / rates[settlementCurrency]
        : 0;
  const convertedSettlementAmount = Number(amount) * settlementRate;

  async function handleSettlement() {
    const numericAmount = Number(amount);
    if (
      !fromUserId ||
      !toUserId ||
      fromUserId === toUserId ||
      numericAmount <= 0 ||
      settlementRate <= 0
    ) {
      return;
    }
    const ok = await recordSettlement({
      tripId: trip.id,
      fromUserId,
      toUserId,
      amount: Math.round(numericAmount * settlementRate * 100) / 100,
      date,
      paymentMethod,
      paymentLabel,
    });
    if (ok) {
      setSheetOpen(false);
      setPaymentMethod("");
      setPaymentLabel("");
      await reload();
      setToast("Settlement recorded.");
    }
  }

  const personName = (id: string) =>
    trip.members.find((member) => member.id === id)?.name ?? "Member";

  async function copySettlementDetail(fieldKey: string, value: string, message: string) {
    try {
      await copyTextToClipboard(value);
      setCopiedFieldKey(fieldKey);
      setToast(message);
    } catch {
      setToast("Could not copy.");
    }
  }

  return (
    <PageShell padded={false} wide className={routeMotion}>
      <TripTabHeader tripId={trip.id} title="Balances" />

      <div className="flex flex-col gap-3.5 px-6 pb-24 pt-2.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.07em] text-secondary">
              Display currency
            </div>
            {displayCurrency !== trip.default_currency && displayRate > 0 && (
              <div className="mt-0.5 text-[10px] text-faint">
                1 {trip.default_currency} = {displayRate.toLocaleString(undefined, { maximumFractionDigits: 5 })} {displayCurrency}
                {rateDate ? ` · ${rateDate}` : ""}
              </div>
            )}
          </div>
          <CurrencySelect
            value={displayCurrency}
            onChange={setDisplayCurrency}
            currencies={currencies.length > 0 ? currencies : [trip.default_currency]}
            disabled={ratesLoading}
            pinned={[
              { value: trip.default_currency, label: `Trip default · ${trip.default_currency}` },
              ...(user ? [{ value: user.preferred_currency, label: `Preferred · ${user.preferred_currency}` }] : []),
            ]}
          />
        </div>
        {ratesError && (
          <div className="rounded-[14px] bg-owe-tint px-3 py-2 text-[11px] text-owe">
            {ratesError} Showing {trip.default_currency}.
          </div>
        )}
        {loading && balances.length === 0 ? (
          <>
            <Skeleton className="h-[112px] w-full rounded-[20px]" />
            <Skeleton className="h-[190px] w-full rounded-[18px]" />
          </>
        ) : (
          <>
            <div
              className={clsx(
                "relative overflow-hidden rounded-[20px] px-[18px] py-5 text-center",
                isSettled ? "bg-teal text-white" : "bg-teal-tint",
              )}
            >
              {isSettled && (
                <>
                  <span className="absolute left-8 top-4 size-2 rounded-full bg-white/50" />
                  <span className="absolute right-10 top-7 size-1.5 rounded-full bg-mint" />
                  <span className="absolute bottom-5 left-14 size-1 rounded-full bg-white/70" />
                </>
              )}
              <div
                className={clsx(
                  "text-[11.5px] font-bold uppercase tracking-[0.09em]",
                  isSettled ? "text-white/75" : "text-teal-dark/70",
                )}
              >
                Your position
              </div>
              <div
                className={clsx(
                  "mt-1 text-[26px] font-extrabold tracking-[-0.5px]",
                  isSettled ? "text-white" : yourBalance < 0 ? "text-owe" : "text-teal-dark",
                )}
              >
                {Math.abs(yourBalance) < 0.005
                  ? "Settled up"
                  : yourBalance > 0
                    ? `You're owed ${formatMoney(convert(yourBalance), displayCurrency)}`
                    : `You owe ${formatMoney(convert(-yourBalance), displayCurrency)}`}
              </div>
              {isSettled && (
                <div className="mt-1 text-[12px] font-semibold text-white/80">
                  Everyone is even. Nicely done.
                </div>
              )}
            </div>

            {hasEstimatedRates && (
              <div className="rounded-[14px] bg-track px-3 py-2.5 text-[11.5px] text-secondary">
                Includes foreign-currency amounts converted with an estimated rate (the live rate wasn’t available when they were saved).
              </div>
            )}

            <SectionLabel>By member</SectionLabel>
            <div className="overflow-hidden rounded-[18px] bg-card px-4 shadow-[var(--shadow-card)]">
              {memberBalances
                .sort((a, b) => b.balance - a.balance)
                .map((member, index) => (
                  <div
                    key={member.id}
                    className={clsx(
                      "flex items-center gap-3 py-3",
                      index < memberBalances.length - 1 && "border-b border-hairline",
                    )}
                  >
                    <Avatar
                      name={member.name}
                      seed={member.id}
                      avatarUrl={member.avatar_url}
                      size={36}
                    />
                    <div className="min-w-0 flex-1 truncate text-[14px] font-semibold">
                      {member.name}
                    </div>
                    <div
                      className={clsx(
                        "text-[13px] font-extrabold",
                        member.balance > 0.005
                          ? "text-owed"
                          : member.balance < -0.005
                            ? "text-owe"
                            : "text-secondary",
                      )}
                    >
                      {formatSignedMoney(convert(member.balance), displayCurrency)}
                    </div>
                  </div>
                ))}
            </div>

            {suggestions.length > 0 && (
              <>
                <SectionLabel>Suggested settlements</SectionLabel>
                <div className="flex flex-col gap-2">
                  {suggestions.map((suggestion) => (
                    <button
                      key={`${suggestion.fromUserId}-${suggestion.toUserId}`}
                      onClick={() => openSuggestion(suggestion)}
                      className="flex items-center gap-2 rounded-[16px] bg-card px-4 py-3 text-left shadow-[var(--shadow-card)]"
                    >
                      <div className="min-w-0 flex-1 text-[12.5px] text-secondary">
                        <span className="font-bold text-ink">
                          {personName(suggestion.fromUserId)}
                        </span>{" "}
                        pays{" "}
                        <span className="font-bold text-ink">
                          {personName(suggestion.toUserId)}
                        </span>
                      </div>
                      <div className="text-[13px] font-extrabold text-teal-dark">
                        {formatMoney(convert(suggestion.amount), displayCurrency)}
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {trip.members.length > 1 && (
              <Button fullWidth onClick={() => openSuggestion()}>
                Record settlement
              </Button>
            )}
          </>
        )}
        {(error || settlementError) && (
          <p className="text-[12.5px] text-owe">{error ?? settlementError}</p>
        )}
      </div>

      {sheetOpen && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/20"
          onClick={() => setSheetOpen(false)}
          role="presentation"
        >
          <div
            ref={settlementSheetRef}
            tabIndex={-1}
            className="motion-reveal max-h-[88dvh] w-full max-w-[430px] overflow-y-auto rounded-t-[26px] bg-bg px-6 pb-[max(20px,env(safe-area-inset-bottom))] pt-4 shadow-[var(--shadow-sheet)]"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Record settlement"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-pill bg-faint-2/60" />
            <div className="mb-4 flex items-center justify-between">
              <button
                onClick={() => setSheetOpen(false)}
                className="text-[13px] font-bold text-secondary"
              >
                Cancel
              </button>
              <div className="text-[16px] font-extrabold">Record settlement</div>
              <div className="w-12" />
            </div>

            <div className="flex flex-col gap-3.5">
              <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                <label className="relative flex min-w-0 flex-col gap-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-secondary">
                  From
                  <select
                    value={fromUserId}
                    onChange={(event) => setFromUserId(event.target.value)}
                    className="min-w-0 appearance-none rounded-xl bg-card py-3 pl-3 pr-9 text-[13px] font-semibold text-ink shadow-[var(--shadow-card)] outline-none"
                  >
                    {trip.members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute bottom-3 right-3 text-secondary" />
                </label>
                <span className="pb-3 text-secondary">→</span>
                <label className="relative flex min-w-0 flex-col gap-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-secondary">
                  To
                  <select
                    value={toUserId}
                    onChange={(event) => setToUserId(event.target.value)}
                    className="min-w-0 appearance-none rounded-xl bg-card py-3 pl-3 pr-9 text-[13px] font-semibold text-ink shadow-[var(--shadow-card)] outline-none"
                  >
                    {trip.members
                      .filter((member) => member.id !== fromUserId)
                      .map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name}
                        </option>
                      ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute bottom-3 right-3 text-secondary" />
                </label>
              </div>

              <div className="rounded-[18px] bg-card px-4 py-3 shadow-[var(--shadow-card)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-secondary">
                      Settlement options
                    </div>
                    <div className="mt-0.5 text-[11px] text-faint">
                      Send to {personName(toUserId)}
                    </div>
                  </div>
                  <div className="text-[10.5px] font-bold text-secondary">
                    {recipientAccounts.length} option{recipientAccounts.length === 1 ? "" : "s"}
                  </div>
                </div>

                {recipientAccountsLoading ? (
                  <div className="mt-3 text-[12px] text-secondary">Loading options…</div>
                ) : recipientAccounts.length > 0 ? (
                  <div className="mt-3 flex flex-col gap-2">
                    {recipientAccounts.map((account) => {
                      const accountName = account.account_name?.trim();
                      const accountNumber = account.account_number?.trim();
                      const nameFieldKey = `${account.id}:name`;
                      const numberFieldKey = `${account.id}:number`;
                      return (
                        <div
                          key={account.id}
                          className="rounded-[14px] bg-tile px-3 py-2.5"
                        >
                          <div className="truncate text-[12.5px] font-extrabold">
                            {account.method} · {account.label}
                          </div>
                          <div className="mt-2 flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-faint">
                                  Account name
                                </div>
                                <div className="truncate text-[11.5px] text-secondary">
                                  {accountName || "No account name provided"}
                                </div>
                              </div>
                              <button
                                type="button"
                                disabled={!accountName}
                                onClick={() => {
                                  if (accountName) {
                                    void copySettlementDetail(
                                      nameFieldKey,
                                      accountName,
                                      "Account name copied.",
                                    );
                                  }
                                }}
                                className="grid size-9 place-items-center rounded-full bg-card text-teal shadow-[var(--shadow-card)] disabled:text-faint disabled:opacity-60"
                                aria-label={`Copy ${account.label} account name`}
                              >
                                {copiedFieldKey === nameFieldKey ? "✓" : <ClipboardIcon />}
                              </button>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-faint">
                                  Account number
                                </div>
                                <div className="truncate text-[11.5px] text-secondary">
                                  {accountNumber || "No account number provided"}
                                </div>
                              </div>
                              <button
                                type="button"
                                disabled={!accountNumber}
                                onClick={() => {
                                  if (accountNumber) {
                                    void copySettlementDetail(
                                      numberFieldKey,
                                      accountNumber,
                                      "Account number copied.",
                                    );
                                  }
                                }}
                                className="grid size-9 place-items-center rounded-full bg-card text-teal shadow-[var(--shadow-card)] disabled:text-faint disabled:opacity-60"
                                aria-label={`Copy ${account.label} account number`}
                              >
                                {copiedFieldKey === numberFieldKey ? "✓" : <ClipboardIcon />}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-3 rounded-[14px] bg-track px-3 py-2.5 text-[11.5px] leading-snug text-secondary">
                    {personName(toUserId)} hasn’t shared settlement receiving details yet.
                  </div>
                )}
                {recipientAccountsError && (
                  <p className="mt-2 text-[11px] text-owe">{recipientAccountsError}</p>
                )}
              </div>

              <div className="flex items-center rounded-[18px] bg-card px-4 py-2 shadow-[var(--shadow-card)]">
                <div className="relative mr-1 flex-none">
                  <select
                    value={settlementCurrency}
                    onChange={(event) => setSettlementCurrency(event.target.value)}
                    aria-label="Settlement currency"
                    className="appearance-none bg-transparent py-2 pr-4 text-[12px] font-bold text-secondary outline-none"
                  >
                    {(currencies.length > 0 ? currencies : [trip.default_currency]).map((currency) => (
                      <option key={currency} value={currency}>
                        {currency}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-[10px] text-secondary" />
                </div>
                <input
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="min-w-0 flex-1 bg-transparent text-right text-[24px] font-extrabold outline-none"
                />
              </div>
              {settlementCurrency !== trip.default_currency && (
                <p className="-mt-2 text-right text-[11px] text-faint">
                  {settlementRate > 0
                    ? `≈ ${formatMoney(convertedSettlementAmount, trip.default_currency)} — settlements are recorded in ${trip.default_currency}`
                    : "Loading exchange rate…"}
                </p>
              )}

              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="rounded-xl bg-card px-3 py-3 text-[13px] font-semibold shadow-[var(--shadow-card)] outline-none"
              />

              <PaymentMethodPicker
                value={paymentMethod}
                label={paymentLabel}
                onChange={setPaymentMethod}
                onLabelChange={setPaymentLabel}
              />

              <Button
                fullWidth
                disabled={
                  saving ||
                  Number(amount) <= 0 ||
                  settlementRate <= 0 ||
                  !fromUserId ||
                  !toUserId ||
                  fromUserId === toUserId
                }
                onClick={() => void handleSettlement()}
              >
                {saving ? "Recording…" : "Record settlement"}
              </Button>
            </div>
          </div>
        </div>,
        document.body,
      )}
      <Toast message={toast} />
    </PageShell>
  );
}
