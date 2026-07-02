import { useEffect, useMemo, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import clsx from "clsx";
import { PageShell } from "@/components/layout/PageShell";
import { StickyActionBar } from "@/components/layout/StickyActionBar";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { FormPageSkeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/context/AuthContext";
import { useTrip } from "@/hooks/useTrip";
import { useCategories } from "@/hooks/useCategories";
import { useCreateExpense } from "@/hooks/useCreateExpense";
import { formatMoney } from "@/lib/money";

const CATEGORY_ICONS: Record<string, string> = {
  "Food & drink": "🍽",
  Transport: "🚕",
  Lodging: "🛏",
  Groceries: "🛒",
  Activities: "🎟",
  Other: "•••",
};

function todayForInput() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function AddExpense() {
  const { tripId } = useParams<{ tripId: string }>();
  const { user } = useAuth();
  const { trip, loading } = useTrip(tripId);
  const { categories } = useCategories();
  const { createExpense, submitting, error } = useCreateExpense();

  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [payee, setPayee] = useState("");
  const [date, setDate] = useState(todayForInput);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [payerIds, setPayerIds] = useState<string[]>([]);
  const [payerAmounts, setPayerAmounts] = useState<Record<string, string>>({});
  const [participantIds, setParticipantIds] = useState<string[]>([]);

  useEffect(() => {
    if (!trip) return;
    setParticipantIds((current) =>
      current.length > 0 ? current : trip.members.map((member) => member.id),
    );
    if (user) {
      setPayerIds((current) => (current.length > 0 ? current : [user.id]));
    }
  }, [trip, user]);

  useEffect(() => {
    if (!categoryId && categories.length > 0) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId]);

  useEffect(() => {
    if (payerIds.length !== 1) return;
    const onlyPayer = payerIds[0];
    setPayerAmounts((current) =>
      current[onlyPayer] === amount ? current : { ...current, [onlyPayer]: amount },
    );
  }, [amount, payerIds]);

  const numericAmount = Number(amount);
  const payerTotal = useMemo(
    () => payerIds.reduce((sum, id) => sum + (Number(payerAmounts[id]) || 0), 0),
    [payerIds, payerAmounts],
  );
  const payerTotalMatches =
    Number.isFinite(numericAmount) &&
    Math.round(payerTotal * 100) === Math.round(numericAmount * 100);
  const canSubmit =
    numericAmount > 0 &&
    description.trim().length > 0 &&
    categoryId !== null &&
    payerIds.length > 0 &&
    participantIds.length > 0 &&
    payerTotalMatches &&
    !submitting;

  if (loading) {
    return (
      <PageShell>
        <FormPageSkeleton />
      </PageShell>
    );
  }

  if (!trip || !tripId) return <Navigate to="/" replace />;

  function togglePayer(memberId: string) {
    setPayerIds((current) => {
      if (current.includes(memberId)) {
        if (current.length === 1) return current;
        return current.filter((id) => id !== memberId);
      }
      return [...current, memberId];
    });
    setPayerAmounts((current) => ({
      ...current,
      [memberId]: current[memberId] ?? "",
    }));
  }

  function toggleParticipant(memberId: string) {
    setParticipantIds((current) =>
      current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId],
    );
  }

  return (
    <PageShell>
      <ScreenHeader title="Add expense" />

      <div className="flex flex-col gap-3.5 pt-2.5 pb-28">
        <SectionLabel>Amount</SectionLabel>
        <div className="flex items-center rounded-[20px] bg-card px-5 py-3 shadow-card focus-within:ring-2 focus-within:ring-teal/40">
          <span className="mr-3 text-[13px] font-extrabold text-secondary">
            {trip.default_currency}
          </span>
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            placeholder="0.00"
            aria-label="Expense amount"
            className="min-w-0 flex-1 bg-transparent text-right text-[32px] font-extrabold tracking-[-1px] outline-none placeholder:text-faint-2"
          />
        </div>

        <SectionLabel>What was it for?</SectionLabel>
        <Input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Dinner, taxi, hotel…"
        />

        <div className="grid grid-cols-2 gap-3">
          <div className="flex min-w-0 flex-col gap-2">
            <SectionLabel>Paid to</SectionLabel>
            <Input
              value={payee}
              onChange={(event) => setPayee(event.target.value)}
              placeholder="Optional"
              className="w-full min-w-0"
            />
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <SectionLabel>Date</SectionLabel>
            <Input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="w-full min-w-0"
            />
          </div>
        </div>

        <SectionLabel>Category</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setCategoryId(category.id)}
              className={clsx(
                "rounded-pill border-2 px-3 py-2 text-[12.5px] font-bold",
                categoryId === category.id
                  ? "border-teal bg-teal-tint text-teal-dark"
                  : "border-transparent bg-card text-secondary shadow-card",
              )}
            >
              {CATEGORY_ICONS[category.name] ?? "•"} {category.name}
            </button>
          ))}
        </div>

        <SectionLabel className="mt-1">Paid by</SectionLabel>
        <div className="overflow-hidden rounded-[18px] bg-card px-4 shadow-card">
          {trip.members.map((member, index) => {
            const selected = payerIds.includes(member.id);
            return (
              <div
                key={member.id}
                className={clsx(
                  "flex items-center gap-3 py-3",
                  index < trip.members.length - 1 && "border-b border-black/5",
                )}
              >
                <button
                  onClick={() => togglePayer(member.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <Avatar
                    name={member.name}
                    seed={member.id}
                    avatarUrl={member.avatar_url}
                    size={34}
                    ring={selected ? "teal" : "none"}
                  />
                  <span className="truncate text-[14px] font-semibold">{member.name}</span>
                  <span
                    className={clsx(
                      "ml-auto grid size-5 place-items-center rounded-full border text-[11px] font-bold",
                      selected
                        ? "border-teal bg-teal text-white"
                        : "border-faint-2 text-transparent",
                    )}
                  >
                    ✓
                  </span>
                </button>
                {selected && (
                  <div className="motion-reveal flex w-[92px] items-center rounded-xl bg-tile px-2.5 py-2">
                    <input
                      value={payerAmounts[member.id] ?? ""}
                      onChange={(event) =>
                        setPayerAmounts((current) => ({
                          ...current,
                          [member.id]: event.target.value,
                        }))
                      }
                      inputMode="decimal"
                      aria-label={`Amount paid by ${member.name}`}
                      className="w-full bg-transparent text-right text-[13px] font-bold outline-none"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {payerIds.length > 1 && !payerTotalMatches && numericAmount > 0 && (
          <p className="motion-reveal text-[12.5px] font-semibold text-owe">
            Payer amounts total {formatMoney(payerTotal, trip.default_currency)}; they must equal{" "}
            {formatMoney(numericAmount, trip.default_currency)}.
          </p>
        )}

        <SectionLabel className="mt-1">Split equally between</SectionLabel>
        <div className="overflow-hidden rounded-[18px] bg-card px-4 shadow-card">
          {trip.members.map((member, index) => {
            const included = participantIds.includes(member.id);
            const estimate =
              numericAmount > 0 && participantIds.length > 0
                ? numericAmount / participantIds.length
                : 0;
            return (
              <button
                key={member.id}
                onClick={() => toggleParticipant(member.id)}
                className={clsx(
                  "flex w-full items-center gap-3 py-3 text-left",
                  index < trip.members.length - 1 && "border-b border-black/5",
                )}
              >
                <Avatar
                  name={member.name}
                  seed={member.id}
                  avatarUrl={member.avatar_url}
                  size={34}
                  ring={included ? "teal" : "none"}
                />
                <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">
                  {member.name}
                </span>
                {included && estimate > 0 && (
                  <span className="text-[12.5px] font-bold text-secondary">
                    {formatMoney(estimate, trip.default_currency)}
                  </span>
                )}
                <span
                  className={clsx(
                    "grid size-5 place-items-center rounded-full border text-[11px] font-bold",
                    included
                      ? "border-teal bg-teal text-white"
                      : "border-faint-2 text-transparent",
                  )}
                >
                  ✓
                </span>
              </button>
            );
          })}
        </div>

        {participantIds.length === 0 && (
          <p className="text-[12.5px] font-semibold text-owe">
            Include at least one person in the split.
          </p>
        )}
        {error && <p className="text-[13px] text-owe">{error}</p>}
      </div>

      <StickyActionBar>
        <Button
          fullWidth
          disabled={!canSubmit}
          onClick={() =>
            void createExpense({
              tripId,
              amount: numericAmount,
              description: description.trim(),
              payee: payee.trim(),
              date,
              categoryId,
              payers: payerIds.map((id) => ({
                userId: id,
                amount: Number(payerAmounts[id]),
              })),
              participantIds,
            })
          }
        >
          {submitting ? "Adding expense…" : "Add expense"}
        </Button>
      </StickyActionBar>
    </PageShell>
  );
}
