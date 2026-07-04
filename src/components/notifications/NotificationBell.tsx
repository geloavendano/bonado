import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { Avatar } from "@/components/ui/Avatar";
import {
  useNotifications,
  type NotificationItem,
} from "@/hooks/useNotifications";
import { formatMoney } from "@/lib/money";
import { timeAgo } from "@/lib/timeAgo";
import { useOverlayA11y } from "@/hooks/useOverlayA11y";

function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function describe(notification: NotificationItem): {
  title: string;
  detail: string | null;
} {
  const actor = notification.actor?.name ?? "Someone";
  const expense = notification.entry?.description ?? "an expense";
  const amount = notification.settlement
    ? formatMoney(
        Number(notification.settlement.amount),
        notification.trip?.default_currency ?? "USD",
      )
    : null;
  const commentBody =
    notification.comment?.body.replace(
      /@\[([0-9a-f-]{36})\]/gi,
      (_, id: string) =>
        `@${
          notification.comment?.comment_mentions.find(
            (mention) => mention.user?.id === id,
          )?.user?.name ?? "Former member"
        }`,
    ) ?? null;

  switch (notification.kind) {
    case "expense_created":
      return { title: `${actor} added an expense`, detail: expense };
    case "expense_edited":
      return { title: `${actor} updated an expense`, detail: expense };
    case "expense_deleted":
      return { title: `${actor} deleted an expense`, detail: expense };
    case "settlement_created":
      return { title: `${actor} recorded a settlement`, detail: amount };
    case "settlement_edited":
      return { title: `${actor} updated a settlement`, detail: amount };
    case "settlement_deleted":
      return { title: `${actor} deleted a settlement`, detail: null };
    case "comment_added":
      return {
        title: `${actor} commented on ${notification.entry ? `"${expense}"` : "a settlement"}`,
        detail: commentBody,
      };
    case "comment_mention":
      return {
        title: `${actor} mentioned you in a comment`,
        detail: commentBody,
      };
  }
}

export function NotificationBell() {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    markRead,
    markAllRead,
  } = useNotifications();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useOverlayA11y<HTMLDivElement>(open, () => setOpen(false));

  function openNotification(notification: NotificationItem) {
    setOpen(false);
    void markRead(notification.id);
    if (notification.entry_id) {
      const deleted =
        notification.kind === "expense_deleted" ||
        notification.entry?.status === "deleted";
      navigate(
        deleted
          ? `/trips/${notification.trip_id}`
          : `/trips/${notification.trip_id}/expenses/${notification.entry_id}`,
      );
    } else if (notification.settlement_id) {
      navigate(
        `/trips/${notification.trip_id}/settlements/${notification.settlement_id}`,
      );
    } else {
      navigate(`/trips/${notification.trip_id}`);
    }
  }

  const bellRect = open ? containerRef.current?.getBoundingClientRect() : null;
  const desktopPanelStyle =
    typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches
      ? {
          top: (bellRect?.bottom ?? 48) + 8,
          right: Math.max(12, window.innerWidth - (bellRect?.right ?? window.innerWidth)),
        }
      : undefined;

  return (
    <div ref={containerRef} className="relative z-30">
      <button
        onClick={() => setOpen((value) => !value)}
        aria-label={
          unreadCount > 0
            ? `Notifications (${unreadCount} unread)`
            : "Notifications"
        }
        aria-expanded={open}
        className="relative grid size-[38px] place-items-center rounded-full bg-card text-ink shadow-[var(--shadow-card)]"
      >
        <BellIcon className="size-[19px]" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-owe px-1 text-[9.5px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && createPortal(
        <>
          <div
            className="fixed inset-0 z-[100] bg-black/40 lg:bg-transparent"
            onPointerDown={() => setOpen(false)}
          />
          <div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Notifications"
            style={desktopPanelStyle}
            className="motion-reveal fixed inset-x-0 bottom-0 z-[110] max-h-[70dvh] overflow-y-auto rounded-t-[26px] bg-card p-4 pb-[max(16px,env(safe-area-inset-bottom))] shadow-[var(--shadow-sheet)] lg:inset-x-auto lg:bottom-auto lg:max-h-[480px] lg:w-[350px] lg:rounded-[18px] lg:p-3 lg:shadow-[var(--shadow-floating)]"
          >
            <div className="flex items-center justify-between px-1 pb-2">
              <div className="text-[14px] font-extrabold">Notifications</div>
              {unreadCount > 0 && (
                <button
                  onClick={() => void markAllRead()}
                  className="text-[12px] font-bold text-teal"
                >
                  Mark all as read
                </button>
              )}
            </div>

            {!loading && unreadCount === 0 && (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <BellIcon className="size-7 text-faint" />
                <div className="text-[13.5px] font-bold">
                  You're all caught up
                </div>
                <p className="text-[12px] text-secondary">
                  Updates to your expenses and settlements will show up here.
                </p>
              </div>
            )}

            {notifications.map((notification, index) => {
              const { title, detail } = describe(notification);
              return (
                <button
                  key={notification.id}
                  onClick={() => openNotification(notification)}
                  className={
                    "flex w-full items-start gap-3 px-1 py-3 text-left" +
                    (index < notifications.length - 1
                      ? " border-b border-hairline"
                      : "")
                  }
                >
                  <Avatar
                    name={notification.actor?.name ?? "Member"}
                    seed={notification.actor?.id}
                    avatarUrl={notification.actor?.avatar_url}
                    size={32}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold leading-snug">
                      {title}
                    </div>
                    {detail && (
                      <div className="truncate text-[12px] text-secondary">
                        {detail}
                      </div>
                    )}
                    <div className="mt-0.5 text-[10.5px] text-faint">
                      {notification.trip?.name ? `${notification.trip.name} · ` : ""}
                      {timeAgo(notification.created_at)}
                    </div>
                  </div>
                </button>
              );
            })}
            {hasMore && (
              <button
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="w-full py-3 text-center text-[12px] font-bold text-teal disabled:opacity-50"
              >
                {loadingMore ? "Loading…" : "Load more notifications"}
              </button>
            )}
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}
