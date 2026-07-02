import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import clsx from "clsx";
import { PageShell } from "@/components/layout/PageShell";
import { StickyActionBar } from "@/components/layout/StickyActionBar";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { AvatarStack } from "@/components/ui/AvatarStack";
import { FormPageSkeleton } from "@/components/ui/Skeleton";
import {
  ItemEditorSheet,
  type DraftItem,
} from "@/components/expense/ItemEditorSheet";
import {
  PaymentMethodPicker,
  type PaymentMethod,
} from "@/components/expense/PaymentMethodPicker";
import { useAuth } from "@/context/AuthContext";
import { useTripLayout } from "@/components/trip/useTripLayout";
import { useCategories } from "@/hooks/useCategories";
import { useCreateExpense } from "@/hooks/useCreateExpense";
import { useExpense } from "@/hooks/useExpense";
import { formatMoney } from "@/lib/money";
import { ALL_CURRENCIES } from "@/lib/currencies";
import type { AdjustmentMode } from "@/types/schema";
import { useMobileFormFlow } from "@/hooks/useMobileFormFlow";

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

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

type GlobalSplitMode = "equal" | "percent" | "shares" | "exact" | "itemized";

const SPLIT_MODES: { value: GlobalSplitMode; label: string }[] = [
  { value: "equal", label: "Equal" },
  { value: "percent", label: "%" },
  { value: "shares", label: "Shares" },
  { value: "exact", label: "Exact" },
  { value: "itemized", label: "By item" },
];

export function AddExpense() {
  const { entryId } = useParams<{ entryId?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const trip = useTripLayout();
  const { expense, loading: expenseLoading } = useExpense(entryId);
  const { categories } = useCategories();
  const {
    createExpense,
    createItemizedExpense,
    replaceExpense,
    submitting,
    error,
  } = useCreateExpense();
  const initializedEntryRef = useRef<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const formFlow = useMobileFormFlow(formRef);

  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("");
  const [description, setDescription] = useState("");
  const [payee, setPayee] = useState("");
  const [date, setDate] = useState(todayForInput);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [payerIds, setPayerIds] = useState<string[]>([]);
  const [payerAmounts, setPayerAmounts] = useState<Record<string, string>>({});
  const [payerMethods, setPayerMethods] = useState<Record<string, PaymentMethod>>({});
  const [payerLabels, setPayerLabels] = useState<Record<string, string>>({});
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [splitMode, setSplitMode] = useState<GlobalSplitMode>("equal");
  const [splitValues, setSplitValues] = useState<Record<string, string>>({});
  const [items, setItems] = useState<DraftItem[]>([]);
  const [editingItem, setEditingItem] = useState<DraftItem | null>(null);
  const [itemSheetOpen, setItemSheetOpen] = useState(false);
  const [tax, setTax] = useState("");
  const [tip, setTip] = useState("");
  const [taxMode, setTaxMode] = useState<AdjustmentMode>("proportional");
  const [tipMode, setTipMode] = useState<AdjustmentMode>("proportional");

  useEffect(() => {
    setCurrency((current) => current || trip.default_currency);
    setParticipantIds((current) =>
      current.length > 0 ? current : trip.members.map((member) => member.id),
    );
    if (user) {
      setPayerIds((current) => (current.length > 0 ? current : [user.id]));
    }
  }, [trip, user]);

  useEffect(() => {
    if (!entryId || !expense || initializedEntryRef.current === entryId) return;
    initializedEntryRef.current = entryId;

    const total = expense.payments.reduce(
      (sum, payment) => sum + Number(payment.amount_paid),
      0,
    );
    setAmount(String(total));
    setCurrency(expense.currency);
    setDescription(expense.description);
    setPayee(expense.payee ?? "");
    setDate(expense.date);
    setCategoryId(expense.category?.id ?? null);
    setPayerIds(expense.payments.map((payment) => payment.user_id));
    setPayerAmounts(
      Object.fromEntries(
        expense.payments.map((payment) => [
          payment.user_id,
          String(payment.amount_paid),
        ]),
      ),
    );
    setPayerMethods(
      Object.fromEntries(
        expense.payments.map((payment) => [
          payment.user_id,
          payment.payment_account?.method ?? "",
        ]),
      ),
    );
    setPayerLabels(
      Object.fromEntries(
        expense.payments.map((payment) => [
          payment.user_id,
          payment.payment_account?.label ?? "",
        ]),
      ),
    );

    const draftItems: DraftItem[] = expense.line_items.map((item) => ({
      id: item.id,
      description: item.description,
      amount: Number(item.amount),
      splitMode: (item.line_item_shares[0]?.share_type ?? "equal") as DraftItem["splitMode"],
      shares: item.line_item_shares.map((share) => ({
        userId: share.user_id,
        shareType: share.share_type as DraftItem["splitMode"],
        shareValue: share.share_value === null ? null : Number(share.share_value),
        owedAmount: Number(share.owed_amount),
      })),
    }));

    const isItemized = draftItems.length > 1 || expense.adjustments.length > 0;
    if (isItemized) {
      setSplitMode("itemized");
      setItems(draftItems);
      const taxAdjustment = expense.adjustments.find((item) => item.type === "tax");
      const tipAdjustment = expense.adjustments.find((item) => item.type === "tip");
      setTax(taxAdjustment ? String(taxAdjustment.amount) : "");
      setTip(tipAdjustment ? String(tipAdjustment.amount) : "");
      if (taxAdjustment) setTaxMode(taxAdjustment.mode as AdjustmentMode);
      if (tipAdjustment) setTipMode(tipAdjustment.mode as AdjustmentMode);
      return;
    }

    const onlyItem = draftItems[0];
    const savedMode = onlyItem?.splitMode ?? "equal";
    setSplitMode(savedMode);
    if (savedMode === "equal") {
      setParticipantIds(onlyItem.shares.map((share) => share.userId));
    } else {
      setSplitValues(
        Object.fromEntries(
          onlyItem.shares.map((share) => [
            share.userId,
            String(savedMode === "exact" ? share.owedAmount : share.shareValue ?? ""),
          ]),
        ),
      );
    }
  }, [entryId, expense]);

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
  const itemsSubtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const adjustmentsTotal = (Number(tax) || 0) + (Number(tip) || 0);
  const itemizedContentTotal = itemsSubtotal + adjustmentsTotal;
  const reconciliationRemaining = roundMoney(numericAmount - itemizedContentTotal);
  const itemizedValid =
    items.length > 0 && Math.abs(reconciliationRemaining) < 0.001;
  const splitValueTotal = trip.members.reduce(
    (sum, member) => sum + (Number(splitValues[member.id]) || 0),
    0,
  ) ?? 0;
  const customSplitValid =
    splitMode === "percent"
      ? Math.abs(splitValueTotal - 100) < 0.001
      : splitMode === "exact"
        ? roundMoney(splitValueTotal) === roundMoney(numericAmount)
        : splitMode === "shares"
          ? splitValueTotal > 0
          : false;
  const splitValid =
    splitMode === "equal"
      ? participantIds.length > 0
      : splitMode === "itemized"
        ? itemizedValid
        : customSplitValid;
  const canSubmit =
    numericAmount > 0 &&
    currency.length === 3 &&
    description.trim().length > 0 &&
    categoryId !== null &&
    payerIds.length > 0 &&
    payerTotalMatches &&
    splitValid &&
    !submitting;

  if (entryId && expenseLoading) {
    return (
      <PageShell>
        <FormPageSkeleton />
      </PageShell>
    );
  }

  const activeTripId = trip.id;
  const activeTripMembers = trip.members;

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

  function allocateAdjustment(adjustmentAmount: number) {
    const totals = new Map<string, number>();
    for (const item of items) {
      for (const share of item.shares) {
        totals.set(share.userId, (totals.get(share.userId) ?? 0) + share.owedAmount);
      }
    }
    const active = [...totals.entries()].filter(([, subtotal]) => subtotal > 0);
    const subtotal = active.reduce((sum, [, value]) => sum + value, 0);
    let allocated = 0;
    return active.map(([userId, value], index) => {
      const owedAmount =
        index === active.length - 1
          ? roundMoney(adjustmentAmount - allocated)
          : roundMoney(adjustmentAmount * (value / subtotal));
      allocated += owedAmount;
      return { userId, owedAmount };
    });
  }

  function buildGlobalShares() {
    if (splitMode === "equal" || splitMode === "itemized") return [];
    const active = activeTripMembers.filter(
      (member) => (Number(splitValues[member.id]) || 0) > 0,
    );
    let allocated = 0;
    return active.map((member, index) => {
      const value = Number(splitValues[member.id]);
      const calculated =
        splitMode === "exact"
          ? value
          : splitMode === "percent"
            ? numericAmount * (value / 100)
            : numericAmount * (value / splitValueTotal);
      const owedAmount =
        index === active.length - 1
          ? roundMoney(numericAmount - allocated)
          : roundMoney(calculated);
      allocated += owedAmount;
      return {
        userId: member.id,
        shareType: splitMode,
        shareValue: splitMode === "exact" ? null : value,
        owedAmount,
      };
    });
  }

  function buildEqualShares() {
    const base = Math.floor((numericAmount * 100) / participantIds.length) / 100;
    let allocated = 0;
    return participantIds.map((userId, index) => {
      const owedAmount =
        index === participantIds.length - 1
          ? roundMoney(numericAmount - allocated)
          : base;
      allocated += owedAmount;
      return {
        userId,
        shareType: "equal" as const,
        shareValue: null,
        owedAmount,
      };
    });
  }

  function handleSubmit() {
    const common = {
      tripId: activeTripId,
      amount: numericAmount,
      currency,
      description: description.trim(),
      payee: payee.trim(),
      date,
      categoryId,
      payers: payerIds.map((id) => ({
        userId: id,
        amount: Number(payerAmounts[id]),
        paymentMethod: payerMethods[id] ?? "",
        paymentLabel: payerLabels[id] ?? "",
      })),
    };

    const adjustments = splitMode === "itemized"
      ? [
        ...(Number(tax) > 0
          ? [{
              type: "tax" as const,
              mode: taxMode,
              amount: Number(tax),
              shares: allocateAdjustment(Number(tax)),
            }]
          : []),
        ...(Number(tip) > 0
          ? [{
              type: "tip" as const,
              mode: tipMode,
              amount: Number(tip),
              shares: allocateAdjustment(Number(tip)),
            }]
          : []),
      ]
      : [];
    const expenseItems =
      splitMode === "itemized"
        ? items.map((item) => ({
            description: item.description,
            amount: item.amount,
            shares: item.shares,
          }))
        : [{
            description: description.trim(),
            amount: numericAmount,
            shares: splitMode === "equal" ? buildEqualShares() : buildGlobalShares(),
          }];

    if (entryId) {
      void replaceExpense(entryId, {
        ...common,
        items: expenseItems,
        adjustments,
      });
      return;
    }

    if (splitMode !== "equal") {
      void createItemizedExpense({
        ...common,
        items: expenseItems,
        adjustments,
      });
      return;
    }

    void createExpense({ ...common, participantIds });
  }

  return (
    <PageShell>
      <ScreenHeader
        title={entryId ? "Edit expense" : "Add expense"}
        onBack={() => navigate(-1)}
      />

      <div ref={formRef} {...formFlow.formProps} className="flex flex-col gap-3.5 pt-2.5 pb-28">
        <SectionLabel>Amount</SectionLabel>
        <div className="flex items-center rounded-[20px] bg-card px-5 py-3 shadow-card focus-within:ring-2 focus-within:ring-teal/40">
          <div className="relative mr-3">
            <select
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              aria-label="Expense currency"
              className="appearance-none bg-transparent py-2 pr-5 text-[13px] font-extrabold text-secondary outline-none"
            >
              {ALL_CURRENCIES.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.code}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-[9px] text-secondary">
              ▾
            </span>
          </div>
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            placeholder="0.00"
            aria-label="Expense amount"
            autoFocus
            enterKeyHint="next"
            className="min-w-0 flex-1 bg-transparent text-right !text-[32px] font-extrabold tracking-[-1px] outline-none placeholder:text-faint-2"
          />
        </div>
        {currency !== trip.default_currency && (
          <p className="motion-reveal text-[11.5px] leading-relaxed text-secondary">
            This expense will stay in {currency}. Conversion to the trip’s{" "}
            {trip.default_currency} balance will be estimated until automatic rates land.
          </p>
        )}

        <SectionLabel>What was it for?</SectionLabel>
        <Input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Dinner, taxi, hotel…"
          enterKeyHint="next"
        />

        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
          <div className="flex min-w-0 flex-col gap-2">
            <SectionLabel>Paid to</SectionLabel>
            <Input
              value={payee}
              onChange={(event) => setPayee(event.target.value)}
              placeholder="Optional"
              className="w-full min-w-0"
              enterKeyHint="done"
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
                  "py-3",
                  index < trip.members.length - 1 && "border-b border-black/5",
                )}
              >
                <button
                  onClick={() => togglePayer(member.id)}
                  className="flex w-full min-w-0 items-center gap-3 text-left"
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
                    <div className="motion-reveal mt-2 flex gap-2 pl-[46px]">
                      <PaymentMethodPicker
                        value={payerMethods[member.id] ?? ""}
                        label={payerLabels[member.id] ?? ""}
                        onChange={(method) =>
                          setPayerMethods((current) => ({
                            ...current,
                            [member.id]: method,
                          }))
                        }
                        onLabelChange={(label) =>
                          setPayerLabels((current) => ({
                            ...current,
                            [member.id]: label,
                          }))
                        }
                      />
                      <div className="ml-auto flex w-[92px] flex-none items-center rounded-xl bg-tile px-2.5 py-2">
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
                    </div>
                  )}
              </div>
            );
          })}
        </div>
        {payerIds.length > 1 && !payerTotalMatches && numericAmount > 0 && (
          <p className="motion-reveal text-[12.5px] font-semibold text-owe">
            Payer amounts total {formatMoney(payerTotal, currency)}; they must equal{" "}
            {formatMoney(numericAmount, currency)}.
          </p>
        )}

        <SectionLabel className="mt-1">Split between</SectionLabel>
        <div className="grid grid-cols-5 rounded-[16px] bg-track p-1">
          {SPLIT_MODES.map((mode) => (
            <button
              key={mode.value}
              onClick={() => setSplitMode(mode.value)}
              className={clsx(
                "rounded-[12px] px-1 py-2 text-[10.5px] font-bold",
                splitMode === mode.value
                  ? "bg-card text-teal-dark shadow-card"
                  : "text-secondary",
              )}
            >
              {mode.label}
            </button>
          ))}
        </div>

        {splitMode === "equal" ? (
          <>
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
                        {formatMoney(estimate, currency)}
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
          </>
        ) : splitMode === "itemized" ? (
          <div className="motion-reveal flex flex-col gap-3.5">
            <SectionLabel>Line items</SectionLabel>
            {items.length > 0 && (
              <div className="overflow-hidden rounded-[18px] bg-card px-4 shadow-card">
                {items.map((item, index) => {
                  const people = trip.members.filter((member) =>
                    item.shares.some((share) => share.userId === member.id),
                  );
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setEditingItem(item);
                        setItemSheetOpen(true);
                      }}
                      className={clsx(
                        "flex w-full items-center gap-3 py-3 text-left",
                        index < items.length - 1 && "border-b border-black/5",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14px] font-bold">{item.description}</div>
                        <div className="mt-1 flex items-center gap-2">
                          <AvatarStack people={people} size={24} max={4} />
                          <span className="text-[11px] font-semibold capitalize text-secondary">
                            {item.splitMode}
                          </span>
                        </div>
                      </div>
                      <span className="text-[14px] font-extrabold">
                        {formatMoney(item.amount, currency)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            <button
              onClick={() => {
                setEditingItem(null);
                setItemSheetOpen(true);
              }}
              className="w-full rounded-[16px] border border-dashed border-teal/35 bg-teal-tint/50 px-4 py-3 text-[13.5px] font-bold text-teal-dark"
            >
              + Add line item
            </button>

            <SectionLabel>Tax & tip</SectionLabel>
            {[
              { label: "Tax", value: tax, setValue: setTax, mode: taxMode, setMode: setTaxMode },
              { label: "Tip", value: tip, setValue: setTip, mode: tipMode, setMode: setTipMode },
            ].map((adjustment) => (
              <div key={adjustment.label} className="rounded-[18px] bg-card p-3 shadow-card">
                <div className="flex items-center gap-3">
                  <span className="w-10 text-[13.5px] font-bold">{adjustment.label}</span>
                  <div className="flex min-w-0 flex-1 items-center rounded-xl bg-tile px-3 py-2">
                    <span className="text-[11px] font-bold text-secondary">{currency}</span>
                    <input
                      value={adjustment.value}
                      onChange={(event) => adjustment.setValue(event.target.value)}
                      inputMode="decimal"
                      placeholder="0.00"
                      className="min-w-0 flex-1 bg-transparent text-right text-[13px] font-bold outline-none"
                    />
                  </div>
                </div>
                {Number(adjustment.value) > 0 && (
                  <div className="motion-reveal mt-2 grid grid-cols-2 rounded-pill bg-track p-1">
                    {[
                      { value: "proportional" as const, label: "Proportional" },
                      { value: "own_item" as const, label: "Own items" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => adjustment.setMode(option.value)}
                        className={clsx(
                          "rounded-pill px-2 py-1.5 text-[11.5px] font-bold",
                          adjustment.mode === option.value
                            ? "bg-card text-teal-dark shadow-card"
                            : "text-secondary",
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            <div
              className={clsx(
                "rounded-[18px] px-4 py-3 text-[12.5px] font-semibold",
                itemizedValid ? "bg-teal-tint text-teal-dark" : "bg-owe-tint text-owe",
              )}
            >
              <div className="flex justify-between">
                <span>Items + adjustments</span>
                <span>{formatMoney(itemizedContentTotal, currency)}</span>
              </div>
              <div className="mt-1 flex justify-between font-extrabold">
                <span>{itemizedValid ? "Reconciled" : "Remaining"}</span>
                <span>{formatMoney(Math.abs(reconciliationRemaining), currency)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="motion-reveal flex flex-col gap-2.5">
            <div className="overflow-hidden rounded-[18px] bg-card px-4 shadow-card">
              {trip.members.map((member, index) => {
                const value = Number(splitValues[member.id]) || 0;
                const calculated =
                  splitMode === "exact"
                    ? value
                    : splitMode === "percent"
                      ? numericAmount * (value / 100)
                      : splitValueTotal > 0
                        ? numericAmount * (value / splitValueTotal)
                        : 0;
                return (
                  <div
                    key={member.id}
                    className={clsx(
                      "flex items-center gap-3 py-3",
                      index < trip.members.length - 1 && "border-b border-black/5",
                    )}
                  >
                    <Avatar
                      name={member.name}
                      seed={member.id}
                      avatarUrl={member.avatar_url}
                      size={34}
                      ring={value > 0 ? "teal" : "none"}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-semibold">{member.name}</div>
                      {value > 0 && splitMode !== "exact" && numericAmount > 0 && (
                        <div className="text-[11px] text-secondary">
                          {formatMoney(calculated, currency)}
                        </div>
                      )}
                    </div>
                    <div className="flex w-[104px] items-center rounded-xl bg-tile px-2.5 py-2">
                      {splitMode === "exact" && (
                        <span className="mr-1 text-[10px] font-bold text-secondary">
                          {currency}
                        </span>
                      )}
                      <input
                        value={splitValues[member.id] ?? ""}
                        onChange={(event) =>
                          setSplitValues((current) => ({
                            ...current,
                            [member.id]: event.target.value,
                          }))
                        }
                        inputMode="decimal"
                        aria-label={`${splitMode} split for ${member.name}`}
                        className="min-w-0 flex-1 bg-transparent text-right text-[12.5px] font-bold outline-none"
                      />
                      {splitMode === "percent" && (
                        <span className="ml-1 text-[11px] text-secondary">%</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div
              className={clsx(
                "text-right text-[12px] font-semibold",
                customSplitValid ? "text-secondary" : "text-owe",
              )}
            >
              {splitMode === "exact"
                ? `${formatMoney(splitValueTotal, currency)} of ${formatMoney(numericAmount || 0, currency)}`
                : splitMode === "percent"
                  ? `${splitValueTotal}% of 100%`
                  : `${splitValueTotal} total shares`}
            </div>
          </div>
        )}
        {error && <p className="text-[13px] text-owe">{error}</p>}
      </div>

      <StickyActionBar fade bottomOffset={formFlow.keyboardOffset}>
        <Button
          fullWidth
          disabled={!formFlow.keyboardOpen && !canSubmit}
          onPointerDown={(event) => formFlow.keyboardOpen && event.preventDefault()}
          onClick={() => formFlow.keyboardOpen ? formFlow.advance() : handleSubmit()}
        >
          {formFlow.keyboardOpen
            ? "Next →"
            : submitting
            ? entryId
              ? "Saving expense…"
              : "Adding expense…"
            : entryId
              ? "Save expense"
              : "Add expense"}
        </Button>
      </StickyActionBar>

      {itemSheetOpen && (
        <ItemEditorSheet
          members={trip.members}
          currency={currency}
          initial={editingItem}
          onClose={() => {
            setItemSheetOpen(false);
            setEditingItem(null);
          }}
          onDelete={
            editingItem
              ? () => {
                  setItems((current) =>
                    current.filter((item) => item.id !== editingItem.id),
                  );
                  setItemSheetOpen(false);
                  setEditingItem(null);
                }
              : undefined
          }
          onSave={(item) => {
            setItems((current) => {
              const exists = current.some((candidate) => candidate.id === item.id);
              return exists
                ? current.map((candidate) => (candidate.id === item.id ? item : candidate))
                : [...current, item];
            });
            setItemSheetOpen(false);
            setEditingItem(null);
          }}
        />
      )}
    </PageShell>
  );
}
