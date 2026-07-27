import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { createPortal } from "react-dom";
import { Avatar } from "@/components/ui/Avatar";
import { ChevronDown } from "@/components/ui/ChevronDown";
import { useOverlayA11y } from "@/hooks/useOverlayA11y";
import { usePaymentAccounts } from "@/hooks/usePaymentAccounts";
import { usePushPermission } from "@/hooks/usePushPermission";
import { useTheme, type ThemePreference } from "@/context/ThemeContext";
import { ALL_CURRENCIES } from "@/lib/currencies";
import type { PaymentAccount, PaymentMethod, User } from "@/types/schema";

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const PAYMENT_METHODS: PaymentMethod[] = ["Bank", "Card", "Cash", "Other"];

function Sheet({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const panelRef = useOverlayA11y<HTMLDivElement>(open, onClose);
  if (!open) return null;
  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[130] bg-black/40"
        onPointerDown={(event) => {
          event.stopPropagation();
          onClose();
        }}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="motion-reveal fixed inset-x-0 bottom-0 z-[140] max-h-[82dvh] overflow-y-auto rounded-t-[28px] bg-card p-4 pb-[max(18px,env(safe-area-inset-bottom))] shadow-[var(--shadow-sheet)] lg:left-1/2 lg:right-auto lg:top-1/2 lg:bottom-auto lg:max-h-[min(720px,88vh)] lg:w-[420px] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-[24px]"
      >
        <div className="sticky top-0 z-10 -mx-4 -mt-4 mb-3 flex items-center justify-between bg-card px-4 pb-2 pt-4">
          <button
            onClick={onClose}
            className="text-[12.5px] font-bold text-secondary"
          >
            Cancel
          </button>
          <div className="text-[16px] font-extrabold tracking-[-0.2px]">
            {title}
          </div>
          <div className="w-[48px]" />
        </div>
        {children}
      </div>
    </>,
    document.body,
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-hairline py-2.5 first:border-t-0 first:pt-0">
      <div className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-[0.08em] text-secondary">
        {title}
      </div>
      <div className="overflow-hidden rounded-[14px] bg-tile">{children}</div>
    </div>
  );
}

function SettingsRow({
  label,
  value,
  detail,
  tone = "default",
  onClick,
  disclosure = Boolean(onClick),
}: {
  label: string;
  value?: string;
  detail?: string;
  tone?: "default" | "danger" | "teal";
  disclosure?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="min-w-0">
        <div
          className={
            "truncate text-[13px] font-bold " +
            (tone === "danger"
              ? "text-owe"
              : tone === "teal"
                ? "text-teal-dark"
                : "text-ink")
          }
        >
          {label}
        </div>
        {detail && (
          <div className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-faint">
            {detail}
          </div>
        )}
      </div>
      <div className="ml-auto flex min-w-0 shrink-0 items-center gap-2">
        {value && (
          <div className="max-w-[130px] truncate text-right text-[12px] font-bold text-secondary">
            {value}
          </div>
        )}
        {onClick && disclosure && (
          <ChevronDown className="-rotate-90 text-faint" />
        )}
      </div>
    </>
  );

  if (!onClick) {
    return (
      <div className="flex w-full items-center gap-3 border-t border-hairline px-3 py-3 first:border-t-0">
        {content}
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 border-t border-hairline px-3 py-3 text-left first:border-t-0"
    >
      {content}
    </button>
  );
}

function AppearanceControl({
  value,
  onChange,
}: {
  value: ThemePreference;
  onChange: (value: ThemePreference) => void;
}) {
  return (
    <div className="grid grid-cols-3 border-t border-hairline p-1 first:border-t-0">
      {THEME_OPTIONS.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={
            "rounded-[11px] px-1 py-2.5 text-[12px] font-bold transition-colors " +
            (value === option.value
              ? "bg-card text-teal-dark shadow-[var(--shadow-card)]"
              : "text-secondary")
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function CurrencyPickerSheet({
  open,
  selected,
  onClose,
  onSelect,
}: {
  open: boolean;
  selected: string;
  onClose: () => void;
  onSelect: (currency: string) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return ALL_CURRENCIES;
    return ALL_CURRENCIES.filter(
      (currency) =>
        currency.code.toLowerCase().includes(normalized) ||
        currency.name.toLowerCase().includes(normalized),
    );
  }, [query]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  return (
    <Sheet title="Display currency" open={open} onClose={onClose}>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search currency"
        className="mb-3 w-full rounded-[16px] bg-tile px-4 py-3 text-[14px] font-bold outline-none placeholder:text-faint"
      />
      <div className="overflow-hidden rounded-[16px] bg-tile">
        {filtered.map((currency) => (
          <button
            key={currency.code}
            onClick={() => {
              onSelect(currency.code);
              onClose();
            }}
            className="flex w-full items-center gap-3 border-t border-hairline px-4 py-3 text-left first:border-t-0"
          >
            <div className="grid size-9 place-items-center rounded-full bg-card text-[13px] font-extrabold text-secondary">
              {currency.symbol}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-bold text-ink">
                {currency.code}
              </div>
              <div className="truncate text-[11.5px] text-secondary">
                {currency.name}
              </div>
            </div>
            {selected === currency.code && (
              <div className="text-[13px] font-extrabold text-teal">
                Selected
              </div>
            )}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

function SettlementAccountsSheet({
  user,
  open,
  onClose,
}: {
  user: User;
  open: boolean;
  onClose: () => void;
}) {
  const { accounts, loading, error, upsertAccount, deleteAccount } =
    usePaymentAccounts(user.id);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [method, setMethod] = useState<PaymentMethod>("Bank");
  const [label, setLabel] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [currency, setCurrency] = useState(user.preferred_currency);
  const editing = accounts.find((account) => account.id === editingId);

  function startEdit(account: PaymentAccount) {
    setFormOpen(true);
    setEditingId(account.id);
    setMethod(account.method);
    setLabel(account.label);
    setAccountName(account.account_name ?? "");
    setAccountNumber(account.account_number ?? "");
    setCurrency(account.currency);
  }

  function startAdd() {
    resetForm();
    setFormOpen(true);
  }

  function resetForm() {
    setEditingId(undefined);
    setMethod("Bank");
    setLabel("");
    setAccountName("");
    setAccountNumber("");
    setCurrency(user.preferred_currency);
  }

  async function saveAccount() {
    const ok = await upsertAccount(
      {
        method,
        label,
        accountName,
        accountNumber,
        currency,
      },
      editingId,
    );
    if (ok) {
      resetForm();
      setFormOpen(false);
    }
  }

  return (
    <Sheet title="Receiving accounts" open={open} onClose={onClose}>
      <p className="mb-3 px-1 text-[12.5px] leading-snug text-secondary">
        These details are shown to tripmates when they record settlements to
        you.
      </p>

      {loading && <div className="px-1 text-[12px] text-secondary">Loading accounts…</div>}

      {!loading && accounts.length === 0 && !formOpen && (
        <div className="rounded-[18px] bg-tile px-4 py-6 text-center">
          <div className="text-[14px] font-bold">No receiving accounts yet</div>
          <p className="mt-1 text-[12px] text-secondary">
            Add a bank, card, cash, or other payment detail for settlements.
          </p>
        </div>
      )}

      {!loading && accounts.length > 0 && (
        <div className="mb-3 flex flex-col gap-2">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="rounded-[16px] bg-tile px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-[13.5px] font-bold text-ink">
                    {account.method} · {account.label}
                  </div>
                  <div className="mt-1 truncate text-[12px] text-secondary">
                    {account.account_name || "No account name set"}
                  </div>
                  <div className="truncate text-[12px] text-secondary">
                    {account.account_number || "No account number/handle set"}
                  </div>
                  <div className="mt-1 text-[10.5px] font-bold uppercase tracking-[0.06em] text-faint">
                    {account.currency}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2 text-[12px] font-bold">
                  <button onClick={() => startEdit(account)} className="text-teal">
                    Edit
                  </button>
                  <button
                    onClick={() => void deleteAccount(account.id)}
                    className="text-owe"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!formOpen && (
        <button
          onClick={startAdd}
          className="w-full rounded-[16px] border border-dashed border-teal/45 bg-teal-soft/40 px-4 py-3 text-[13px] font-extrabold text-teal-dark"
        >
          + Add receiving account
        </button>
      )}

      {formOpen && (
        <div className="motion-reveal mt-3 rounded-[18px] bg-tile p-3">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-secondary">
            {editing ? "Edit account" : "New account"}
          </div>
          <div className="grid gap-2">
            <div className="grid grid-cols-[0.85fr_1.15fr] gap-2">
              <label className="relative min-w-0">
                <select
                  value={method}
                  onChange={(event) => setMethod(event.target.value as PaymentMethod)}
                  className="w-full appearance-none rounded-[14px] bg-card py-3 pl-3 pr-9 text-[13px] font-bold text-ink outline-none"
                  aria-label="Settlement account method"
                >
                  {PAYMENT_METHODS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
              </label>
              <input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder={method === "Bank" ? "BDO, BPI…" : "Label"}
                className="min-w-0 rounded-[14px] bg-card px-3 py-3 text-[13px] font-bold outline-none placeholder:text-faint"
              />
            </div>
            <input
              value={accountName}
              onChange={(event) => setAccountName(event.target.value)}
              placeholder="Account name"
              className="min-w-0 rounded-[14px] bg-card px-3 py-3 text-[13px] font-bold outline-none placeholder:text-faint"
            />
            <div className="grid grid-cols-[1fr_92px] gap-2">
              <input
                value={accountNumber}
                onChange={(event) => setAccountNumber(event.target.value)}
                placeholder="Account number / handle"
                className="min-w-0 rounded-[14px] bg-card px-3 py-3 text-[13px] font-bold outline-none placeholder:text-faint"
              />
              <select
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
                className="min-w-0 rounded-[14px] bg-card px-2 py-3 text-[13px] font-bold outline-none"
                aria-label="Settlement account currency"
              >
                {ALL_CURRENCIES.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.code}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => void saveAccount()}
                disabled={!label.trim() && !accountName.trim() && !accountNumber.trim()}
                className="rounded-full bg-teal px-4 py-2.5 text-[12px] font-bold text-white disabled:opacity-50"
              >
                {editing ? "Save account" : "Add account"}
              </button>
              <button
                onClick={() => {
                  resetForm();
                  setFormOpen(false);
                }}
                className="px-2 py-2 text-[12px] font-bold text-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {error && <p className="mt-2 px-1 text-[11.5px] text-owe">{error}</p>}
    </Sheet>
  );
}

export function AccountSettingsMenu({
  user,
  updateProfile,
  signOut,
  onDeleteAccount,
  buttonClassName,
}: {
  user: User;
  updateProfile: (profile: { preferredCurrency?: string }) => Promise<boolean>;
  signOut: () => Promise<void>;
  onDeleteAccount: () => void;
  buttonClassName?: string;
}) {
  const accountRef = useRef<HTMLDivElement>(null);
  const { preference: themePreference, setPreference: setThemePreference } =
    useTheme();
  const pushPermission = usePushPermission(user.id);
  const { accounts, loading: accountsLoading } = usePaymentAccounts(user.id);
  const [open, setOpen] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [accountsOpen, setAccountsOpen] = useState(false);

  useEffect(() => {
    function closeAccount(event: PointerEvent) {
      if (!accountRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeAccount);
    return () => document.removeEventListener("pointerdown", closeAccount);
  }, []);

  useEffect(() => {
    function openFromNative() {
      window.dispatchEvent(new CustomEvent("bonado:close-notifications"));
      setOpen(true);
      setCurrencyOpen(false);
      setAccountsOpen(false);
    }

    function toggleFromNative() {
      setOpen((isOpen) => {
        if (!isOpen) {
          window.dispatchEvent(new CustomEvent("bonado:close-notifications"));
          setCurrencyOpen(false);
          setAccountsOpen(false);
        }
        return !isOpen;
      });
    }

    function closeFromNative() {
      setOpen(false);
      setCurrencyOpen(false);
      setAccountsOpen(false);
    }

    window.addEventListener("bonado:open-account-menu", openFromNative);
    window.addEventListener("bonado:toggle-account-menu", toggleFromNative);
    window.addEventListener("bonado:close-account-menu", closeFromNative);
    return () => {
      window.removeEventListener("bonado:open-account-menu", openFromNative);
      window.removeEventListener("bonado:toggle-account-menu", toggleFromNative);
      window.removeEventListener("bonado:close-account-menu", closeFromNative);
    };
  }, []);

  function openCurrency() {
    setOpen(false);
    setCurrencyOpen(true);
  }

  function openAccounts() {
    setOpen(false);
    setAccountsOpen(true);
  }

  const notificationValue = pushPermission.enabled
    ? "Enabled"
    : pushPermission.permission === "denied"
      ? "Blocked"
      : "Off";
  const accountsValue = accountsLoading
    ? "Loading"
    : accounts.length === 1
      ? "1 account"
      : `${accounts.length} accounts`;

  return (
    <>
      <div ref={accountRef} className="relative z-30">
        <button
          onClick={() => {
            if (!open) {
              window.dispatchEvent(new CustomEvent("bonado:close-notifications"));
              setCurrencyOpen(false);
              setAccountsOpen(false);
            }
            setOpen((value) => !value);
          }}
          aria-label="Account menu"
          aria-expanded={open}
          className={buttonClassName}
        >
          <Avatar
            name={user.name}
            seed={user.id}
            avatarUrl={user.avatar_url}
            size={38}
          />
        </button>

        {open && (
          <div
            data-native-nav-hidden="true"
            className="motion-reveal absolute right-0 top-12 max-h-[min(720px,calc(100dvh-92px))] w-[min(360px,calc(100vw-28px))] overflow-y-auto rounded-[22px] bg-card p-3 shadow-[var(--shadow-floating)]"
          >
            <div className="flex items-center gap-3 px-1 pb-3">
              <Avatar
                name={user.name}
                seed={user.id}
                avatarUrl={user.avatar_url}
                size={42}
              />
              <div className="min-w-0">
                <div className="truncate text-[14.5px] font-extrabold">
                  {user.name}
                </div>
                <div className="truncate text-[11.5px] text-secondary">
                  {user.email}
                </div>
              </div>
            </div>

            <Section title="Preferences">
              <SettingsRow
                label="Display Currency"
                value={user.preferred_currency}
                onClick={openCurrency}
              />
              <AppearanceControl
                value={themePreference}
                onChange={setThemePreference}
              />
              {pushPermission.supported && (
                <SettingsRow
                  label="Notifications"
                  value={notificationValue}
                  detail={pushPermission.description}
                  tone={pushPermission.enabled ? "teal" : "default"}
                  disclosure={false}
                  onClick={() => void pushPermission.enable()}
                />
              )}
            </Section>

            <Section title="Payments">
              <SettingsRow
                label="Receiving Accounts"
                value={accountsValue}
                detail="Shown to tripmates when they record settlements to you."
                onClick={openAccounts}
              />
            </Section>

            <Section title="Support & Legal">
              <Link
                to="/legal/privacy"
                className="flex w-full items-center justify-between border-t border-hairline px-3 py-3 text-[13px] font-bold text-teal first:border-t-0"
              >
                Privacy Policy
                <ChevronDown className="-rotate-90 text-faint" />
              </Link>
              <Link
                to="/legal/terms"
                className="flex w-full items-center justify-between border-t border-hairline px-3 py-3 text-[13px] font-bold text-teal first:border-t-0"
              >
                Terms of Service
                <ChevronDown className="-rotate-90 text-faint" />
              </Link>
              <a
                href="mailto:support@bonado.app"
                className="flex w-full items-center justify-between border-t border-hairline px-3 py-3 text-[13px] font-bold text-teal first:border-t-0"
              >
                Contact Support
                <ChevronDown className="-rotate-90 text-faint" />
              </a>
            </Section>

            <Section title="Account">
              <SettingsRow
                label="Log out"
                tone="danger"
                disclosure={false}
                onClick={() => void signOut()}
              />
              <SettingsRow
                label="Delete Account"
                detail="Permanently removes your account and sign-in."
                tone="danger"
                disclosure={false}
                onClick={() => {
                  setOpen(false);
                  onDeleteAccount();
                }}
              />
            </Section>
          </div>
        )}
      </div>

      <CurrencyPickerSheet
        open={currencyOpen}
        selected={user.preferred_currency}
        onClose={() => setCurrencyOpen(false)}
        onSelect={(currency) => void updateProfile({ preferredCurrency: currency })}
      />
      <SettlementAccountsSheet
        user={user}
        open={accountsOpen}
        onClose={() => setAccountsOpen(false)}
      />
    </>
  );
}
