import { PageShell } from "@/components/layout/PageShell";
import { useTripLayout } from "@/components/trip/useTripLayout";

export function TripReports() {
  useTripLayout();

  return (
    <PageShell>
      <div className="text-center pt-4 pb-2 text-[16px] font-bold">Reports</div>

      <div className="flex flex-col gap-3.5 pt-2.5 pb-20">
        <div className="bg-card rounded-[18px] p-6 text-center text-secondary text-[13.5px] shadow-card">
          Category and account breakdowns show up here once there's spending to report on.
        </div>
      </div>
    </PageShell>
  );
}
