import { Navigate, Outlet, useLocation, useParams } from "react-router-dom";
import { PageShell } from "@/components/layout/PageShell";
import { TripNav } from "@/components/trip/TripNav";
import { TripsRail } from "@/components/trip/TripsRail";
import { BalanceRail } from "@/components/trip/BalanceRail";
import { BalanceRailSkeleton, TripPageSkeleton } from "@/components/ui/Skeleton";
import { useTrip } from "@/hooks/useTrip";
import { useTripTabSwipe } from "@/hooks/useTripTabSwipe";

export function TripLayout() {
  const { tripId } = useParams<{ tripId: string }>();
  const location = useLocation();
  const { trip, loading } = useTrip(tripId);
  const activeTrip = trip?.id === tripId ? trip : null;

  const showTabChrome =
    !location.pathname.includes("/expenses/") &&
    !location.pathname.includes("/settlements/");
  const tabSwipe = useTripTabSwipe(tripId ?? "", showTabChrome);

  if (!loading && !trip) return <Navigate to="/" replace />;

  return (
    <>
      <div className="lg:mx-auto lg:flex lg:max-w-[1180px] lg:items-start">
        {showTabChrome && <TripsRail activeTripId={tripId ?? ""} />}
        <div className="lg:min-w-0 lg:flex-1" {...tabSwipe}>
          {loading || !activeTrip ? (
            <PageShell padded={false} wide>
              <TripPageSkeleton cover />
            </PageShell>
          ) : (
            <Outlet context={activeTrip} />
          )}
        </div>
        {showTabChrome &&
          (loading || !activeTrip ? (
            <BalanceRailSkeleton />
          ) : (
            <BalanceRail trip={activeTrip} />
          ))}
      </div>
      {showTabChrome && <TripNav tripId={tripId ?? ""} />}
    </>
  );
}
