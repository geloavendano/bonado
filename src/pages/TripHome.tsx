import { useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { PageShell } from "@/components/layout/PageShell";
import { CoverPhoto } from "@/components/ui/CoverPhoto";
import { AvatarStack } from "@/components/ui/AvatarStack";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { TripNav } from "@/components/trip/TripNav";
import { GuestBanner } from "@/components/trip/GuestBanner";
import { useTrip } from "@/hooks/useTrip";
import { formatMoney } from "@/lib/money";

export function TripHome() {
  const { tripId } = useParams<{ tripId: string }>();
  const { trip, loading } = useTrip(tripId);
  const [copied, setCopied] = useState(false);

  if (loading) {
    return (
      <PageShell>
        <div className="text-secondary text-sm py-10 text-center">Loading trip…</div>
      </PageShell>
    );
  }

  if (!trip) {
    return <Navigate to="/" replace />;
  }

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
      <div className="relative">
        <CoverPhoto
          url={trip.cover_photo_url}
          label={`trip cover — ${trip.location_name ?? trip.name}`}
          className="h-[150px]"
        />
        <Link
          to="/"
          className="absolute top-3 left-4 w-[34px] h-[34px] rounded-full bg-card shadow-card flex items-center justify-center text-secondary"
          aria-label="Back to dashboard"
        >
          ←
        </Link>
        <Link
          to={`/trips/${trip.id}/settings`}
          className="absolute top-3 right-4 w-[34px] h-[34px] rounded-full bg-card shadow-card flex items-center justify-center text-secondary"
          aria-label="Trip settings"
        >
          ⚙︎
        </Link>
      </div>

      <div className="flex flex-col gap-3.5 px-6 pt-4 pb-24">
        <GuestBanner />

        <div>
          <div className="text-[21px] font-extrabold tracking-[-0.4px]">{trip.name}</div>
          {trip.location_name && (
            <div className="text-[13px] text-secondary mt-0.5">{trip.location_name}</div>
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

        <div className="flex items-baseline justify-between mt-0.5">
          <SectionLabel>Recent entries</SectionLabel>
        </div>

        <div className="bg-card rounded-[18px] p-6 text-center text-secondary text-[13.5px] shadow-card">
          No expenses yet. Tap + to add the first one.
        </div>
      </div>

      <TripNav tripId={trip.id} />
    </PageShell>
  );
}
