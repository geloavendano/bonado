import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { PageShell } from "@/components/layout/PageShell";
import { StickyActionBar } from "@/components/layout/StickyActionBar";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { FormPageSkeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/context/AuthContext";
import { useCategories } from "@/hooks/useCategories";
import { useExpense } from "@/hooks/useExpense";
import { useExpenseMutations } from "@/hooks/useExpenseMutations";
import { useReceiptUpload } from "@/hooks/useReceiptUpload";
import { supabase } from "@/lib/supabase";
import { formatMoney, formatSignedMoney } from "@/lib/money";

const CATEGORY_ICONS: Record<string, string> = {
  "Food & drink": "🍽",
  Transport: "🚕",
  Lodging: "🛏",
  Groceries: "🛒",
  Activities: "🎟",
  Other: "•••",
};

function labelForAdjustment(type: string) {
  if (type === "tax") return "Tax";
  if (type === "tip") return "Tip";
  return "Service charge";
}

export function ExpenseDetail() {
  const { tripId, entryId } = useParams<{ tripId: string; entryId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { expense, loading, reload } = useExpense(entryId);
  const { categories } = useCategories();
  const { updateDetails, deleteExpense, saving, error } = useExpenseMutations();
  const { uploadReceipt, uploading, error: uploadError } = useReceiptUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [description, setDescription] = useState("");
  const [payee, setPayee] = useState("");
  const [date, setDate] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!expense) return;
    setDescription(expense.description);
    setPayee(expense.payee ?? "");
    setDate(expense.date);
    setCategoryId(expense.category?.id ?? null);
  }, [expense]);

  useEffect(() => {
    const path = expense?.entry_attachments[0]?.storage_path;
    if (!path) {
      setReceiptUrl(null);
      return;
    }
    let cancelled = false;
    supabase.storage
      .from("receipts")
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (!cancelled) setReceiptUrl(data?.signedUrl ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [expense]);

  const breakdown = useMemo(() => {
    if (!expense) return [];
    const people = new Map<
      string,
      {
        id: string;
        name: string;
        avatar_url: string | null;
        paid: number;
        owed: number;
      }
    >();
    const ensure = (id: string, name: string, avatarUrl: string | null) => {
      if (!people.has(id)) {
        people.set(id, { id, name, avatar_url: avatarUrl, paid: 0, owed: 0 });
      }
      return people.get(id)!;
    };

    for (const payment of expense.payments) {
      if (!payment.user) continue;
      ensure(payment.user.id, payment.user.name, payment.user.avatar_url).paid += Number(
        payment.amount_paid,
      );
    }
    for (const item of expense.line_items) {
      for (const share of item.line_item_shares) {
        if (!share.user) continue;
        ensure(share.user.id, share.user.name, share.user.avatar_url).owed += Number(
          share.owed_amount,
        );
      }
    }
    for (const adjustment of expense.adjustments) {
      for (const share of adjustment.adjustment_shares) {
        if (!share.user) continue;
        ensure(share.user.id, share.user.name, share.user.avatar_url).owed += Number(
          share.owed_amount,
        );
      }
    }
    return [...people.values()];
  }, [expense]);

  if (loading) {
    return (
      <PageShell>
        <FormPageSkeleton />
      </PageShell>
    );
  }

  if (!expense || !tripId || !entryId) {
    return <Navigate to={tripId ? `/trips/${tripId}` : "/"} replace />;
  }
  const activeExpense = expense;

  const total = expense.payments.reduce(
    (sum, payment) => sum + Number(payment.amount_paid),
    0,
  );
  const yourBreakdown = breakdown.find((person) => person.id === user?.id);
  const yourShare = yourBreakdown?.owed ?? 0;
  const dirty =
    description.trim() !== expense.description ||
    payee.trim() !== (expense.payee ?? "") ||
    date !== expense.date ||
    categoryId !== (expense.category?.id ?? null);

  async function saveDetails() {
    if (!entryId || description.trim().length === 0) return;
    if (
      await updateDetails(entryId, {
        description: description.trim(),
        payee: payee.trim(),
        date,
        categoryId,
      })
    ) {
      await reload();
      setEditing(false);
    }
  }

  function cancelEditing() {
    setDescription(activeExpense.description);
    setPayee(activeExpense.payee ?? "");
    setDate(activeExpense.date);
    setCategoryId(activeExpense.category?.id ?? null);
    setEditing(false);
  }

  async function handleDelete() {
    if (!entryId || !tripId) return;
    if (await deleteExpense(entryId)) {
      navigate(`/trips/${tripId}`, { replace: true });
    }
  }

  return (
    <PageShell>
      <ScreenHeader
        title="Expense details"
        right={
          editing ? (
            <button
              onClick={cancelEditing}
              className="text-[12.5px] font-bold text-secondary"
            >
              Cancel
            </button>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="text-[12.5px] font-bold text-teal"
            >
              Edit
            </button>
          )
        }
      />

      <div className="flex flex-col gap-3.5 pb-28 pt-2.5">
        {editing ? (
          <>
            <SectionLabel>Description</SectionLabel>
            <Input value={description} onChange={(event) => setDescription(event.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <div className="flex min-w-0 flex-col gap-2">
                <SectionLabel>Paid to</SectionLabel>
                <Input
                  value={payee}
                  onChange={(event) => setPayee(event.target.value)}
                  placeholder="Optional"
                  className="min-w-0"
                />
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                <SectionLabel>Date</SectionLabel>
                <Input
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className="min-w-0"
                />
              </div>
            </div>
            <SectionLabel>Category</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setCategoryId(category.id)}
                  className={
                    "rounded-pill border-2 px-3 py-2 text-[12px] font-bold " +
                    (categoryId === category.id
                      ? "border-teal bg-teal-tint text-teal-dark"
                      : "border-transparent bg-card text-secondary shadow-card")
                  }
                >
                  {CATEGORY_ICONS[category.name] ?? "•"} {category.name}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="rounded-[22px] bg-card px-5 py-6 text-center shadow-card">
              <div className="mb-2 text-[12px] font-bold uppercase tracking-[0.09em] text-secondary">
                {CATEGORY_ICONS[expense.category?.name ?? "Other"] ?? "•"}{" "}
                {expense.category?.name ?? "Other"}
              </div>
              <div className="text-[23px] font-extrabold">{expense.description}</div>
              <div className="mt-1 text-[13px] text-secondary">
                {new Date(`${expense.date}T00:00:00`).toLocaleDateString(undefined, {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
                {expense.payee ? ` · ${expense.payee}` : ""}
              </div>
              <div className="mt-4 text-[36px] font-extrabold tracking-[-1.5px]">
                {formatMoney(total, expense.currency)}
              </div>
            </div>

            <div className="rounded-[18px] bg-teal-tint px-4 py-4">
              <div className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-teal-dark/70">
                Your share
              </div>
              <div className="mt-0.5 text-[22px] font-extrabold text-teal-dark">
                {formatMoney(yourShare, expense.currency)}
              </div>
            </div>

            <SectionLabel>Paid by</SectionLabel>
            <div className="overflow-hidden rounded-[18px] bg-card px-4 shadow-card">
              {expense.payments.map((payment, index) => (
                <div
                  key={`${payment.user_id}-${index}`}
                  className={
                    "flex items-center gap-3 py-3" +
                    (index < expense.payments.length - 1 ? " border-b border-black/5" : "")
                  }
                >
                  <Avatar
                    name={payment.user?.name ?? "Member"}
                    seed={payment.user_id}
                    avatarUrl={payment.user?.avatar_url}
                    size={34}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-semibold">
                      {payment.user?.name ?? "Member"}
                    </div>
                    {payment.payment_account && (
                      <div className="text-[11px] text-secondary">
                        {payment.payment_account.label}
                      </div>
                    )}
                  </div>
                  <div className="text-[13.5px] font-extrabold">
                    {formatMoney(Number(payment.amount_paid), expense.currency)}
                  </div>
                </div>
              ))}
            </div>

            <SectionLabel>Breakdown</SectionLabel>
            <div className="overflow-hidden rounded-[18px] bg-card px-4 shadow-card">
              {breakdown.map((person, index) => (
                <div
                  key={person.id}
                  className={
                    "flex items-center gap-3 py-3" +
                    (index < breakdown.length - 1 ? " border-b border-black/5" : "")
                  }
                >
                  <Avatar
                    name={person.name}
                    seed={person.id}
                    avatarUrl={person.avatar_url}
                    size={34}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-semibold">{person.name}</div>
                    <div className="text-[11px] text-secondary">
                      Paid {formatMoney(person.paid, expense.currency)} · Share{" "}
                      {formatMoney(person.owed, expense.currency)}
                    </div>
                  </div>
                  <div
                    className={
                      "text-[12.5px] font-extrabold " +
                      (person.paid - person.owed >= 0 ? "text-owed" : "text-owe")
                    }
                  >
                    {formatSignedMoney(person.paid - person.owed, expense.currency)}
                  </div>
                </div>
              ))}
            </div>

            {(expense.line_items.length > 1 || expense.adjustments.length > 0) && (
              <>
                <SectionLabel>Items</SectionLabel>
                <div className="overflow-hidden rounded-[18px] bg-card px-4 shadow-card">
                  {expense.line_items.map((item, index) => (
                    <div
                      key={item.id}
                      className={
                        "flex items-center gap-3 py-3" +
                        (index < expense.line_items.length - 1 ||
                        expense.adjustments.length > 0
                          ? " border-b border-black/5"
                          : "")
                      }
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] font-semibold">
                          {item.description}
                        </div>
                        <div className="text-[11px] capitalize text-secondary">
                          {item.line_item_shares[0]?.share_type ?? "equal"} split
                        </div>
                      </div>
                      <div className="text-[13px] font-extrabold">
                        {formatMoney(Number(item.amount), expense.currency)}
                      </div>
                    </div>
                  ))}
                  {expense.adjustments.map((adjustment, index) => (
                    <div
                      key={adjustment.id}
                      className={
                        "flex items-center gap-3 py-3" +
                        (index < expense.adjustments.length - 1
                          ? " border-b border-black/5"
                          : "")
                      }
                    >
                      <div className="min-w-0 flex-1 text-[13.5px] font-semibold">
                        {labelForAdjustment(adjustment.type)}
                      </div>
                      <div className="text-[13px] font-extrabold">
                        {formatMoney(Number(adjustment.amount), expense.currency)}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <SectionLabel>Receipt</SectionLabel>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                void uploadReceipt(entryId, file).then((ok) => {
                  if (ok) void reload();
                });
              }}
            />
            {receiptUrl ? (
              <div className="block w-full">
                <img
                  src={receiptUrl}
                  alt="Expense receipt"
                  className="max-h-[320px] w-full rounded-[18px] object-cover shadow-card"
                />
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full rounded-[18px] border border-dashed border-faint-2 bg-card px-4 py-8 text-[13px] font-bold text-secondary disabled:opacity-50"
              >
                {uploading ? "Uploading receipt…" : "＋ Add receipt photo"}
              </button>
            )}
            {uploadError && <p className="text-[12.5px] text-owe">{uploadError}</p>}

            <div className="mt-3">
              {confirmingDelete ? (
                <div className="motion-reveal flex items-center justify-center gap-2">
                  <button
                    onClick={() => void handleDelete()}
                    disabled={saving || !navigator.onLine}
                    className="rounded-pill bg-owe-tint px-4 py-2.5 text-[13px] font-bold text-owe disabled:opacity-50"
                  >
                    Delete expense
                  </button>
                  <button
                    onClick={() => setConfirmingDelete(false)}
                    className="rounded-pill px-4 py-2.5 text-[13px] font-semibold text-secondary"
                  >
                    Keep
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmingDelete(true)}
                  className="w-full py-3 text-center text-[13px] font-bold text-owe"
                >
                  Delete expense
                </button>
              )}
            </div>
          </>
        )}
        {error && <p className="text-[12.5px] text-owe">{error}</p>}
      </div>

      {editing && (
        <StickyActionBar fade>
          <Button
            fullWidth
            disabled={!dirty || saving || description.trim().length === 0}
            onClick={() => void saveDetails()}
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </StickyActionBar>
      )}
    </PageShell>
  );
}
