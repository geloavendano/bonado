import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useTrips, type TripWithMembers } from "@/hooks/useTrips";
import { PageShell } from "@/components/layout/PageShell";
import { StickyActionBar } from "@/components/layout/StickyActionBar";
import { Avatar } from "@/components/ui/Avatar";
import { AvatarStack } from "@/components/ui/AvatarStack";
import { CoverPhoto } from "@/components/ui/CoverPhoto";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { buttonClasses } from "@/components/ui/Button";
import { GuestBanner } from "@/components/trip/GuestBanner";
import { formatMoney } from "@/lib/money";

function tripDateRange(trip: TripWithMembers): string {
  return new Date(trip.created_at).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}

function BalanceStatus({ trip }: { trip: TripWithMembers }) {
  if (trip.yourBalance === 0) {
    return <span className="text-[13px] font-semibold text-faint">Settled ✓</span>;
  }
  if (trip.yourBalance > 0) {
    return (
      <span className="text-[13px] font-bold text-owed">
        You're owed {formatMoney(trip.yourBalance, trip.default_currency)}
      </span>
    );
  }
  return (
    <span className="text-[13px] font-bold text-owe">
      You owe {formatMoney(-trip.yourBalance, trip.default_currency)}
    </span>
  );
}

function CurrentTripCard({ trip }: { trip: TripWithMembers }) {
  return (
    <Link to={`/trips/${trip.id}`} className="block">
      <Card className="rounded-[22px] overflow-hidden shadow-hero">
        <CoverPhoto
          url={trip.cover_photo_url}
          label={`trip cover — ${trip.location_name ?? trip.name}`}
          className="h-[170px]"
        />
        <div className="p-[18px] flex flex-col gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="flex-1 text-[19px] font-bold tracking-[-0.3px] truncate">
              {trip.name}
            </div>
            <Pill tone={trip.yourBalance < 0 ? "danger" : "teal"}>
              {trip.yourBalance === 0
                ? "Settled up"
                : trip.yourBalance > 0
                  ? `You're owed ${formatMoney(trip.yourBalance, trip.default_currency)}`
                  : `You owe ${formatMoney(-trip.yourBalance, trip.default_currency)}`}
            </Pill>
          </div>
          <div className="text-[13px] text-secondary">
            {[trip.location_name, tripDateRange(trip)].filter(Boolean).join(" · ")}
          </div>
          <AvatarStack people={trip.members} />
        </div>
      </Card>
    </Link>
  );
}

function TripRow({ trip }: { trip: TripWithMembers }) {
  return (
    <Link to={`/trips/${trip.id}`} className="block">
      <Card className="rounded-[18px] p-3 flex items-center gap-3">
        <CoverPhoto
          url={trip.cover_photo_url}
          label="cover"
          className="w-14 h-14 rounded-[14px] flex-none text-[9px]"
        />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-[15px] truncate">{trip.name}</div>
          <div className="text-[12.5px] text-secondary">
            {tripDateRange(trip)} · {trip.members.length}{" "}
            {trip.members.length === 1 ? "person" : "people"}
          </div>
        </div>
        <BalanceStatus trip={trip} />
      </Card>
    </Link>
  );
}

export function Dashboard() {
  const { user, signOut } = useAuth();
  const { trips, loading } = useTrips();

  const [currentTrip, ...restTrips] = trips;

  return (
    <PageShell>
      <div className="flex items-center justify-between pt-[18px] pb-1.5">
        <div className="text-2xl font-extrabold tracking-[-0.5px]">
          bonado<span className="text-teal">.</span>
        </div>
        {user && (
          <button onClick={() => void signOut()} title="Sign out">
            <Avatar name={user.name} seed={user.id} avatarUrl={user.avatar_url} size={38} />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3.5 pt-3.5 pb-20">
        <GuestBanner />

        {loading && (
          <div className="text-secondary text-sm py-10 text-center">Loading trips…</div>
        )}

        {!loading && trips.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="text-[17px] font-bold">No trips yet</div>
            <p className="text-secondary text-[14px] max-w-[280px]">
              Create your first trip to start splitting expenses with friends.
            </p>
          </div>
        )}

        {!loading && currentTrip && (
          <>
            <SectionLabel>Current trip</SectionLabel>
            <CurrentTripCard trip={currentTrip} />
          </>
        )}

        {!loading && restTrips.length > 0 && (
          <>
            <SectionLabel className="mt-1.5">All trips</SectionLabel>
            {restTrips.map((trip) => (
              <TripRow key={trip.id} trip={trip} />
            ))}
          </>
        )}

      </div>

      <StickyActionBar>
        <Link to="/trips/new" className={buttonClasses("primary", true)}>
          + Create trip
        </Link>
      </StickyActionBar>
    </PageShell>
  );
}
