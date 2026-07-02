import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageShell } from "@/components/layout/PageShell";
import { CoverPhoto } from "@/components/ui/CoverPhoto";
import { AvatarStack } from "@/components/ui/AvatarStack";
import { Avatar } from "@/components/ui/Avatar";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { TripPageSkeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/context/AuthContext";
import { useTripPreview } from "@/hooks/useTripPreview";
import { supabase } from "@/lib/supabase";

export function GuestJoin() {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading, signInAsGuest, signInWithGoogle } = useAuth();
  const { preview, loading: previewLoading, error: previewError } = useTripPreview(token);
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const storageKey = token ? `bonado:join:${token}` : "";
  const storedIdentity = storageKey ? sessionStorage.getItem(storageKey) : null;
  const [selectedIdentity, setSelectedIdentity] = useState<string>(
    storedIdentity ?? "new",
  );
  const [joinStarted, setJoinStarted] = useState(Boolean(storedIdentity));
  const hasJoinedRef = useRef(false);

  // Once we have an authenticated session (guest or Google) and a resolved
  // trip, join it. Covers both the "Join as guest" button and returning
  // here after a "Continue with Google" redirect.
  useEffect(() => {
    if (
      authLoading ||
      previewLoading ||
      !user ||
      !preview ||
      !joinStarted ||
      hasJoinedRef.current
    ) return;
    hasJoinedRef.current = true;

    (async () => {
      setJoining(true);
      const { error: joinError } = selectedIdentity === "new"
        ? await supabase.rpc("join_trip", { p_trip_id: preview.trip_id })
        : await supabase.rpc("claim_temporary_trip_member", {
            p_trip_id: preview.trip_id,
            p_guest_id: selectedIdentity,
          });

      if (joinError) {
        setError(joinError.message);
        setJoining(false);
        hasJoinedRef.current = false;
        return;
      }

      if (storageKey) sessionStorage.removeItem(storageKey);
      navigate(`/trips/${preview.trip_id}`, { replace: true });
    })();
  }, [
    authLoading,
    previewLoading,
    user,
    preview,
    navigate,
    joinStarted,
    selectedIdentity,
    storageKey,
  ]);

  if (previewLoading) {
    return (
      <PageShell>
        <TripPageSkeleton />
      </PageShell>
    );
  }

  if (previewError || !preview) {
    return (
      <PageShell className="flex flex-col items-center justify-center min-h-dvh gap-3 text-center">
        <div className="text-[17px] font-bold">Invite not found</div>
        <p className="text-secondary text-[14px] max-w-[280px]">
          This invite link is invalid or has expired.
        </p>
      </PageShell>
    );
  }

  const inviter = preview.members[0]?.name;
  const claimableMembers = preview.members.filter((member) => member.is_claimable);

  function beginJoin() {
    if (storageKey) sessionStorage.setItem(storageKey, selectedIdentity);
    setJoinStarted(true);
  }

  async function joinAsGuest() {
    const selectedMember = claimableMembers.find(
      (member) => member.id === selectedIdentity,
    );
    const guestName = selectedMember?.name ?? name.trim();
    if (!guestName) return;
    beginJoin();
    try {
      await signInAsGuest(guestName);
    } catch (joinError) {
      setJoinStarted(false);
      if (storageKey) sessionStorage.removeItem(storageKey);
      setError(joinError instanceof Error ? joinError.message : "Unable to join");
    }
  }

  function joinWithGoogle() {
    beginJoin();
    void signInWithGoogle(window.location.href);
  }

  return (
    <PageShell>
      <div className="flex flex-col gap-3.5 pt-6 pb-7">
        <CoverPhoto
          url={preview.cover_photo_url}
          label={`trip cover — ${preview.location_name ?? preview.name}`}
          className="h-[130px] w-full rounded-[20px]"
        />

        <div className="text-center flex flex-col items-center gap-1">
          <AvatarStack people={preview.members} size={34} />
          {inviter && (
            <div className="text-[15px] text-secondary font-semibold mt-1">
              {inviter} invited you to
            </div>
          )}
          <div className="text-2xl font-extrabold tracking-[-0.5px]">{preview.name}</div>
          <div className="text-[13px] text-secondary mt-0.5">
            {preview.member_count} {preview.member_count === 1 ? "person" : "people"}
          </div>
        </div>

        {joining ? (
          <div className="text-secondary text-sm text-center py-4">Joining…</div>
        ) : (
          <>
            {claimableMembers.length > 0 && (
              <>
                <div className="text-xs font-bold uppercase tracking-[0.09em] text-secondary mt-1">
                  Which person are you?
                </div>
                <div className="motion-reveal flex flex-col gap-2">
                  {claimableMembers.map((member) => (
                    <button
                      key={member.id}
                      onClick={() => setSelectedIdentity(member.id)}
                      className={
                        "flex items-center gap-3 rounded-[16px] border px-3 py-2.5 text-left " +
                        (selectedIdentity === member.id
                          ? "border-teal bg-teal-tint"
                          : "border-hairline bg-card")
                      }
                    >
                      <Avatar name={member.name} seed={member.id} size={34} />
                      <span className="flex-1 font-semibold text-[14px]">{member.name}</span>
                      <span className="text-[13px] font-bold text-teal">
                        {selectedIdentity === member.id ? "✓" : ""}
                      </span>
                    </button>
                  ))}
                  <button
                    onClick={() => setSelectedIdentity("new")}
                    className={
                      "rounded-[16px] border px-3 py-3 text-left text-[14px] font-semibold " +
                      (selectedIdentity === "new"
                        ? "border-teal bg-teal-tint text-teal-dark"
                        : "border-hairline bg-card text-secondary")
                    }
                  >
                    I’m not listed
                  </button>
                </div>
              </>
            )}

            {selectedIdentity === "new" && !user && (
              <>
                <div className="text-xs font-bold uppercase tracking-[0.09em] text-secondary mt-1">
                  Your name
                </div>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sofia"
                />
              </>
            )}

            {error && <p className="text-owe text-[13px]">{error}</p>}

            {user ? (
              <Button fullWidth onClick={beginJoin}>
                Join trip
              </Button>
            ) : (
              <>
                <Button
                  fullWidth
                  disabled={selectedIdentity === "new" && name.trim().length === 0}
                  onClick={() => void joinAsGuest()}
                >
                  Join as guest
                </Button>

                <div className="flex items-center gap-3 text-faint-2 text-xs font-semibold">
                  <div className="flex-1 border-t border-[var(--color-faint-2)]" />
                  or
                  <div className="flex-1 border-t border-[var(--color-faint-2)]" />
                </div>

                <button
                  onClick={joinWithGoogle}
                  className="bg-card border-[1.5px] border-[var(--color-faint-2)] rounded-pill py-[14px] text-center font-bold text-[15px] flex items-center justify-center gap-2"
                >
                  <span className="text-base">Ⓖ</span> Continue with Google
                </button>
              </>
            )}

            <p className="text-center text-secondary text-[12.5px] leading-relaxed">
              No account needed — you can claim your expenses with a full
              account anytime later.
            </p>
          </>
        )}
      </div>
    </PageShell>
  );
}
