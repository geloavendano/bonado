import { Navigate, Outlet, useParams } from "react-router-dom";
import { PageShell } from "@/components/layout/PageShell";
import { TripNav } from "@/components/trip/TripNav";
import { TripPageSkeleton } from "@/components/ui/Skeleton";
import { useTrip } from "@/hooks/useTrip";

export function TripLayout() {
  const { tripId } = useParams<{ tripId: string }>();
  const { trip, loading } = useTrip(tripId);

  if (loading) {
    return (
      <PageShell padded={false}>
        <TripPageSkeleton cover />
      </PageShell>
    );
  }

  if (!trip) return <Navigate to="/" replace />;

  return (
    <>
      <Outlet context={trip} />
      <TripNav tripId={trip.id} />
    </>
  );
}
