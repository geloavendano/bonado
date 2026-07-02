import { Navigate, useParams } from "react-router-dom";
import { PageShell } from "@/components/layout/PageShell";
import { TripNav } from "@/components/trip/TripNav";
import { useTrip } from "@/hooks/useTrip";

export function TripBalances() {
  const { tripId } = useParams<{ tripId: string }>();
  const { trip, loading } = useTrip(tripId);

  if (loading) {
    return (
      <PageShell>
        <div className="text-secondary text-sm py-10 text-center">Loading…</div>
      </PageShell>
    );
  }

  if (!trip) return <Navigate to="/" replace />;

  return (
    <PageShell>
      <div className="text-center pt-4 pb-2 text-[16px] font-bold">Balances</div>

      <div className="flex flex-col gap-3.5 pt-2.5 pb-20">
        <div className="bg-teal-tint rounded-[20px] px-[18px] py-5 text-center">
          <div className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-teal-dark/70">
            Your position
          </div>
          <div className="text-[26px] font-extrabold text-teal-dark tracking-[-0.5px]">
            Settled up
          </div>
        </div>

        <div className="bg-card rounded-[18px] p-6 text-center text-secondary text-[13.5px] shadow-card">
          Balances show up here once trip members start adding expenses.
        </div>
      </div>

      <TripNav tripId={trip.id} />
    </PageShell>
  );
}
