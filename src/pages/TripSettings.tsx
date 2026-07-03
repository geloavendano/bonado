import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { PageShell } from "@/components/layout/PageShell";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { Input } from "@/components/ui/Input";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { FormPageSkeleton } from "@/components/ui/Skeleton";
import { StickyActionBar } from "@/components/layout/StickyActionBar";
import { useTrip } from "@/hooks/useTrip";
import { useUpdateTrip } from "@/hooks/useUpdateTrip";
import { useDeleteTrip } from "@/hooks/useDeleteTrip";
import { useManageTripGuests } from "@/hooks/useManageTripGuests";
import { useMobileFormFlow } from "@/hooks/useMobileFormFlow";
import { useCoverPhotoUpload } from "@/hooks/useCoverPhotoUpload";
import { SUGGESTED_CURRENCIES, ALL_CURRENCIES } from "@/lib/currencies";
import { ChevronDown } from "@/components/ui/ChevronDown";
import { LocationField } from "@/components/trip/LocationField";
import { getCurrencyForCountry } from "@/lib/countryCurrency";
import clsx from "clsx";

export function TripSettings() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const { trip, loading, reload } = useTrip(tripId);
  const { updateTrip, saving, error } = useUpdateTrip();
  const { deleteTrip, deleting, error: deleteError } = useDeleteTrip();
  const {
    addGuest,
    renameGuest,
    removeGuest,
    adding,
    busyGuestId,
    error: guestError,
  } = useManageTripGuests();
  const { upload, uploading, error: coverError } = useCoverPhotoUpload();

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [locationPlaceId, setLocationPlaceId] = useState<string | null>(null);
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [currency, setCurrency] = useState("");
  const [coverPhotoUrl, setCoverPhotoUrl] = useState<string | null>(null);
  const [editingGuestId, setEditingGuestId] = useState<string | null>(null);
  const [confirmingGuestId, setConfirmingGuestId] = useState<string | null>(null);
  const [guestName, setGuestName] = useState("");
  const [newMemberName, setNewMemberName] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [showInviteLink, setShowInviteLink] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formFlow = useMobileFormFlow(formRef);

  useEffect(() => {
    if (trip) {
      setName(trip.name);
      setLocation(trip.location_name ?? "");
      setLocationPlaceId(trip.location_place_id);
      setLocationLat(trip.location_lat);
      setLocationLng(trip.location_lng);
      setCurrency(trip.default_currency);
      setCoverPhotoUrl(trip.cover_photo_url);
    }
  }, [trip]);

  if (loading) {
    return (
      <PageShell>
        <FormPageSkeleton />
      </PageShell>
    );
  }

  if (!trip) return <Navigate to="/" replace />;
  const previousCurrency = trip.default_currency;

  const dirty =
    name.trim() !== trip.name ||
    location.trim() !== (trip.location_name ?? "") ||
    currency !== trip.default_currency ||
    coverPhotoUrl !== trip.cover_photo_url;

  async function handleSave() {
    if (!tripId || name.trim().length === 0) return;
    const ok = await updateTrip(tripId, {
      name: name.trim(),
      locationName: location.trim(),
      locationPlaceId,
      locationLat,
      locationLng,
      defaultCurrency: currency,
      previousCurrency,
      coverPhotoUrl,
    });
    if (ok) {
      navigate(`/trips/${tripId}`, {
        replace: true,
        state: { toast: "Changes have been saved." },
      });
    }
  }

  async function handleCoverChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const url = await upload(file);
    if (url) setCoverPhotoUrl(url);
  }

  async function handleRenameGuest(guestId: string) {
    if (!tripId || guestName.trim().length === 0) return;
    if (await renameGuest(tripId, guestId, guestName.trim())) {
      setEditingGuestId(null);
      await reload();
    }
  }

  async function handleRemoveGuest(guestId: string) {
    if (!tripId) return;
    if (await removeGuest(tripId, guestId)) {
      setEditingGuestId(null);
      setConfirmingGuestId(null);
      await reload();
    }
  }

  async function handleAddGuest() {
    if (!tripId || newMemberName.trim().length === 0) return;
    if (await addGuest(tripId, newMemberName.trim())) {
      setNewMemberName("");
      setAddingMember(false);
      await reload();
    }
  }

  async function handleDeleteTrip() {
    if (!tripId) return;
    if (await deleteTrip(tripId)) {
      navigate("/", {
        replace: true,
        state: { toast: `${trip!.name} was deleted.` },
      });
    }
  }

  async function shareInvite() {
    const inviteUrl = `${window.location.origin}/join/${trip!.invite_link_token}`;
    const shareData = {
      title: `Join ${trip!.name} on bonado`,
      text: `You're invited to ${trip!.name}`,
      url: inviteUrl,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // A cancelled or unavailable share sheet falls back to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    } catch {
      setShowInviteLink(true);
    }
  }

  return (
    <PageShell className="lg:max-w-[880px]">
      <ScreenHeader title="Trip settings" />

      <div
        ref={formRef}
        {...formFlow.formProps}
        className="flex flex-col gap-3.5 pt-2.5 pb-28 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-10"
      >
        <div className="flex min-w-0 flex-col gap-3.5">
        <SectionLabel>Trip name</SectionLabel>
        <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus enterKeyHint="next" />

        <SectionLabel>Where to?</SectionLabel>
        <LocationField
          initialValue={trip.location_name ?? ""}
          resolved={Boolean(locationPlaceId)}
          onManualChange={(text) => {
            setLocation(text);
            setLocationPlaceId(null);
            setLocationLat(null);
            setLocationLng(null);
          }}
          onResolve={(details) => {
            setLocation(details.name);
            setLocationPlaceId(details.placeId);
            setLocationLat(details.lat);
            setLocationLng(details.lng);
            const localCurrency = details.countryCode
              ? getCurrencyForCountry(details.countryCode)
              : null;
            if (localCurrency) setCurrency(localCurrency);
          }}
        />

        <SectionLabel>Trip currency</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_CURRENCIES.map((item) => (
            <button
              key={item.code}
              onClick={() => setCurrency(item.code)}
              className={clsx(
                "rounded-pill border-2 px-4 py-2 text-[13.5px] font-bold",
                currency === item.code
                  ? "border-teal bg-teal-tint text-teal-dark"
                  : "border-transparent bg-card text-secondary shadow-[var(--shadow-card)]",
              )}
            >
              {item.code} {item.symbol}
            </button>
          ))}
          <div className="relative">
            <select
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              className="appearance-none rounded-pill border-2 border-transparent bg-card py-2 pl-4 pr-9 text-[13.5px] font-bold text-secondary shadow-[var(--shadow-card)] outline-none"
            >
              {!ALL_CURRENCIES.some((item) => item.code === currency) && currency && (
                <option value={currency}>{currency}</option>
              )}
              {ALL_CURRENCIES.map((item) => (
                <option key={item.code} value={item.code}>{item.code} · {item.name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
          </div>
        </div>
        {currency !== trip.default_currency && (
          <p className="text-[11px] leading-relaxed text-secondary">
            Existing expenses will be rebased to {currency} using the latest available rates.
          </p>
        )}

        <SectionLabel>Cover photo</SectionLabel>
        {coverPhotoUrl ? (
          <img src={coverPhotoUrl} alt="Trip cover" className="h-[140px] w-full rounded-[18px] object-cover" />
        ) : (
          <div className="cover-placeholder grid h-[140px] place-items-center rounded-[18px] text-[11px] text-faint">
            No cover photo
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleCoverChange} />
        <div className="flex gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="rounded-pill bg-card px-4 py-2.5 text-[12.5px] font-bold text-teal shadow-[var(--shadow-card)] disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "Change cover"}
          </button>
          {coverPhotoUrl && (
            <button onClick={() => setCoverPhotoUrl(null)} className="px-3 py-2.5 text-[12.5px] font-bold text-owe">
              Remove
            </button>
          )}
        </div>
        {coverError && <p className="text-[12.5px] text-owe">{coverError}</p>}

        {error && <p className="text-owe text-[13px]">{error}</p>}
        </div>

        <div className="flex min-w-0 flex-col gap-3.5">
        <div className="mt-2 flex items-center justify-between gap-3 lg:mt-0">
          <SectionLabel>Members · {trip.members.length}</SectionLabel>
          <button
            onClick={() => void shareInvite()}
            className="shrink-0 rounded-pill bg-card px-3 py-2 text-[12.5px] font-bold text-teal shadow-[var(--shadow-card)]"
          >
            {inviteCopied ? "Copied ✓" : "🔗 Share invite"}
          </button>
        </div>
        {showInviteLink && (
          <div className="motion-reveal">
            <Input
              value={`${window.location.origin}/join/${trip.invite_link_token}`}
              readOnly
              onFocus={(event) => event.currentTarget.select()}
              aria-label="Trip invite link"
              className="w-full text-[12.5px] font-normal"
            />
          </div>
        )}

        {trip.isOwner && (
          addingMember ? (
            <div className="motion-reveal flex items-center gap-2">
              <Input
                value={newMemberName}
                onChange={(event) => setNewMemberName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void handleAddGuest();
                }}
                placeholder="Temporary member name"
                aria-label="Temporary member name"
                className="min-w-0 flex-1"
                autoFocus
              />
              <button
                onClick={() => void handleAddGuest()}
                disabled={adding || newMemberName.trim().length === 0}
                className="rounded-pill bg-teal px-3.5 py-2.5 text-[13px] font-bold text-white disabled:opacity-50"
              >
                Add
              </button>
              <button
                onClick={() => {
                  setAddingMember(false);
                  setNewMemberName("");
                }}
                className="px-1 py-2 text-[13px] font-semibold text-secondary"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAddingMember(true)}
              className="w-full rounded-[16px] border border-dashed border-teal/35 bg-teal-tint/50 px-4 py-3 text-[13.5px] font-bold text-teal-dark"
            >
              + Add temporary member
            </button>
          )
        )}

        <div className="bg-card rounded-[18px] px-4 shadow-[var(--shadow-card)]">
          {trip.members.map((member, i) => (
            <div
              key={member.id}
              className={
                "flex items-center gap-3 py-3" +
                (i < trip.members.length - 1 ? " border-b border-hairline" : "")
              }
            >
              <Avatar name={member.name} seed={member.id} avatarUrl={member.avatar_url} size={36} />
              <div className="flex-1 min-w-0">
                {editingGuestId === member.id ? (
                  <div className="motion-reveal">
                    <Input
                      value={guestName}
                      onChange={(event) => setGuestName(event.target.value)}
                      className="w-full px-3 py-2 text-[14px]"
                      aria-label="Guest name"
                      autoFocus
                    />
                  </div>
                ) : (
                  <div className="font-semibold text-[14.5px] truncate">{member.name}</div>
                )}
                {!member.is_registered && editingGuestId !== member.id && (
                  <div className="text-[12px] text-faint">Guest</div>
                )}
              </div>
              {member.role === "owner" && (
                <div className="text-[12px] font-bold text-teal-dark bg-teal-tint rounded-pill px-2.5 py-1">
                  Owner
                </div>
              )}
              {trip.isOwner && !member.is_registered && member.role !== "owner" && (
                editingGuestId === member.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => void handleRenameGuest(member.id)}
                      disabled={busyGuestId === member.id || guestName.trim().length === 0}
                      className="rounded-pill bg-teal-tint px-2.5 py-1.5 text-[12px] font-bold text-teal-dark disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingGuestId(null)}
                      className="rounded-pill px-2 py-1.5 text-[12px] font-semibold text-secondary"
                    >
                      Cancel
                    </button>
                  </div>
                ) : confirmingGuestId === member.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => void handleRemoveGuest(member.id)}
                      disabled={busyGuestId === member.id}
                      className="rounded-pill bg-owe-tint px-2.5 py-1.5 text-[12px] font-bold text-owe disabled:opacity-50"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setConfirmingGuestId(null)}
                      className="rounded-pill px-2 py-1.5 text-[12px] font-semibold text-secondary"
                    >
                      Keep
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setConfirmingGuestId(null);
                        setEditingGuestId(member.id);
                        setGuestName(member.name);
                      }}
                      className="rounded-pill px-2.5 py-1.5 text-[12px] font-bold text-teal-dark"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        setEditingGuestId(null);
                        setConfirmingGuestId(member.id);
                      }}
                      disabled={busyGuestId === member.id}
                      className="rounded-pill px-2.5 py-1.5 text-[12px] font-bold text-owe disabled:opacity-50"
                      aria-label={`Remove ${member.name}`}
                    >
                      Remove
                    </button>
                  </div>
                )
              )}
            </div>
          ))}
        </div>
        {guestError && <p className="text-owe text-[13px]">{guestError}</p>}

        {trip.isOwner && (
          <>
            <SectionLabel className="mt-2 text-owe">Danger zone</SectionLabel>
            {confirmingDelete ? (
              <div className="motion-reveal flex flex-col gap-2 rounded-[18px] bg-owe-tint p-4">
                <p className="text-[12.5px] font-semibold text-owe">
                  This permanently deletes {trip.name} and all of its expenses and
                  settlements for everyone. This can't be undone.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => void handleDeleteTrip()}
                    disabled={deleting}
                    className="rounded-pill bg-owe px-4 py-2.5 text-[13px] font-bold text-white disabled:opacity-50"
                  >
                    {deleting ? "Deleting…" : "Delete trip"}
                  </button>
                  <button
                    onClick={() => setConfirmingDelete(false)}
                    className="rounded-pill px-4 py-2.5 text-[13px] font-semibold text-owe"
                  >
                    Keep trip
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="w-full rounded-[18px] bg-card px-4 py-3.5 text-center text-[13.5px] font-bold text-owe shadow-[var(--shadow-card)]"
              >
                Delete trip
              </button>
            )}
            {deleteError && <p className="text-owe text-[13px]">{deleteError}</p>}
          </>
        )}
        </div>
      </div>

      <StickyActionBar bottomOffset={formFlow.keyboardOffset}>
        <Button
          fullWidth
          disabled={!formFlow.keyboardOpen && (!dirty || saving || name.trim().length === 0)}
          onPointerDown={(event) => formFlow.keyboardOpen && event.preventDefault()}
          onClick={() => formFlow.keyboardOpen ? formFlow.advance() : void handleSave()}
        >
          {formFlow.keyboardOpen ? "Next →" : saving ? "Saving…" : "Save changes"}
        </Button>
      </StickyActionBar>
    </PageShell>
  );
}
