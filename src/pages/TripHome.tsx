import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { PageShell } from "@/components/layout/PageShell";
import { CoverPhoto } from "@/components/ui/CoverPhoto";
import { AvatarStack } from "@/components/ui/AvatarStack";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { useTripLayout } from "@/components/trip/useTripLayout";
import { TripTabHeader } from "@/components/trip/TripTabHeader";
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
import { useUnreadTransactions } from "@/hooks/useUnreadTransactions";
import { shareLink } from "@/lib/share";
import { useRouteMotion } from "@/hooks/useRouteMotion";
import { inviteUrl as buildInviteUrl } from "@/lib/appUrl";
import { useCategories } from "@/hooks/useCategories";
import {
  flushExpenseQueue,
  removeQueuedExpense,
} from "@/lib/offlineExpenseQueue";
import { refreshVisibleData } from "@/lib/dataRefresh";
import { useTripDisplayCurrency } from "@/hooks/useTripDisplayCurrency";
import { supabase } from "@/lib/supabase";
import { prefetchExpenses } from "@/hooks/useExpense";
import { prefetchSettlements } from "@/hooks/useSettlement";

type HistoryFilter = "all" | "paid" | "created" | "involving";
type DropPlacement = "before" | "after";

const HISTORY_FILTERS: { value: HistoryFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "paid", label: "Paid by me" },
  { value: "created", label: "Created by me" },
  { value: "involving", label: "Involving me" },
];

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
  const { categories } = useCategories();
  const [copied, setCopied] = useState(false);
  const [localToast, setLocalToast] = useState<string | null>(null);
  const [displayCurrency, setDisplayCurrency] = useTripDisplayCurrency({
    tripId: trip.id,
    defaultCurrency: "",
    scope: "entries",
    allowOriginal: true,
  });
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [draggingHistoryId, setDraggingHistoryId] = useState<string | null>(null);
  const [dropPlacement, setDropPlacement] = useState<{
    key: string;
    position: DropPlacement;
  } | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const dragPointerId = useRef<number | null>(null);
  const dragStart = useRef<{ key: string; x: number; y: number } | null>(null);
  const dragActive = useRef(false);
  const suppressNextClick = useRef(false);
  const toastMessage = useRouteToast();
  const filteredEntries = useMemo(() => {
    if (!user || historyFilter === "all") return entries;
    return entries.filter((entry) => {
      if (historyFilter === "created") return entry.created_by === user.id;
      if (entry.type === "settlement") {
        if (historyFilter === "paid") return entry.from_user_id === user.id;
        return entry.from_user_id === user.id || entry.to_user_id === user.id;
      }
      const paidByUser = entry.payments.some((payment) => payment.user_id === user.id);
      if (historyFilter === "paid") return paidByUser;
      const sharedWithUser =
        entry.line_items.some((item) =>
          item.line_item_shares.some((share) => share.user_id === user.id),
        ) ||
        entry.adjustments.some((adjustment) =>
          adjustment.adjustment_shares.some((share) => share.user_id === user.id),
        );
      return paidByUser || sharedWithUser;
    });
  }, [entries, historyFilter, user]);
  const groupedEntries = filteredEntries.reduce<Map<string, typeof filteredEntries>>(
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
    const visibleEntries = filteredEntries.slice(0, 24);
    void prefetchExpenses(
      visibleEntries
        .filter((entry) => entry.type === "expense" && entry.sync_status !== "pending")
        .map((entry) => entry.id),
    );
    void prefetchSettlements(
      visibleEntries
        .filter((entry) => entry.type === "settlement")
        .map((entry) => entry.id),
    );
  }, [filteredEntries]);

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

  function showLocalToast(message: string) {
    setLocalToast(message);
    window.setTimeout(() => setLocalToast(null), 2400);
  }

  async function cancelPendingExpense(entryId: string) {
    await removeQueuedExpense(entryId);
    showLocalToast("Local expense removed.");
  }

  async function retryPendingExpenses() {
    const result = await flushExpenseQueue();
    if (result.synced > 0) {
      void refreshVisibleData();
      showLocalToast(
        result.synced === 1
          ? "Expense synced."
          : `${result.synced} expenses synced.`,
      );
    } else {
      showLocalToast("Still waiting to sync. Check your connection.");
    }
  }

  function historyKey(entry: (typeof entries)[number]) {
    return `${entry.type}:${entry.id}`;
  }

  async function reorderTransaction(
    draggedKey: string | null,
    target: (typeof entries)[number],
    placement: DropPlacement,
  ) {
    if (!draggedKey) return;
    const dragged = entries.find((entry) => historyKey(entry) === draggedKey);
    if (!dragged || historyKey(dragged) === historyKey(target)) return;

    const reference = new Date(target.created_at);
    if (Number.isNaN(reference.getTime())) return;
    reference.setMinutes(reference.getMinutes() + (placement === "before" ? 1 : -1));
    const rpcName =
      dragged.type === "settlement"
        ? "update_settlement_display_timestamp"
        : "update_entry_display_timestamp";
    const params =
      dragged.type === "settlement"
        ? {
            p_settlement_id: dragged.id,
            p_date: target.date,
            p_created_at: reference.toISOString(),
          }
        : {
            p_entry_id: dragged.id,
            p_date: target.date,
            p_created_at: reference.toISOString(),
          };
    const { error } = await supabase.rpc(rpcName, params);
    if (error) {
      showLocalToast(error.message);
      return;
    }
    void refreshVisibleData();
  }

  function clearLongPressTimer() {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function resetDragState() {
    clearLongPressTimer();
    dragPointerId.current = null;
    dragStart.current = null;
    dragActive.current = false;
    setDraggingHistoryId(null);
    setDropPlacement(null);
  }

  function updateDropPlacement(clientX: number, clientY: number) {
    const activeKey = draggingHistoryId ?? dragStart.current?.key;
    if (!activeKey) return;
    const target = document
      .elementFromPoint(clientX, clientY)
      ?.closest<HTMLElement>("[data-history-drop-key]");
    const key = target?.dataset.historyDropKey;
    if (!target || !key || key === activeKey) {
      setDropPlacement(null);
      return;
    }

    const rect = target.getBoundingClientRect();
    const position: DropPlacement = clientY < rect.top + rect.height / 2 ? "before" : "after";
    setDropPlacement((current) =>
      current?.key === key && current.position === position ? current : { key, position },
    );
  }

  function startHistoryPress(event: ReactPointerEvent<HTMLElement>, key: string) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    clearLongPressTimer();
    dragPointerId.current = event.pointerId;
    dragStart.current = { key, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    longPressTimer.current = window.setTimeout(() => {
      dragActive.current = true;
      suppressNextClick.current = true;
      setDraggingHistoryId(key);
      setDropPlacement(null);
      navigator.vibrate?.(10);
    }, 260);
  }

  function moveHistoryPress(event: ReactPointerEvent<HTMLElement>) {
    if (event.pointerId !== dragPointerId.current) return;
    const start = dragStart.current;
    if (!start) return;

    const moved =
      Math.abs(event.clientX - start.x) > 8 || Math.abs(event.clientY - start.y) > 8;
    if (!dragActive.current && moved) {
      clearLongPressTimer();
      return;
    }
    if (!dragActive.current) return;

    event.preventDefault();
    updateDropPlacement(event.clientX, event.clientY);
  }

  function finishHistoryPress(event: ReactPointerEvent<HTMLElement>) {
    if (event.pointerId !== dragPointerId.current) return;
    clearLongPressTimer();
    if (dragActive.current) {
      event.preventDefault();
      const activeKey = draggingHistoryId ?? dragStart.current?.key ?? null;
      const target = entries.find((entry) => historyKey(entry) === dropPlacement?.key);
      if (target && dropPlacement) {
        void reorderTransaction(activeKey, target, dropPlacement.position);
      }
      window.setTimeout(() => {
        suppressNextClick.current = false;
      }, 0);
    }
    resetDragState();
  }

  function cancelHistoryPress() {
    resetDragState();
    window.setTimeout(() => {
      suppressNextClick.current = false;
    }, 0);
  }

  function suppressDragClick(event: ReactMouseEvent<HTMLElement>) {
    if (!suppressNextClick.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressNextClick.current = false;
  }

  function reorderProps(key: string) {
    return {
      "data-history-drop-key": key,
      onContextMenu: (event: ReactMouseEvent<HTMLElement>) => event.preventDefault(),
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => startHistoryPress(event, key),
      onPointerMove: moveHistoryPress,
      onPointerUp: finishHistoryPress,
      onPointerCancel: cancelHistoryPress,
      onLostPointerCapture: cancelHistoryPress,
      onClick: suppressDragClick,
      draggable: false,
    };
  }

  function DropIndicator({ entryKey, position }: { entryKey: string; position: DropPlacement }) {
    if (dropPlacement?.key !== entryKey || dropPlacement.position !== position) return null;
    return (
      <div className="pointer-events-none -mx-1 flex h-3 items-center px-1">
        <div className="h-1 w-full rounded-full bg-teal shadow-[0_0_0_4px_rgba(15,143,127,0.14)]" />
      </div>
    );
  }

  return (
    <PageShell padded={false} wide className={routeMotion}>
      <TripTabHeader
        tripId={trip.id}
        title={trip.name}
        subtitle={trip.location_name}
      />

      <CoverPhoto
        url={trip.cover_photo_url}
        label={`trip cover — ${trip.location_name ?? trip.name}`}
        className="h-[150px] w-full"
      />

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
                { value: "", label: "Orig currency" },
                { value: trip.default_currency, label: `Trip default · ${trip.default_currency}` },
                ...(user ? [{ value: user.preferred_currency, label: `Preferred · ${user.preferred_currency}` }] : []),
              ]}
              aria-label="Transaction display currency"
            />
          )}
        </div>

        {entries.length > 0 && (
          <div className="-mt-1 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {HISTORY_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setHistoryFilter(filter.value)}
                className={clsx(
                  "shrink-0 rounded-pill px-3 py-1.5 text-[11.5px] font-extrabold transition",
                  historyFilter === filter.value
                    ? "bg-teal-tint text-teal-dark"
                    : "bg-card text-secondary shadow-[var(--shadow-card)]",
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
        )}

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
          filteredEntries.length > 0 ? (
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
                const entryKey = historyKey(entry);
                return (
                  <div key={`settlement-${entry.id}`}>
                    <DropIndicator entryKey={entryKey} position="before" />
                    <Link
                      to={`/trips/${trip.id}/settlements/${entry.id}`}
                      state={{ transition: "sheet" }}
                      {...reorderProps(entryKey)}
                      className={clsx(
                        "flex select-none items-center gap-3 py-3.5 [-webkit-touch-callout:none] [-webkit-user-select:none]",
                        index < dateEntries.length - 1 && "border-b border-hairline",
                        draggingHistoryId === entryKey && "scale-[0.99] bg-teal-tint/20 opacity-40",
                      )}
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
                    <DropIndicator entryKey={entryKey} position="after" />
                  </div>
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
              const payers = entry.payments.flatMap((payment) => {
                if (payment.user) return [payment.user];
                const member = trip.members.find(
                  (tripMember) => tripMember.id === payment.user_id,
                );
                return member ? [member] : [];
              });
              const payerNames = payers.map((payer) => payer.name).join(", ");
              const unread = unreadEntryIds.has(entry.id);
              const pending = entry.sync_status === "pending";
              const categoryName =
                entry.category?.name ??
                categories.find((category) => category.id === entry.category_id)?.name ??
                "Other";
              const subtitle = entry.payee
                ? payerNames
                  ? `Paid to ${entry.payee} by ${payerNames}`
                  : `Paid to ${entry.payee}`
                : payerNames
                  ? `Paid by ${payerNames}`
                  : "No payer";
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

              const rowClass =
                "flex items-center gap-3 py-3.5" +
                (index < dateEntries.length - 1 ? " border-b border-hairline" : "");
              const entryKey = historyKey(entry);
              const rowContent = (
                <>
                  <div className="grid size-10 flex-none place-items-center rounded-[13px] bg-tile text-[17px]">
                    <CategoryIcon category={categoryName} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14.5px] font-bold">{entry.description}</div>
                    <div className="flex items-center gap-1.5 text-[11.5px] text-secondary">
                      {pending && (
                        <span className="flex-none rounded-full bg-teal-tint px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.04em] text-teal-dark">
                          Syncing
                        </span>
                      )}
                      <span className="truncate">{subtitle}</span>
                    </div>
                    {pending && (
                      <div className="mt-1.5 flex items-center gap-3">
                        <button
                          onClick={() => void retryPendingExpenses()}
                          className="text-[11px] font-extrabold text-teal-dark"
                        >
                          Retry
                        </button>
                        <button
                          onClick={() => void cancelPendingExpense(entry.id)}
                          className="text-[11px] font-extrabold text-owe"
                        >
                          Cancel local copy
                        </button>
                      </div>
                    )}
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
                </>
              );

              if (pending) {
                return (
                  <div key={entry.id} className={rowClass}>
                    {rowContent}
                  </div>
                );
              }

              return (
                <div key={entry.id}>
                  <DropIndicator entryKey={entryKey} position="before" />
                  <Link
                    to={`/trips/${trip.id}/expenses/${entry.id}`}
                    state={{ transition: "sheet" }}
                    {...reorderProps(entryKey)}
                    className={clsx(
                      rowClass,
                      "select-none [-webkit-touch-callout:none] [-webkit-user-select:none]",
                      draggingHistoryId === entryKey && "scale-[0.99] bg-teal-tint/20 opacity-40",
                    )}
                  >
                    {rowContent}
                  </Link>
                  <DropIndicator entryKey={entryKey} position="after" />
                </div>
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
              No matching transactions for this filter.
            </div>
          )
        ) : (
          <div className="bg-card rounded-[18px] p-6 text-center text-secondary text-[13.5px] shadow-[var(--shadow-card)]">
            No expenses yet. Tap + to add the first one.
          </div>
        )}
      </div>
      <Toast message={localToast ?? toastMessage} />
    </PageShell>
  );
}
