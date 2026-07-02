import { Fragment, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { PageShell } from "@/components/layout/PageShell";
import { StickyActionBar } from "@/components/layout/StickyActionBar";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { FormPageSkeleton } from "@/components/ui/Skeleton";
import { PaymentMethodPicker, type PaymentMethod } from "@/components/expense/PaymentMethodPicker";
import { ChevronDown } from "@/components/ui/ChevronDown";
import { useTripLayout } from "@/components/trip/useTripLayout";
import { useSettlement } from "@/hooks/useSettlement";
import { useUpdateSettlement } from "@/hooks/useUpdateSettlement";
import { useMobileFormFlow } from "@/hooks/useMobileFormFlow";

export function EditSettlement() {
  const { tripId, settlementId } = useParams<{ tripId: string; settlementId: string }>();
  const navigate = useNavigate();
  const trip = useTripLayout();
  const { settlement, loading } = useSettlement(settlementId);
  const { updateSettlement, saving, error } = useUpdateSettlement();
  const formRef = useRef<HTMLDivElement>(null);
  const formFlow = useMobileFormFlow(formRef);
  const [initialized, setInitialized] = useState(false);
  const [fromUserId, setFromUserId] = useState("");
  const [toUserId, setToUserId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("");
  const [paymentLabel, setPaymentLabel] = useState("");

  useEffect(() => {
    if (!settlement || initialized) return;
    setFromUserId(settlement.from_user_id);
    setToUserId(settlement.to_user_id);
    setAmount(String(settlement.amount));
    setDate(settlement.date);
    setPaymentMethod(settlement.payment_account?.method ?? "");
    setPaymentLabel(settlement.payment_account?.label ?? "");
    setInitialized(true);
  }, [initialized, settlement]);

  useEffect(() => {
    if (fromUserId && fromUserId === toUserId) {
      setToUserId(trip.members.find((member) => member.id !== fromUserId)?.id ?? "");
    }
  }, [fromUserId, toUserId, trip.members]);

  if (loading) return <PageShell><FormPageSkeleton /></PageShell>;
  if (!tripId || !settlementId || !settlement) {
    return <Navigate to={tripId ? `/trips/${tripId}` : "/"} replace />;
  }

  const valid = Number(amount) > 0 && fromUserId && toUserId && fromUserId !== toUserId;

  return (
    <PageShell>
      <ScreenHeader title="Edit settlement" onBack={() => navigate(-1)} />
      <div ref={formRef} {...formFlow.formProps} className="flex flex-col gap-3.5 pb-28 pt-2.5">
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          {[
            { label: "From", value: fromUserId, setValue: setFromUserId },
            { label: "To", value: toUserId, setValue: setToUserId },
          ].map((field, index) => (
            <Fragment key={field.label}>
              {index === 1 && <span className="pb-3 text-secondary">→</span>}
              <label className="relative flex min-w-0 flex-col gap-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-secondary">
                {field.label}
                <select
                  value={field.value}
                  onChange={(event) => field.setValue(event.target.value)}
                  className="min-w-0 appearance-none rounded-xl bg-card py-3 pl-3 pr-9 font-semibold text-ink shadow-card outline-none"
                >
                  {trip.members
                    .filter((member) => field.label === "From" || member.id !== fromUserId)
                    .map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute bottom-3 right-3 text-secondary" />
              </label>
            </Fragment>
          ))}
        </div>
        <div className="flex items-center rounded-[18px] bg-card px-4 py-2 shadow-card">
          <span className="text-[12px] font-bold text-secondary">{trip.default_currency}</span>
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            autoFocus
            enterKeyHint="done"
            className="min-w-0 flex-1 bg-transparent text-right !text-[24px] font-extrabold outline-none"
          />
        </div>
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="rounded-xl bg-card px-3 py-3 font-semibold shadow-card outline-none"
        />
        <PaymentMethodPicker value={paymentMethod} label={paymentLabel} onChange={setPaymentMethod} onLabelChange={setPaymentLabel} />
        {error && <p className="text-[12.5px] text-owe">{error}</p>}
      </div>
      <StickyActionBar fade bottomOffset={formFlow.keyboardOffset}>
        <Button
          fullWidth
          disabled={!formFlow.keyboardOpen && (!valid || saving)}
          onPointerDown={(event) => formFlow.keyboardOpen && event.preventDefault()}
          onClick={() => {
            if (formFlow.keyboardOpen) return formFlow.advance();
            void updateSettlement({
              settlementId,
              tripId,
              fromUserId,
              toUserId,
              amount: Number(amount),
              date,
              paymentMethod,
              paymentLabel,
            });
          }}
        >
          {formFlow.keyboardOpen ? "Next →" : saving ? "Saving…" : "Save settlement"}
        </Button>
      </StickyActionBar>
    </PageShell>
  );
}
