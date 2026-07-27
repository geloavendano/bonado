import { useState } from "react";
import { Link } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "@/context/AuthContext";
import { useTrips, type TripWithMembers } from "@/hooks/useTrips";
import { PageShell } from "@/components/layout/PageShell";
import { StickyActionBar } from "@/components/layout/StickyActionBar";
import { AvatarStack } from "@/components/ui/AvatarStack";
import { CoverPhoto } from "@/components/ui/CoverPhoto";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { DashboardSkeleton } from "@/components/ui/Skeleton";
import { buttonClasses } from "@/components/ui/Button";
import { GuestBanner } from "@/components/trip/GuestBanner";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { AccountSettingsMenu } from "@/components/settings/AccountSettingsMenu";
import { NativeDashboardControls } from "@/components/native/NativeDashboardControls";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { formatMoney } from "@/lib/money";
import { useCurrencyRates } from "@/hooks/useCurrencyRates";
import { useRouteToast } from "@/hooks/useRouteToast";
import { Toast } from "@/components/ui/Toast";

function tripDateRange(trip: TripWithMembers): string | null {
  if (!trip.start_date || !trip.end_date) return null;
  const start = new Date(`${trip.start_date}T00:00:00`);
  const end = new Date(`${trip.end_date}T00:00:00`);
  const month = (date: Date) =>
    date.toLocaleDateString(undefined, { month: "short" });
  const day = (date: Date) =>
    new Intl.NumberFormat(undefined).format(date.getDate());
  const year = (date: Date) =>
    new Intl.NumberFormat(undefined, { useGrouping: false }).format(date.getFullYear());
  const sameDay = trip.start_date === trip.end_date;
  const sameMonth =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth();
  const sameYear = start.getFullYear() === end.getFullYear();

  if (sameDay) {
    return `${month(start)} ${day(start)}, ${year(start)}`;
  }
  if (sameMonth) {
    return `${month(start)} ${day(start)}–${day(end)}, ${year(end)}`;
  }
  if (sameYear) {
    return `${month(start)} ${day(start)}–${month(end)} ${day(end)}, ${year(end)}`;
  }
  return `${month(start)} ${day(start)}, ${year(start)}–${month(end)} ${day(end)}, ${year(end)}`;
}

function BalanceStatus({ trip, displayCurrency }: { trip: TripWithMembers; displayCurrency: string }) {
  const { rates } = useCurrencyRates(trip.default_currency);
  const currency = rates[displayCurrency] ? displayCurrency : trip.default_currency;
  const amount = trip.yourBalance * (rates[currency] ?? 1);
  if (trip.yourBalance === 0) {
    return <span className="text-[13px] font-semibold text-faint">Settled ✓</span>;
  }
  if (trip.yourBalance > 0) {
    return (
      <span className="text-[13px] font-bold text-owed">
        You're owed {formatMoney(amount, currency)}
      </span>
    );
  }
  return (
    <span className="text-[13px] font-bold text-owe">
      You owe {formatMoney(-amount, currency)}
    </span>
  );
}

function CurrentTripCard({ trip, displayCurrency }: { trip: TripWithMembers; displayCurrency: string }) {
  const { rates } = useCurrencyRates(trip.default_currency);
  const currency = rates[displayCurrency] ? displayCurrency : trip.default_currency;
  const amount = trip.yourBalance * (rates[currency] ?? 1);
  const dateRange = tripDateRange(trip);
  return (
    <Link to={`/trips/${trip.id}`} state={{ transition: "forward" }} className="block">
      <Card className="rounded-[22px] overflow-hidden shadow-[var(--shadow-hero)]">
        <CoverPhoto
          url={trip.cover_photo_url}
          label={`trip cover — ${trip.location_name ?? trip.name}`}
          className="h-[170px] w-full"
        />
        <div className="p-[18px] flex flex-col gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="min-w-0 flex-1 text-[19px] font-bold tracking-[-0.3px] truncate">
              {trip.name}
            </div>
            <Pill tone={trip.yourBalance < 0 ? "danger" : "teal"}>
              {trip.yourBalance === 0
                ? "Settled up"
                : trip.yourBalance > 0
                  ? `You're owed ${formatMoney(amount, currency)}`
                  : `You owe ${formatMoney(-amount, currency)}`}
            </Pill>
          </div>
          {(trip.location_name || dateRange) && (
            <div className="text-[13px] text-secondary">
              {[trip.location_name, dateRange].filter(Boolean).join(" · ")}
            </div>
          )}
          <AvatarStack people={trip.members} />
        </div>
      </Card>
    </Link>
  );
}

function TripRow({
  trip,
  displayCurrency,
  currentUserId,
}: {
  trip: TripWithMembers;
  displayCurrency: string;
  currentUserId?: string;
}) {
  const otherMembers = trip.members.filter((member) => member.id !== currentUserId);
  const dateRange = tripDateRange(trip);
  return (
    <Link to={`/trips/${trip.id}`} state={{ transition: "forward" }} className="block">
      <Card className="min-w-0 overflow-hidden rounded-[18px] p-3 flex items-center gap-3">
        <CoverPhoto
          url={trip.cover_photo_url}
          label="cover"
          className="w-14 h-14 rounded-[14px] flex-none text-[9px]"
        />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-[15px] truncate">{trip.name}</div>
          {dateRange && (
            <div className="text-[12.5px] text-secondary">{dateRange}</div>
          )}
          {otherMembers.length > 0 && (
            <div className="mt-1.5">
              <AvatarStack people={otherMembers} size={24} max={3} />
            </div>
          )}
        </div>
        <div className="max-w-[34%] shrink-0 text-right">
          <BalanceStatus trip={trip} displayCurrency={displayCurrency} />
        </div>
      </Card>
    </Link>
  );
}

export function Dashboard() {
  const { user, signOut, deleteAccount, updateProfile } = useAuth();
  const { trips, loading, loadingMore, hasMore, loadMore } = useTrips();
  const toastMessage = useRouteToast();
  const [confirmingAccountDelete, setConfirmingAccountDelete] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [accountDeleteError, setAccountDeleteError] = useState<string | null>(null);

  async function handleDeleteAccount() {
    setDeletingAccount(true);
    const errorMessage = await deleteAccount();
    setDeletingAccount(false);
    if (errorMessage) {
      setAccountDeleteError(errorMessage);
      return;
    }
    window.location.assign("/login");
  }

  const [currentTrip, ...restTrips] = trips;
  const nativeDashboardControlsEnabled = Capacitor.getPlatform() === "ios";

  return (
    <PageShell className="lg:max-w-[880px]">
      <div className="flex items-center justify-between pt-[max(18px,env(safe-area-inset-top))] pb-1.5">
        <div className="text-2xl font-extrabold tracking-[-0.5px]">
          bonado<span className="text-teal">.</span>
        </div>
        {user && (
          <div className="flex items-center gap-2.5">
            {nativeDashboardControlsEnabled && (
              <NativeDashboardControls
                avatarUrl={user.avatar_url}
                name={user.name}
              />
            )}
            <NotificationBell
              buttonClassName={
                nativeDashboardControlsEnabled
                  ? "hidden"
                  : undefined
              }
              nativeOpenTarget={nativeDashboardControlsEnabled}
            />
            <AccountSettingsMenu
              user={user}
              updateProfile={updateProfile}
              signOut={signOut}
              onDeleteAccount={() => setConfirmingAccountDelete(true)}
              buttonClassName={
                nativeDashboardControlsEnabled
                  ? "hidden"
                  : undefined
              }
            />
          </div>
        )}
      </div>

      {confirmingAccountDelete && (
        <ConfirmDialog
          title="Delete your account?"
          description={
            accountDeleteError ??
            "Your account and sign-in are permanently removed. Trips where you're the only member are deleted; in shared trips your expenses and settlements stay visible under an unclaimed placeholder with your name. This can't be undone."
          }
          confirmLabel={deletingAccount ? "Deleting…" : "Delete account"}
          destructive
          busy={deletingAccount}
          onConfirm={() => void handleDeleteAccount()}
          onCancel={() => {
            setConfirmingAccountDelete(false);
            setAccountDeleteError(null);
          }}
        />
      )}

      <div className="flex flex-col gap-3.5 pt-3.5 pb-20">
        <GuestBanner />

        {loading && (
          <DashboardSkeleton />
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
          <div className="flex flex-col gap-3.5 lg:grid lg:grid-cols-[1.1fr_1fr] lg:items-start lg:gap-x-8">
            <div className="flex flex-col gap-3.5 min-w-0 lg:sticky lg:top-4">
              <CurrentTripCard trip={currentTrip} displayCurrency={user?.preferred_currency ?? currentTrip.default_currency} />
            </div>

            {restTrips.length > 0 && (
              <div className="flex flex-col gap-3.5 min-w-0">
                {restTrips.map((trip) => (
                  <TripRow
                    key={trip.id}
                    trip={trip}
                    displayCurrency={user?.preferred_currency ?? trip.default_currency}
                    currentUserId={user?.id}
                  />
                ))}
                {hasMore && (
                  <button
                    onClick={() => void loadMore()}
                    disabled={loadingMore}
                    className="rounded-[16px] bg-card px-4 py-3 text-[13px] font-bold text-teal shadow-[var(--shadow-card)] disabled:opacity-50"
                  >
                    {loadingMore ? "Loading…" : "Load more trips"}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

      </div>

      <StickyActionBar fade>
        <Link
          to="/trips/new"
          state={{ transition: "sheet" }}
          className={buttonClasses("primary", true)}
        >
          + Create trip
        </Link>
      </StickyActionBar>
      <Toast message={toastMessage} />
    </PageShell>
  );
}
