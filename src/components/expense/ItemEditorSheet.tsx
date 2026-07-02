import { useMemo, useState } from "react";
import clsx from "clsx";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { TripMember } from "@/hooks/useTrip";
import { formatMoney } from "@/lib/money";

export type ItemSplitMode = "equal" | "exact" | "percent" | "shares";

export interface DraftItemShare {
  userId: string;
  shareType: ItemSplitMode;
  shareValue: number | null;
  owedAmount: number;
}

export interface DraftItem {
  id: string;
  description: string;
  amount: number;
  splitMode: ItemSplitMode;
  shares: DraftItemShare[];
}

interface ItemEditorSheetProps {
  members: TripMember[];
  currency: string;
  initial?: DraftItem | null;
  onSave: (item: DraftItem) => void;
  onDelete?: () => void;
  onClose: () => void;
}

const MODES: { value: ItemSplitMode; label: string }[] = [
  { value: "equal", label: "Equal" },
  { value: "exact", label: "Exact" },
  { value: "percent", label: "%" },
  { value: "shares", label: "Shares" },
];

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function ItemEditorSheet({
  members,
  currency,
  initial,
  onSave,
  onDelete,
  onClose,
}: ItemEditorSheetProps) {
  const [description, setDescription] = useState(initial?.description ?? "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [mode, setMode] = useState<ItemSplitMode>(initial?.splitMode ?? "equal");
  const [includedIds, setIncludedIds] = useState<string[]>(
    initial
      ? initial.shares.filter((share) => share.owedAmount > 0).map((share) => share.userId)
      : members.map((member) => member.id),
  );
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (initial?.shares ?? []).map((share) => [
        share.userId,
        String(
          share.shareValue ??
            (share.shareType === "exact" ? share.owedAmount : ""),
        ),
      ]),
    ),
  );

  const numericAmount = Number(amount);
  const numericValues = useMemo(
    () =>
      Object.fromEntries(
        members.map((member) => [member.id, Number(values[member.id]) || 0]),
      ),
    [members, values],
  );
  const valueTotal = Object.values(numericValues).reduce((sum, value) => sum + value, 0);

  const valid =
    description.trim().length > 0 &&
    numericAmount > 0 &&
    (mode === "equal"
      ? includedIds.length > 0
      : mode === "percent"
        ? Math.abs(valueTotal - 100) < 0.001
        : valueTotal > 0 && (mode !== "exact" || roundMoney(valueTotal) === roundMoney(numericAmount)));

  function buildShares(): DraftItemShare[] {
    if (mode === "equal") {
      const base = Math.floor((numericAmount * 100) / includedIds.length) / 100;
      let allocated = 0;
      return includedIds.map((userId, index) => {
        const owedAmount =
          index === includedIds.length - 1
            ? roundMoney(numericAmount - allocated)
            : base;
        allocated += owedAmount;
        return { userId, shareType: mode, shareValue: null, owedAmount };
      });
    }

    const active = members.filter((member) => numericValues[member.id] > 0);
    let allocated = 0;
    return active.map((member, index) => {
      const rawValue = numericValues[member.id];
      const calculated =
        mode === "exact"
          ? rawValue
          : mode === "percent"
            ? (numericAmount * rawValue) / 100
            : (numericAmount * rawValue) / valueTotal;
      const owedAmount =
        index === active.length - 1
          ? roundMoney(numericAmount - allocated)
          : roundMoney(calculated);
      allocated += owedAmount;
      return {
        userId: member.id,
        shareType: mode,
        shareValue: mode === "exact" ? null : rawValue,
        owedAmount,
      };
    });
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/20 px-0">
      <div className="motion-reveal max-h-[88dvh] w-full max-w-[430px] overflow-y-auto rounded-t-[26px] bg-bg px-6 pb-[max(20px,env(safe-area-inset-bottom))] pt-4 shadow-sheet">
        <div className="mx-auto mb-4 h-1 w-10 rounded-pill bg-faint-2/60" />
        <div className="mb-4 flex items-center justify-between">
          <button onClick={onClose} className="text-[13px] font-bold text-secondary">
            Cancel
          </button>
          <div className="text-[16px] font-extrabold">
            {initial ? "Edit item" : "Add item"}
          </div>
          <div className="w-12" />
        </div>

        <div className="flex flex-col gap-3.5">
          <Input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Item description"
            autoFocus
          />
          <div className="flex items-center rounded-[18px] bg-card px-4 py-2 shadow-card">
            <span className="text-[12px] font-bold text-secondary">{currency}</span>
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              className="min-w-0 flex-1 bg-transparent text-right text-[24px] font-extrabold outline-none"
            />
          </div>

          <div className="grid grid-cols-4 rounded-pill bg-track p-1">
            {MODES.map((option) => (
              <button
                key={option.value}
                onClick={() => setMode(option.value)}
                className={clsx(
                  "rounded-pill px-2 py-2 text-[12px] font-bold",
                  mode === option.value
                    ? "bg-card text-teal-dark shadow-card"
                    : "text-secondary",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="overflow-hidden rounded-[18px] bg-card px-4 shadow-card">
            {members.map((member, index) => {
              const included =
                mode === "equal"
                  ? includedIds.includes(member.id)
                  : numericValues[member.id] > 0;
              return (
                <div
                  key={member.id}
                  className={clsx(
                    "flex items-center gap-3 py-3",
                    index < members.length - 1 && "border-b border-black/5",
                  )}
                >
                  <button
                    onClick={() => {
                      if (mode !== "equal") return;
                      setIncludedIds((current) =>
                        current.includes(member.id)
                          ? current.filter((id) => id !== member.id)
                          : [...current, member.id],
                      );
                    }}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <Avatar
                      name={member.name}
                      seed={member.id}
                      avatarUrl={member.avatar_url}
                      size={34}
                      ring={included ? "teal" : "none"}
                    />
                    <span className="truncate text-[13.5px] font-semibold">{member.name}</span>
                  </button>
                  {mode === "equal" ? (
                    <span className="text-[12px] font-bold text-secondary">
                      {included && numericAmount > 0
                        ? formatMoney(numericAmount / includedIds.length, currency)
                        : "—"}
                    </span>
                  ) : (
                    <div className="flex w-[92px] items-center rounded-xl bg-tile px-2.5 py-2">
                      <input
                        value={values[member.id] ?? ""}
                        onChange={(event) =>
                          setValues((current) => ({
                            ...current,
                            [member.id]: event.target.value,
                          }))
                        }
                        inputMode="decimal"
                        aria-label={`${mode} split for ${member.name}`}
                        className="w-full bg-transparent text-right text-[12.5px] font-bold outline-none"
                      />
                      {mode === "percent" && <span className="text-[11px] text-secondary">%</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {mode !== "equal" && (
            <div
              className={clsx(
                "text-right text-[12px] font-semibold",
                valid ? "text-secondary" : "text-owe",
              )}
            >
              {mode === "exact"
                ? `${formatMoney(valueTotal, currency)} of ${formatMoney(numericAmount || 0, currency)}`
                : mode === "percent"
                  ? `${valueTotal}% of 100%`
                  : `${valueTotal} total shares`}
            </div>
          )}

          <Button
            fullWidth
            disabled={!valid}
            onClick={() =>
              onSave({
                id: initial?.id ?? crypto.randomUUID(),
                description: description.trim(),
                amount: numericAmount,
                splitMode: mode,
                shares: buildShares(),
              })
            }
          >
            {initial ? "Save item" : "Add item"}
          </Button>
          {initial && onDelete && (
            <button
              onClick={onDelete}
              className="py-2 text-center text-[13px] font-bold text-owe"
            >
              Remove item
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
