import { Navigate, Outlet, useLocation, useParams } from "react-router-dom";
import { PageShell } from "@/components/layout/PageShell";
import { TripNav } from "@/components/trip/TripNav";
import { TripsRail } from "@/components/trip/TripsRail";
import { BalanceRail } from "@/components/trip/BalanceRail";
import { TripPageSkeleton } from "@/components/ui/Skeleton";
import { useTrip } from "@/hooks/useTrip";

export function TripLayout() {
  const { tripId } = useParams<{ tripId: string }>();
  const location = useLocation();
  const { trip, loading } = useTrip(tripId);

  if (loading) {
    return (
      <PageShell padded={false}>
        <TripPageSkeleton cover />
      </PageShell>
    );
  }

  if (!trip) return <Navigate to="/" replace />;

  const showTabChrome =
    !location.pathname.includes("/expenses/") &&
    !location.pathname.includes("/settlements/");

  return (
    <>
      <div className="lg:mx-auto lg:flex lg:max-w-[1180px] lg:items-start">
        {showTabChrome && <TripsRail activeTripId={trip.id} />}
        <div className="lg:min-w-0 lg:flex-1">
          <Outlet context={trip} />
        </div>
        {showTabChrome && <BalanceRail trip={trip} />}
      </div>
      {showTabChrome && <TripNav tripId={trip.id} />}
    </>
  );
}
