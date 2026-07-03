import { Navigate, useNavigate, useParams } from "react-router-dom";
import { PageShell } from "@/components/layout/PageShell";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { Avatar } from "@/components/ui/Avatar";
import { FormPageSkeleton } from "@/components/ui/Skeleton";
import { Toast } from "@/components/ui/Toast";
import { useSettlement } from "@/hooks/useSettlement";
import { useRouteToast } from "@/hooks/useRouteToast";
import { useTripLayout } from "@/components/trip/useTripLayout";
import { formatMoney } from "@/lib/money";

function timestamp(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function SettlementDetail() {
  const { tripId, settlementId } = useParams<{ tripId: string; settlementId: string }>();
  const navigate = useNavigate();
  const trip = useTripLayout();
  const { settlement, loading, error } = useSettlement(settlementId);
  const toast = useRouteToast();

  if (loading) return <PageShell><FormPageSkeleton /></PageShell>;
  if (!tripId || !settlementId || !settlement) {
    return <Navigate to={tripId ? `/trips/${tripId}` : "/"} replace />;
  }

  return (
    <PageShell className="lg:max-w-[880px]">
      <ScreenHeader
        title="Settlement details"
        onBack={() => navigate(-1)}
        right={
          <button
            onClick={() => navigate(`/trips/${tripId}/settlements/${settlementId}/edit`)}
            className="text-[12.5px] font-bold text-teal"
          >
            Edit
          </button>
        }
      />
      <div className="flex flex-col gap-3.5 pb-20 pt-2.5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-10">
        <div className="flex min-w-0 flex-col gap-3.5">
        <div className="rounded-[22px] bg-card px-5 py-6 text-center shadow-[var(--shadow-card)]">
          <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-secondary">
            Settlement
          </div>
          <div className="mt-2 text-[34px] font-extrabold tracking-[-1px]">
            {formatMoney(settlement.amount, trip.default_currency)}
          </div>
          <div className="mt-1 text-[12.5px] text-secondary">
            {new Date(`${settlement.date}T00:00:00`).toLocaleDateString(undefined, {
              month: "long", day: "numeric", year: "numeric",
            })}
          </div>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-[18px] bg-card p-4 shadow-[var(--shadow-card)]">
          <div className="grid justify-items-center gap-2 text-center">
            <Avatar name={settlement.from_user?.name ?? "Member"} seed={settlement.from_user_id} avatarUrl={settlement.from_user?.avatar_url} size={40} />
            <div className="text-[12.5px] font-bold">{settlement.from_user?.name ?? "Member"}</div>
            <div className="text-[10px] text-secondary">Paid</div>
          </div>
          <span className="text-[20px] text-secondary">→</span>
          <div className="grid justify-items-center gap-2 text-center">
            <Avatar name={settlement.to_user?.name ?? "Member"} seed={settlement.to_user_id} avatarUrl={settlement.to_user?.avatar_url} size={40} />
            <div className="text-[12.5px] font-bold">{settlement.to_user?.name ?? "Member"}</div>
            <div className="text-[10px] text-secondary">Received</div>
          </div>
        </div>
        </div>

        <div className="flex min-w-0 flex-col gap-3.5">
        {settlement.payment_account && (
          <div className="rounded-[16px] bg-card px-4 py-3 shadow-[var(--shadow-card)]">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-secondary">Payment method</div>
            <div className="mt-1 text-[13.5px] font-bold">
              {settlement.payment_account.method} · {settlement.payment_account.label}
            </div>
          </div>
        )}

        <div className="rounded-[16px] bg-track px-4 py-3 text-[11px] text-secondary">
          <div>Created {timestamp(settlement.created_at)}</div>
          {settlement.updated_at && <div className="mt-1">Updated {timestamp(settlement.updated_at)}</div>}
        </div>
        {error && <p className="text-[12.5px] text-owe">{error}</p>}
        </div>
      </div>
      <Toast message={toast} />
    </PageShell>
  );
}
