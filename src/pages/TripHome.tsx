import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { Capacitor } from "@capacitor/core";
import { PageShell } from "@/components/layout/PageShell";
import { CoverPhoto } from "@/components/ui/CoverPhoto";
import { AvatarStack } from "@/components/ui/AvatarStack";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { useTripLayout } from "@/components/trip/useTripLayout";
import { GuestBanner } from "@/components/trip/GuestBanner";
import { Skeleton } from "@/components/ui/Skeleton";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useRecentEntries } from "@/hooks/useRecentEntries";
import { formatMoney } from "@/lib/money";
import { useAuth } from "@/context/AuthContext";
import { Toast, type ToastTone } from "@/components/ui/Toast";
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
import { NativeTopControls } from "@/components/native/NativeTopControls";
import { SearchIcon } from "@/components/ui/SearchIcon";
import { CloseIcon } from "@/components/ui/CloseIcon";
import { useTransactionSearch } from "@/hooks/useTransactionSearch";
import { sumDayShares } from "@/lib/moneyMath";

type HistoryFilter = "all" | "paid" | "created" | "involving";
type DropPlacement = "before" | "after";

const HISTORY_FILTERS: { value: HistoryFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "paid", label: "Paid" },
  { value: "created", label: "Created" },
  { value: "involving", label: "Involves Me" },
];

export function TripHome() {
  const routeMotion = useRouteMotion("forward");
  const trip = useTripLayout();
  const { user } = useAuth();
  const nativeTopControlsEnabled = Capacitor.getPlatform() === "ios";
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
  const [compactHeaderVisible, setCompactHeaderVisible] = useState(false);
  const [localToast, setLocalToast] = useState<{ message: string; tone: ToastTone } | null>(null);
  const [displayCurrency, setDisplayCurrency] = useTripDisplayCurrency({
    tripId: trip.id,
    defaultCurrency: "",
    scope: "entries",
    allowOriginal: true,
  });
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const search = useTransactionSearch(trip.id, searchQuery, {
    categories,
    members: trip.members,
  });
  const [draggingHistoryId, setDraggingHistoryId] = useState<string | null>(null);
  const [dropPlacement, setDropPlacement] = useState<{
    key: string;
    position: DropPlacement;
  } | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const dragPointerId = useRef<number | null>(null);
  const dragStart = useRef<{ key: string; x: number; y: number } | null>(null);
  const dragActive = useRef(false);
  const dropPlacementRef = useRef<{
    key: string;
    position: DropPlacement;
  } | null>(null);
  const historyRowRefs = useRef(new Map<string, HTMLElement>());
  const blockedHintTimer = useRef<number | null>(null);
  const blockedHintStart = useRef<{ x: number; y: number } | null>(null);
  const suppressNextClick = useRef(false);
  const toastMessage = useRouteToast();
  // Search replaces the paginated feed; the filter chips then narrow whichever
  // feed is showing, so the two compose instead of fighting.
  const feedEntries = search.active ? search.entries : entries;
  const reorderEnabled = !search.active && historyFilter === "all";
  const filteredEntries = useMemo(() => {
    if (!user || historyFilter === "all") return feedEntries;
    return feedEntries.filter((entry) => {
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
  }, [feedEntries, historyFilter, user]);
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
  const balanceStatus =
    yourBalance === 0 ? "Settled up" : yourBalance > 0 ? "You're owed" : "You owe";
  const balanceAmount =
    yourBalance === 0
      ? formatMoney(0, balanceCurrency)
      : formatMoney(Math.abs(displayedBalance), balanceCurrency);

  const inviteUrl = buildInviteUrl(trip.invite_link_token);

  // `touch-action` is locked in by the browser when a gesture starts, so the
  // row's `.is-reordering { touch-action: none }` arrives too late — the finger
  // is already committed to panning by the time the long-press fires, and the
  // drag just scrolls the page. Only a non-passive touchmove listener can
  // cancel an in-flight scroll, so attach one for the duration of the drag.
  useEffect(() => {
    if (!draggingHistoryId) return;
    const blockScroll = (event: TouchEvent) => event.preventDefault();
    document.addEventListener("touchmove", blockScroll, { passive: false });
    return () => document.removeEventListener("touchmove", blockScroll);
  }, [draggingHistoryId]);

  useEffect(() => {
    if (!searchOpen) {
      setSearchQuery("");
      return;
    }
    // preventScroll: the page must not jump under the sticky header when the
    // on-screen keyboard opens.
    searchInputRef.current?.focus({ preventScroll: true });
  }, [searchOpen]);

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

  useEffect(() => {
    let frame = 0;

    function updateHeaderVisibility() {
      setCompactHeaderVisible(window.scrollY > 250);
      frame = 0;
    }

    function onScroll() {
      if (frame) return;
      frame = window.requestAnimationFrame(updateHeaderVisibility);
    }

    updateHeaderVisibility();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
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

  function showLocalToast(message: string, tone: ToastTone = "success") {
    setLocalToast({ message, tone });
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

  function formatMemberReference(member?: { id: string; name: string } | null) {
    if (!member) return "Member";
    return member.id === user?.id ? "you" : member.name;
  }

  async function reorderTransaction(
    draggedKey: string | null,
    target: (typeof entries)[number],
    placement: DropPlacement,
  ) {
    if (!draggedKey || !reorderEnabled) return;
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

  function setDropPlacementState(
    next: {
      key: string;
      position: DropPlacement;
    } | null,
  ) {
    dropPlacementRef.current = next;
    setDropPlacement((current) =>
      current?.key === next?.key && current?.position === next?.position ? current : next,
    );
  }

  function resetDragState() {
    clearLongPressTimer();
    dragPointerId.current = null;
    dragStart.current = null;
    dragActive.current = false;
    setDraggingHistoryId(null);
    setDropPlacementState(null);
  }

  function resolveDropPlacement(clientY: number) {
    const activeKey = draggingHistoryId ?? dragStart.current?.key;
    if (!activeKey) return null;

    let closest:
      | {
          key: string;
          position: DropPlacement;
          distance: number;
        }
      | null = null;

    for (const entry of filteredEntries) {
      const key = historyKey(entry);
      if (key === activeKey) continue;

      const node = historyRowRefs.current.get(key);
      if (!node) continue;

      const rect = node.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      const position: DropPlacement = clientY < midpoint ? "before" : "after";
      const distance =
        clientY >= rect.top && clientY <= rect.bottom
          ? 0
          : Math.min(Math.abs(clientY - rect.top), Math.abs(clientY - rect.bottom));

      if (!closest || distance < closest.distance) {
        closest = { key, position, distance };
      }
    }

    if (!closest) return null;
    return { key: closest.key, position: closest.position };
  }

  function updateDropPlacement(clientY: number) {
    setDropPlacementState(resolveDropPlacement(clientY));
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
      setDropPlacementState(null);
      navigator.vibrate?.(10);
    }, 260);
  }

  function moveHistoryPress(event: ReactPointerEvent<HTMLElement>) {
    if (event.pointerId !== dragPointerId.current) return;
    const start = dragStart.current;
    if (!start) return;

    const moved =
      Math.abs(event.clientX - start.x) > 16 || Math.abs(event.clientY - start.y) > 16;
    if (!dragActive.current && moved) {
      clearLongPressTimer();
      return;
    }
    if (!dragActive.current) return;

    event.preventDefault();
    updateDropPlacement(event.clientY);
  }

  function finishHistoryPress(event: ReactPointerEvent<HTMLElement>) {
    if (event.pointerId !== dragPointerId.current) return;
    clearLongPressTimer();
    if (dragActive.current) {
      event.preventDefault();
      const activeKey = draggingHistoryId ?? dragStart.current?.key ?? null;
      const finalDropPlacement = resolveDropPlacement(event.clientY) ?? dropPlacementRef.current;
      const target = entries.find((entry) => historyKey(entry) === finalDropPlacement?.key);
      if (target && finalDropPlacement) {
        void reorderTransaction(activeKey, target, finalDropPlacement.position);
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

  function clearBlockedHintTimer() {
    if (blockedHintTimer.current === null) return;
    window.clearTimeout(blockedHintTimer.current);
    blockedHintTimer.current = null;
  }

  function cancelBlockedHint() {
    clearBlockedHintTimer();
    blockedHintStart.current = null;
  }

  function reorderProps(key: string) {
    // Reordering positions an item ±1 minute from its *visible* neighbour, which
    // is meaningless when rows are hidden — the real neighbour may be filtered
    // out. Disable while searching or filtering rather than write a bogus order,
    // but still detect the long press so we can say why nothing happened.
    if (!reorderEnabled) {
      return {
        onContextMenu: (event: ReactMouseEvent<HTMLElement>) => event.preventDefault(),
        onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
          blockedHintStart.current = { x: event.clientX, y: event.clientY };
          clearBlockedHintTimer();
          blockedHintTimer.current = window.setTimeout(() => {
            showLocalToast(
              search.active
                ? "Clear the search to reorder transactions."
                : "Clear the filter to reorder transactions.",
              "info",
            );
          }, 260);
        },
        onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
          const start = blockedHintStart.current;
          if (!start) return;
          // A scroll shouldn't trigger the hint — only a deliberate hold.
          if (
            Math.abs(event.clientX - start.x) > 16 ||
            Math.abs(event.clientY - start.y) > 16
          ) {
            cancelBlockedHint();
          }
        },
        onPointerUp: cancelBlockedHint,
        onPointerCancel: cancelBlockedHint,
        draggable: false,
      };
    }
    return {
      "data-history-drop-key": key,
      ref: (node: HTMLElement | null) => {
        if (node) {
          historyRowRefs.current.set(key, node);
        } else {
          historyRowRefs.current.delete(key);
        }
      },
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
    <>
      <NativeTopControls
        settingsTo={`/trips/${trip.id}/settings`}
        tone={compactHeaderVisible ? "surface" : "photo"}
      />
      {typeof document !== "undefined" &&
        createPortal(
          <div
            className={clsx(
              "fixed inset-x-0 top-0 z-[95] flex min-h-[calc(72px+env(safe-area-inset-top))] items-center gap-3 border-b border-hairline bg-bg/96 px-6 pb-2 pt-[env(safe-area-inset-top)] shadow-[0_8px_24px_rgba(31,42,39,0.06)] backdrop-blur-xl transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.2,0.9,0.18,1)]",
              compactHeaderVisible
                ? "pointer-events-auto translate-y-0 opacity-100"
                : "pointer-events-none -translate-y-3 opacity-0",
            )}
            aria-hidden={!compactHeaderVisible}
          >
            <Link
              to="/"
              replace
              aria-label="Back to dashboard"
              className={clsx(
                "grid size-9 flex-none place-items-center rounded-full bg-card text-[15px] text-secondary shadow-[var(--shadow-card)]",
                nativeTopControlsEnabled && "pointer-events-none opacity-0",
              )}
            >
              ←
            </Link>
            <div className="flex min-w-0 flex-1 items-baseline justify-center gap-2 text-center">
              <div className="min-w-0 truncate text-[16px] font-bold">{trip.name}</div>
              {trip.location_name && (
                <div className="min-w-0 truncate text-[14px] font-semibold text-secondary">
                  {trip.location_name}
                </div>
              )}
            </div>
            <div
              className={clsx(
                "flex flex-none items-center gap-2",
                nativeTopControlsEnabled && "pointer-events-none opacity-0",
              )}
            >
              <NotificationBell />
              <Link
                to={`/trips/${trip.id}/settings`}
                aria-label="Trip settings"
                className="grid size-9 place-items-center rounded-full bg-card text-secondary shadow-[var(--shadow-card)]"
              >
                ⚙︎
              </Link>
            </div>
          </div>,
          document.body,
        )}

      <PageShell padded={false} wide className={routeMotion}>
      <div className="relative -mt-px h-[300px] overflow-visible bg-bg">
        <div className="absolute inset-0 overflow-hidden bg-tile">
          <CoverPhoto
            url={trip.cover_photo_url}
            label={`trip cover — ${trip.location_name ?? trip.name}`}
            className="h-full w-full object-cover object-center"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/50 via-black/10 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[calc(96px+env(safe-area-inset-top))] bg-gradient-to-b from-black/46 via-black/24 to-transparent backdrop-blur-[1.5px]" />
        </div>
        <div className="pointer-events-none absolute inset-x-0 -bottom-16 z-10 h-56 bg-gradient-to-b from-transparent via-bg/92 to-bg" />

        <div className="trip-top-nav absolute inset-x-0 top-0 z-20 flex min-h-[calc(72px+env(safe-area-inset-top))] items-center gap-3 px-6 pb-2 pt-[env(safe-area-inset-top)] text-white">
          <Link
            to="/"
            replace
            aria-label="Back to dashboard"
            className={clsx(
              "grid size-9 flex-none place-items-center rounded-full bg-white/86 text-[15px] text-[#1e2120] shadow-[0_8px_26px_rgba(0,0,0,0.16)] backdrop-blur-md",
              nativeTopControlsEnabled && "pointer-events-none opacity-0",
            )}
          >
            ←
          </Link>
          <div className="flex min-w-0 flex-1 items-baseline justify-center gap-3 text-center">
            <div className="truncate text-[17px] font-extrabold drop-shadow-[0_1px_12px_rgba(0,0,0,0.42)]">
              {trip.name}
            </div>
            {trip.location_name && (
              <div className="truncate text-[15px] font-semibold text-white/88 drop-shadow-[0_1px_10px_rgba(0,0,0,0.42)]">
                {trip.location_name}
              </div>
            )}
          </div>
          <div
            className={clsx(
              "flex flex-none items-center gap-2",
              nativeTopControlsEnabled && "pointer-events-none opacity-0",
            )}
          >
            <NotificationBell buttonClassName="relative grid size-9 place-items-center rounded-full bg-white/86 text-[#1e2120] shadow-[0_8px_26px_rgba(0,0,0,0.16)] backdrop-blur-md" />
            <Link
              to={`/trips/${trip.id}/settings`}
              aria-label="Trip settings"
              className="grid size-9 place-items-center rounded-full bg-white/86 text-[#747b77] shadow-[0_8px_26px_rgba(0,0,0,0.16)] backdrop-blur-md"
            >
              ⚙︎
            </Link>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-8 z-20 px-6">
          <div className="flex items-center gap-2">
            <Link to={`/trips/${trip.id}/settings`} aria-label="View members">
              <AvatarStack people={trip.members} size={31} />
            </Link>
            <button
              onClick={() => void shareInvite()}
              className="ml-auto flex h-9 items-center gap-1.5 rounded-pill bg-card/92 px-3 text-[12px] font-extrabold text-teal shadow-[0_10px_28px_rgba(31,42,39,0.13)] backdrop-blur-md"
            >
              {copied ? "Copied ✓" : "🔗 Invite"}
            </button>
            <CurrencySelect
              value={displayCurrency}
              onChange={setDisplayCurrency}
              currencies={currencies.length > 0 ? currencies : [trip.default_currency]}
              disabled={ratesLoading}
              pinned={[
                { value: "", label: "Orig curr." },
                { value: trip.default_currency, label: `Trip default · ${trip.default_currency}` },
                ...(user ? [{ value: user.preferred_currency, label: `Preferred · ${user.preferred_currency}` }] : []),
              ]}
              aria-label="Transaction display currency"
              className="max-w-[118px] shrink-0"
              selectClassName="h-9 max-w-[118px] bg-card/92 py-0 pl-3 pr-7 !text-[12px] !font-extrabold leading-none backdrop-blur-md shadow-[0_10px_28px_rgba(31,42,39,0.13)]"
              selectStyle={{ fontSize: 12 }}
            />
          </div>
        </div>
      </div>

      <div className="relative z-20 flex flex-col gap-3.5 px-6 pt-0 pb-24">
        <GuestBanner />

        <Link
          to={`/trips/${trip.id}/balances`}
          className="flex min-h-[86px] items-center rounded-[18px] bg-teal-tint px-[18px] py-[15px]"
        >
          <div>
            <div className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-teal-dark/70">
              {balanceStatus}
            </div>
            <div className="text-[19px] font-extrabold text-teal-dark">
              {balanceAmount}
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

        <div className="mt-0.5">
          <SectionLabel>Transaction history</SectionLabel>
        </div>

        {(entries.length > 0 || searchOpen) && (
          <div className="relative -mt-1">
          <div className="-mx-6 flex gap-1.5 overflow-x-auto px-6 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              aria-label="Search transactions"
              aria-expanded={searchOpen}
              onClick={() => setSearchOpen(true)}
              className="grid size-8 shrink-0 place-items-center rounded-pill bg-card text-secondary shadow-[var(--shadow-card)] transition"
            >
              <SearchIcon className="size-[15px]" />
            </button>
            {HISTORY_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => {
                  setHistoryFilter(
                    historyFilter === filter.value && filter.value !== "all"
                      ? "all"
                      : filter.value,
                  );
                }}
                className={clsx(
                  "flex h-8 shrink-0 items-center gap-1.5 rounded-pill px-3 text-[11px] font-extrabold transition",
                  historyFilter === filter.value
                    ? "bg-teal-tint text-teal-dark"
                    : "bg-card text-secondary shadow-[var(--shadow-card)]",
                )}
              >
                <span>{filter.label}</span>
                {historyFilter === filter.value && filter.value !== "all" && (
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label="Clear transaction filter"
                    onClick={(event) => {
                      event.stopPropagation();
                      setHistoryFilter("all");
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        setHistoryFilter("all");
                      }
                    }}
                    className="-mr-1 grid size-4 place-items-center rounded-full bg-teal-dark/10"
                  >
                    <CloseIcon />
                  </span>
                )}
              </button>
            ))}
          </div>

          {searchOpen && (
            <div
              // Spans the chip row's full bleed (-left-6/-right-6 mirroring its
              // -mx-6), otherwise a horizontally-scrolled chip shows in the
              // gutter beside the overlay on narrow screens.
              className="search-expand absolute inset-y-0 -left-6 -right-6 z-10 flex items-center bg-bg px-6 pb-1"
            >
              <div className="relative flex h-8 w-full items-center">
                <SearchIcon className="pointer-events-none absolute left-3 size-[15px] text-secondary" />
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Escape") return;
                    event.preventDefault();
                    if (searchQuery) {
                      setSearchQuery("");
                      return;
                    }
                    setSearchOpen(false);
                  }}
                  onBlur={(event) => {
                    if (searchQuery) return;
                    if (event.currentTarget.parentElement?.contains(event.relatedTarget)) return;
                    setSearchOpen(false);
                  }}
                  type="text"
                  inputMode="search"
                  autoComplete="off"
                  placeholder="Search transactions"
                  aria-label="Search transactions"
                  className="h-8 w-full rounded-pill bg-card pl-9 pr-9 !text-[13px] font-semibold text-ink shadow-[var(--shadow-card)] outline-none placeholder:font-medium placeholder:text-faint"
                />
                <button
                  type="button"
                  aria-label={searchQuery ? "Clear search" : "Close search"}
                  onClick={() => {
                    if (searchQuery) {
                      setSearchQuery("");
                      searchInputRef.current?.focus({ preventScroll: true });
                      return;
                    }
                    setSearchOpen(false);
                  }}
                  className="absolute right-2.5 grid size-5 place-items-center rounded-full text-secondary"
                >
                  <CloseIcon className="size-[11px]" />
                </button>
              </div>
            </div>
          )}
          </div>
        )}

        {searchOpen && search.active && !search.loading && (
          <div className="-mt-1 flex items-center gap-2 text-[11.5px] text-secondary">
            <span>
              {search.resultCount === 0
                ? "No matches"
                : `${filteredEntries.length} of ${search.resultCount} result${
                    search.resultCount === 1 ? "" : "s"
                  }`}
            </span>
            {historyFilter !== "all" && (
              <button
                type="button"
                onClick={() => setHistoryFilter("all")}
                className="flex items-center gap-1 rounded-pill bg-teal-tint px-2 py-0.5 text-[11px] font-extrabold text-teal-dark"
              >
                {HISTORY_FILTERS.find((filter) => filter.value === historyFilter)?.label}
                <CloseIcon className="size-[9px]" />
                <span className="sr-only">Clear filter</span>
              </button>
            )}
          </div>
        )}

        {entriesLoading || (search.active && search.loading && search.entries.length === 0) ? (
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

              // Totals the rows actually rendered for this date, so it can never
              // disagree with the column beneath it when a filter or search is on.
              const dayTotal = sumDayShares(
                dateEntries,
                user?.id,
                displayCurrency,
                trip.default_currency,
                rates,
              );

              return (
                <section key={date}>
                  <div className="sticky top-[calc(72px+env(safe-area-inset-top))] z-10 -mx-1 flex items-center justify-between gap-3 bg-bg/95 px-1 py-2.5 text-[11.5px] font-extrabold uppercase tracking-[0.07em] text-secondary backdrop-blur-md">
                    <span>{dateLabel}</span>
                    {dayTotal && (
                      <span
                        className="shrink-0 tabular-nums normal-case tracking-normal"
                        title={
                          dayTotal.approximate
                            ? "Approximate — converted from other currencies"
                            : undefined
                        }
                      >
                        {dayTotal.approximate && "≈ "}
                        {formatMoney(dayTotal.amount, dayTotal.currency)}
                      </span>
                    )}
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
                        "transaction-reorder-row flex select-none items-center gap-3 py-3.5 [-webkit-touch-callout:none] [-webkit-user-select:none]",
                        index < dateEntries.length - 1 && "border-b border-hairline",
                        draggingHistoryId === entryKey &&
                          "is-reordering scale-[0.99] bg-teal-tint/20 opacity-40",
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
                          {formatMemberReference(entry.from_user)} paid {formatMemberReference(entry.to_user)}
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
              const payerNames = payers.map((payer) => formatMemberReference(payer)).join(", ");
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
                    {yourShare === 0 && yourPaid === 0 ? (
                      <div className="text-[12.5px] font-extrabold text-faint">no share</div>
                    ) : (
                      <>
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
                      </>
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
                      "transaction-reorder-row select-none [-webkit-touch-callout:none] [-webkit-user-select:none]",
                      draggingHistoryId === entryKey &&
                        "is-reordering scale-[0.99] bg-teal-tint/20 opacity-40",
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
            {(search.active ? search.hasMore : hasMoreEntries) && (
              <button
                onClick={() =>
                  void (search.active ? search.loadMore() : loadMoreEntries())
                }
                disabled={search.active ? search.loadingMore : entriesLoadingMore}
                className="mt-3 rounded-[16px] bg-card px-4 py-3 text-[13px] font-bold text-teal shadow-[var(--shadow-card)] disabled:opacity-50"
              >
                {(search.active ? search.loadingMore : entriesLoadingMore)
                  ? "Loading…"
                  : "Load more transactions"}
              </button>
            )}
          </div>
          ) : (
            <div className="bg-card rounded-[18px] p-6 text-center text-secondary text-[13.5px] shadow-[var(--shadow-card)]">
              {search.active
                ? `No transactions match “${searchQuery.trim()}”.`
                : "No matching transactions for this filter."}
            </div>
          )
        ) : (
          <div className="bg-card rounded-[18px] p-6 text-center text-secondary text-[13.5px] shadow-[var(--shadow-card)]">
            No expenses yet. Tap + to add the first one.
          </div>
        )}
      </div>
      <Toast message={localToast?.message ?? toastMessage} tone={localToast?.tone ?? "success"} />
    </PageShell>
    </>
  );
}
