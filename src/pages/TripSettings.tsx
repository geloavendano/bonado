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
import { useManageTripGuests } from "@/hooks/useManageTripGuests";
import { useMobileFormFlow } from "@/hooks/useMobileFormFlow";

export function TripSettings() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const { trip, loading, reload } = useTrip(tripId);
  const { updateTrip, saving, error } = useUpdateTrip();
  const {
    addGuest,
    renameGuest,
    removeGuest,
    adding,
    busyGuestId,
    error: guestError,
  } = useManageTripGuests();

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [editingGuestId, setEditingGuestId] = useState<string | null>(null);
  const [confirmingGuestId, setConfirmingGuestId] = useState<string | null>(null);
  const [guestName, setGuestName] = useState("");
  const [newMemberName, setNewMemberName] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [showInviteLink, setShowInviteLink] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const formFlow = useMobileFormFlow(formRef);

  useEffect(() => {
    if (trip) {
      setName(trip.name);
      setLocation(trip.location_name ?? "");
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

  const dirty = name.trim() !== trip.name || location.trim() !== (trip.location_name ?? "");

  async function handleSave() {
    if (!tripId || name.trim().length === 0) return;
    const ok = await updateTrip(tripId, { name: name.trim(), locationName: location.trim() });
    if (ok) {
      navigate(`/trips/${tripId}`, {
        replace: true,
        state: { toast: "Changes have been saved." },
      });
    }
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
    <PageShell>
      <ScreenHeader title="Trip settings" />

      <div ref={formRef} {...formFlow.formProps} className="flex flex-col gap-3.5 pt-2.5 pb-28">
        <SectionLabel>Trip name</SectionLabel>
        <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus enterKeyHint="next" />

        <SectionLabel>Where to?</SectionLabel>
        <Input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="City, country"
          enterKeyHint="done"
        />

        {error && <p className="text-owe text-[13px]">{error}</p>}

        <div className="mt-2 flex items-center justify-between gap-3">
          <SectionLabel>Members · {trip.members.length}</SectionLabel>
          <button
            onClick={() => void shareInvite()}
            className="shrink-0 rounded-pill bg-card px-3 py-2 text-[12.5px] font-bold text-teal shadow-card"
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

        <div className="bg-card rounded-[18px] px-4 shadow-card">
          {trip.members.map((member, i) => (
            <div
              key={member.id}
              className={
                "flex items-center gap-3 py-3" +
                (i < trip.members.length - 1 ? " border-b border-black/5" : "")
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
