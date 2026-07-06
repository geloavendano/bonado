import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { PageShell } from "@/components/layout/PageShell";
import { CoverPhoto } from "@/components/ui/CoverPhoto";
import { AvatarStack } from "@/components/ui/AvatarStack";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { useTripLayout } from "@/components/trip/useTripLayout";
import { GuestBanner } from "@/components/trip/GuestBanner";
import { Skeleton } from "@/components/ui/Skeleton";
import { useRecentEntries } from "@/hooks/useRecentEntries";
import { formatMoney } from "@/lib/money";
import { useAuth } from "@/context/AuthContext";
import { Toast } from "@/components/ui/Toast";
import { useRouteToast } from "@/hooks/useRouteToast";
import { useBalances } from "@/hooks/useBalances";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { useCurrencyRates } from "@/hooks/useCurrencyRates";
import { CurrencySelect } from "@/components/ui/CurrencySelect";
import { convertEntryAmount } from "@/lib/convertEntryAmount";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useUnreadTransactions } from "@/hooks/useUnreadTransactions";
import { shareLink } from "@/lib/share";
import { useRouteMotion } from "@/hooks/useRouteMotion";
import { inviteUrl as buildInviteUrl } from "@/lib/appUrl";

export function TripHome() {
  const routeMotion = useRouteMotion("forward");
  const trip = useTripLayout();
  const { user } = useAuth();
  const {
    entries,
    loading: entriesLoading,
    loadingMore: entriesLoadingMore,
    hasMore: hasMoreEntries,
    loadMore: loadMoreEntries,
    error: entriesError,
  } =
    useRecentEntries(trip.id);
  const { balances } = useBalances(trip.id);
  const { entryIds: unreadEntryIds, settlementIds: unreadSettlementIds } =
    useUnreadTransactions(trip.id);
  const { rates, currencies, loading: ratesLoading } = useCurrencyRates(trip.default_currency);
  const [copied, setCopied] = useState(false);
  const [displayCurrency, setDisplayCurrency] = useState("");
  const toastMessage = useRouteToast();
  const [headerCompact, setHeaderCompact] = useState(false);
  const headerSentinelRef = useRef<HTMLDivElement>(null);
  const groupedEntries = entries.reduce<Map<string, typeof entries>>(
    (groups, entry) => {
      const group = groups.get(entry.date) ?? [];
      group.push(entry);
      groups.set(entry.date, group);
      return groups;
    },
    new Map(),
  );
  const yourBalance =
    balances.find((balance) => balance.user_id === user?.id)?.balance ??
    trip.yourBalance;
  const balanceCurrency =
    displayCurrency ||
    (user?.preferred_currency && rates[user.preferred_currency]
      ? user.preferred_currency
      : trip.default_currency);
  const displayedBalance = yourBalance * (rates[balanceCurrency] ?? 1);

  const inviteUrl = buildInviteUrl(trip.invite_link_token);

  useEffect(() => {
    let frame = 0;
    function updateHeader() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const top = headerSentinelRef.current?.getBoundingClientRect().top ?? 1;
        setHeaderCompact(top <= 0);
      });
    }
    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", updateHeader);
    };
  }, []);

  async function shareInvite() {
    const shareData = {
      title: `Join ${trip!.name} on bonado`,
      text: `You've been invited to "${trip!.name}" on bonado, a shared expense tracker for groups. Join to log expenses together, see who owes what, and settle up:`,
      url: inviteUrl,
    };
    const result = await shareLink(shareData);
    if (result === "copied") {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <PageShell padded={false} wide className={routeMotion}>
      <div className="relative">
        <CoverPhoto
          url={trip.cover_photo_url}
          label={`trip cover — ${trip.location_name ?? trip.name}`}
          className="h-[150px] w-full"
        />
        <div
          className={
            "absolute inset-x-4 top-[max(12px,env(safe-area-inset-top))] flex items-center justify-between " +
            (headerCompact ? "" : "trip-top-nav")
          }
        >
          <Link
            to="/"
            replace
            className="grid size-[34px] place-items-center rounded-full bg-card text-secondary shadow-[var(--shadow-card)]"
            aria-label="Back to dashboard"
          >
            ←
          </Link>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <Link
              to={`/trips/${trip.id}/settings`}
              className="grid size-[38px] place-items-center rounded-full bg-card text-secondary shadow-[var(--shadow-card)]"
              aria-label="Trip settings"
            >
              ⚙︎
            </Link>
          </div>
        </div>
      </div>

      <div ref={headerSentinelRef} className="h-px" />
      <div
        className={
          "sticky top-0 z-20 flex items-center bg-bg/95 pt-[env(safe-area-inset-top)] backdrop-blur-md transition-[min-height,padding,border-color,box-shadow] duration-200 " +
          (headerCompact
            ? "trip-top-nav min-h-14 border-b border-hairline px-4 shadow-[var(--shadow-card)]"
            : "min-h-[72px] border-b border-transparent px-6")
        }
      >
        <Link
          to="/"
          aria-label="Back to dashboard"
          className={
            "grid flex-none place-items-center overflow-hidden rounded-full bg-card text-secondary shadow-[var(--shadow-card)] transition-[width,opacity] duration-200 " +
            (headerCompact
              ? "pointer-events-auto h-9 w-9 opacity-100"
              : "pointer-events-none h-9 w-0 opacity-0")
          }
        >
          ←
        </Link>
        <div
          className={
            "min-w-0 flex-1 transition-[padding,text-align] duration-200 " +
            (headerCompact ? "px-3 text-center" : "px-0 text-left")
          }
        >
          <div
            className={
              "truncate font-extrabold tracking-[-0.4px] transition-[font-size] duration-200 " +
              (headerCompact ? "text-[16px]" : "text-[21px]")
            }
          >
            {trip.name}
          </div>
          <div
            className={
              "overflow-hidden text-[12.5px] font-semibold text-secondary transition-[height,opacity,margin] duration-200 " +
              (headerCompact ? "h-0 opacity-0" : "h-5 opacity-100")
            }
          >
            {trip.location_name}
          </div>
        </div>
        <Link
          to={`/trips/${trip.id}/settings`}
          aria-label="Trip settings"
          className={
            "grid flex-none place-items-center overflow-hidden rounded-full bg-card text-secondary shadow-[var(--shadow-card)] transition-[width,opacity] duration-200 " +
            (headerCompact
              ? "pointer-events-auto h-9 w-9 opacity-100"
              : "pointer-events-none h-9 w-0 opacity-0")
          }
        >
          ⚙︎
        </Link>
      </div>

      <div className="flex flex-col gap-3.5 px-6 pt-4 pb-24">
        <GuestBanner />

        <div className="flex items-center gap-2.5">
          <Link to={`/trips/${trip.id}/settings`} aria-label="View members">
            <AvatarStack people={trip.members} />
          </Link>
          <button
            onClick={() => void shareInvite()}
            className="ml-auto flex items-center gap-1.5 bg-card rounded-pill px-3.5 py-2 text-[13px] font-bold text-teal shadow-[var(--shadow-card)]"
          >
            {copied ? "Copied ✓" : "🔗 Share invite"}
          </button>
        </div>

        <Link
          to={`/trips/${trip.id}/balances`}
          className="bg-teal-tint rounded-[18px] px-[18px] py-[15px] flex items-center"
        >
          <div>
            <div className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-teal-dark/70">
              Your balance
            </div>
            <div className="text-[19px] font-extrabold text-teal-dark">
              {yourBalance === 0
                ? "Settled up"
                : yourBalance > 0
                  ? `You're owed ${formatMoney(displayedBalance, balanceCurrency)}`
                  : `You owe ${formatMoney(-displayedBalance, balanceCurrency)}`}
            </div>
          </div>
          <svg
            viewBox="0 0 24 24"
            className="ml-auto size-5 flex-none text-teal"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m9 6 6 6-6 6" />
          </svg>
        </Link>

        <div className="mt-0.5 flex items-center justify-between">
          <SectionLabel>Transaction history</SectionLabel>
          {entries.length > 0 && (
            <CurrencySelect
              value={displayCurrency}
              onChange={setDisplayCurrency}
              currencies={currencies.length > 0 ? currencies : [trip.default_currency]}
              disabled={ratesLoading}
              pinned={[
                { value: "", label: "Original" },
                { value: trip.default_currency, label: `Trip default · ${trip.default_currency}` },
                ...(user ? [{ value: user.preferred_currency, label: `Preferred · ${user.preferred_currency}` }] : []),
              ]}
              aria-label="Transaction display currency"
            />
          )}
        </div>

        {entriesLoading ? (
          <div className="flex flex-col gap-2.5">
            <Skeleton className="h-[68px] w-full rounded-[18px]" />
            <Skeleton className="h-[68px] w-full rounded-[18px]" />
          </div>
        ) : entriesError ? (
          <div className="rounded-[18px] bg-owe-tint p-4 text-center text-[12.5px] text-owe">
            Couldn’t load transactions. {entriesError}
          </div>
        ) : entries.length > 0 ? (
          <div className="flex flex-col gap-1">
            {[...groupedEntries.entries()].map(([date, dateEntries]) => {
              const dateValue = new Date(`${date}T00:00:00`);
              const today = new Date();
              const yesterday = new Date();
              yesterday.setDate(today.getDate() - 1);
              const sameDay = (left: Date, right: Date) =>
                left.getFullYear() === right.getFullYear() &&
                left.getMonth() === right.getMonth() &&
                left.getDate() === right.getDate();
              const dateLabel = sameDay(dateValue, today)
                ? "Today"
                : sameDay(dateValue, yesterday)
                  ? "Yesterday"
                  : dateValue.toLocaleDateString(undefined, {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    });

              return (
                <section key={date}>
                  <div className="sticky top-[calc(56px+env(safe-area-inset-top))] z-10 -mx-1 bg-bg/95 px-1 py-2.5 text-[11.5px] font-extrabold uppercase tracking-[0.07em] text-secondary backdrop-blur-md">
                    {dateLabel}
                  </div>
                  <div className="overflow-hidden rounded-[18px] bg-card px-4 shadow-[var(--shadow-card)]">
                    {dateEntries.map((entry, index) => {
              if (entry.type === "settlement") {
                const isSender = entry.from_user_id === user?.id;
                const isReceiver = entry.to_user_id === user?.id;
                const settlementDisplay = convertEntryAmount(
                  entry.amount,
                  trip.default_currency,
                  1,
                  displayCurrency,
                  trip.default_currency,
                  rates,
                );
                const unread = unreadSettlementIds.has(entry.id);
                return (
                  <Link
                    key={`settlement-${entry.id}`}
                    to={`/trips/${trip.id}/settlements/${entry.id}`}
                    state={{ transition: "sheet" }}
                    className={
                      "flex items-center gap-3 py-3.5" +
                      (index < dateEntries.length - 1 ? " border-b border-hairline" : "")
                    }
                  >
                    <div className="grid size-10 flex-none place-items-center rounded-[13px] bg-teal-tint text-teal-dark">
                      <svg viewBox="0 0 24 24" className="size-[19px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 8h14M15 4l4 4-4 4M19 16H5M9 12l-4 4 4 4" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14.5px] font-bold">Settlement</div>
                      <div className="truncate text-[11.5px] text-secondary">
                        {entry.from_user?.name ?? "Member"} paid {entry.to_user?.name ?? "Member"}
                      </div>
                    </div>
                    <div
                      className={clsx(
                        "shrink-0 text-right text-[14px] font-extrabold",
                        isReceiver ? "text-owed" : isSender ? "text-owe" : "text-ink",
                      )}
                    >
                      {settlementDisplay.converted && (
                        <span className="mr-0.5 text-faint" title={`Converted from ${trip.default_currency}`}>
                          ≈
                        </span>
                      )}
                      {isReceiver ? "+" : isSender ? "−" : ""}
                      {formatMoney(settlementDisplay.amount, settlementDisplay.currency)}
                    </div>
                    <span
                      aria-label={unread ? "Unread transaction" : undefined}
                      className={
                        "size-2 flex-none rounded-full " +
                        (unread ? "bg-teal" : "bg-transparent")
                      }
                    />
                  </Link>
                );
              }
              const yourShare = user
                ? entry.line_items.reduce(
                    (sum, item) =>
                      sum +
                      item.line_item_shares
                        .filter((share) => share.user_id === user.id)
                        .reduce((shareSum, share) => shareSum + Number(share.owed_amount), 0),
                    0,
                  ) +
                  entry.adjustments.reduce(
                    (sum, adjustment) =>
                      sum +
                      adjustment.adjustment_shares
                        .filter((share) => share.user_id === user.id)
                        .reduce((shareSum, share) => shareSum + Number(share.owed_amount), 0),
                    0,
                  )
                : 0;
              const yourPaid = user
                ? entry.payments
                    .filter((payment) => payment.user_id === user.id)
                    .reduce((sum, payment) => sum + Number(payment.amount_paid), 0)
                : 0;
              const payers = entry.payments.flatMap((payment) =>
                payment.user ? [payment.user] : [],
              );
              const payerNames = payers.map((payer) => payer.name).join(", ");
              const unread = unreadEntryIds.has(entry.id);
              const shareDisplay = convertEntryAmount(
                yourShare,
                entry.currency,
                entry.exchange_rate_to_trip_default,
                displayCurrency,
                trip.default_currency,
                rates,
              );
              const paidDisplay = convertEntryAmount(
                yourPaid,
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
                  className={
                    "flex items-center gap-3 py-3.5" +
                    (index < dateEntries.length - 1 ? " border-b border-hairline" : "")
                  }
                >
                  <div className="grid size-10 flex-none place-items-center rounded-[13px] bg-tile text-[17px]">
                    <CategoryIcon category={entry.category?.name ?? "Other"} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14.5px] font-bold">{entry.description}</div>
                    <div className="flex items-center gap-1.5 text-[11.5px] text-secondary">
                      <span className="truncate">
                        {entry.payee
                          ? `Paid to ${entry.payee}`
                          : payerNames
                            ? `Paid by ${payerNames}`
                            : "No payer"}
                      </span>
                      {entry.payee && payers.length > 0 && (
                        <>
                          <span className="flex-none">by</span>
                          <AvatarStack people={payers} size={16} max={3} />
                        </>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[14px] font-extrabold">
                      {shareDisplay.converted && (
                        <span className="mr-0.5 text-faint" title={`Converted from ${entry.currency}`}>
                          ≈
                        </span>
                      )}
                      {formatMoney(shareDisplay.amount, shareDisplay.currency)}
                    </div>
                    {yourPaid > 0 && (
                      <div className="text-[10.5px] font-semibold text-secondary">
                        {formatMoney(paidDisplay.amount, paidDisplay.currency)}
                      </div>
                    )}
                  </div>
                  <span
                    aria-label={unread ? "Unread transaction" : undefined}
                    className={
                      "size-2 flex-none rounded-full " +
                      (unread ? "bg-teal" : "bg-transparent")
                    }
                  />
                </Link>
              );
                    })}
                  </div>
                </section>
              );
            })}
            {hasMoreEntries && (
              <button
                onClick={() => void loadMoreEntries()}
                disabled={entriesLoadingMore}
                className="mt-3 rounded-[16px] bg-card px-4 py-3 text-[13px] font-bold text-teal shadow-[var(--shadow-card)] disabled:opacity-50"
              >
                {entriesLoadingMore ? "Loading…" : "Load more transactions"}
              </button>
            )}
          </div>
        ) : (
          <div className="bg-card rounded-[18px] p-6 text-center text-secondary text-[13.5px] shadow-[var(--shadow-card)]">
            No expenses yet. Tap + to add the first one.
          </div>
        )}
      </div>
      <Toast message={toastMessage} />
    </PageShell>
  );
}
