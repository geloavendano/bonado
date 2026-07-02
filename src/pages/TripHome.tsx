import { useState } from "react";
import { Link } from "react-router-dom";
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
import { isEntryUnread } from "@/lib/entryReadState";

const CATEGORY_ICONS: Record<string, string> = {
  "Food & drink": "🍽",
  Transport: "🚕",
  Lodging: "🛏",
  Groceries: "🛒",
  Activities: "🎟",
  Other: "•••",
};

export function TripHome() {
  const trip = useTripLayout();
  const { user } = useAuth();
  const { entries, loading: entriesLoading, error: entriesError } =
    useRecentEntries(trip.id);
  const [copied, setCopied] = useState(false);
  const groupedEntries = entries.reduce<Map<string, typeof entries>>(
    (groups, entry) => {
      const group = groups.get(entry.date) ?? [];
      group.push(entry);
      groups.set(entry.date, group);
      return groups;
    },
    new Map(),
  );

  const inviteUrl = `${window.location.origin}/join/${trip.invite_link_token}`;

  async function shareInvite() {
    const shareData = {
      title: `Join ${trip!.name} on bonado`,
      text: `You're invited to ${trip!.name}`,
      url: inviteUrl,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // user cancelled or share failed — fall through to clipboard
      }
    }
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <PageShell padded={false}>
      <div className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-black/5 bg-bg/90 px-4 backdrop-blur-md">
        <Link
          to="/"
          className="grid size-9 place-items-center rounded-full bg-card text-secondary shadow-card"
          aria-label="Back to dashboard"
        >
          ←
        </Link>
        <div className="min-w-0 flex-1 truncate px-3 text-center text-[16px] font-extrabold">
          {trip.name}
        </div>
        <Link
          to={`/trips/${trip.id}/settings`}
          className="grid size-9 place-items-center rounded-full bg-card text-secondary shadow-card"
          aria-label="Trip settings"
        >
          ⚙︎
        </Link>
      </div>

      <div>
        <CoverPhoto
          url={trip.cover_photo_url}
          label={`trip cover — ${trip.location_name ?? trip.name}`}
          className="h-[150px] w-full"
        />
      </div>

      <div className="flex flex-col gap-3.5 px-6 pt-4 pb-24">
        <GuestBanner />

        <div>
          {trip.location_name && (
            <div className="text-[13px] font-semibold text-secondary">
              {trip.location_name}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <Link to={`/trips/${trip.id}/settings`} aria-label="View members">
            <AvatarStack people={trip.members} />
          </Link>
          <button
            onClick={() => void shareInvite()}
            className="ml-auto flex items-center gap-1.5 bg-card rounded-pill px-3.5 py-2 text-[13px] font-bold text-teal shadow-card"
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
              {trip.yourBalance === 0
                ? "Settled up"
                : trip.yourBalance > 0
                  ? `You're owed ${formatMoney(trip.yourBalance, trip.default_currency)}`
                  : `You owe ${formatMoney(-trip.yourBalance, trip.default_currency)}`}
            </div>
          </div>
          <div className="ml-auto text-[13.5px] font-bold text-teal">Details →</div>
        </Link>

        <div className="mt-0.5 flex items-baseline justify-between">
          <SectionLabel>Transaction history</SectionLabel>
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
                  <div className="sticky top-14 z-10 -mx-1 bg-bg/95 px-1 py-2.5 text-[11.5px] font-extrabold uppercase tracking-[0.07em] text-secondary backdrop-blur-md">
                    {dateLabel}
                  </div>
                  <div className="overflow-hidden rounded-[18px] bg-card px-4 shadow-card">
                    {dateEntries.map((entry, index) => {
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
              const payerNames = entry.payments
                .flatMap((payment) => (payment.user ? [payment.user.name] : []))
                .join(", ");
              const unread = Boolean(user && isEntryUnread(entry, user.id));

              return (
                <Link
                  key={entry.id}
                  to={`/trips/${trip.id}/expenses/${entry.id}`}
                  className={
                    "flex items-center gap-3 py-3.5" +
                    (index < dateEntries.length - 1 ? " border-b border-black/5" : "")
                  }
                >
                  <div className="grid size-10 flex-none place-items-center rounded-[13px] bg-tile text-[17px]">
                    {CATEGORY_ICONS[entry.category?.name ?? "Other"] ?? "•"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14.5px] font-bold">{entry.description}</div>
                    <div className="truncate text-[11.5px] text-secondary">
                      {payerNames ? `Paid by ${payerNames}` : "No payer"}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[14px] font-extrabold">
                      {formatMoney(yourShare, entry.currency)}
                    </div>
                    {yourPaid > 0 && (
                      <div className="text-[10.5px] font-semibold text-secondary">
                        Paid {formatMoney(yourPaid, entry.currency)}
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
          </div>
        ) : (
          <div className="bg-card rounded-[18px] p-6 text-center text-secondary text-[13.5px] shadow-card">
            No expenses yet. Tap + to add the first one.
          </div>
        )}
      </div>
    </PageShell>
  );
}
