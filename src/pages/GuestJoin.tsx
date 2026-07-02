import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageShell } from "@/components/layout/PageShell";
import { CoverPhoto } from "@/components/ui/CoverPhoto";
import { AvatarStack } from "@/components/ui/AvatarStack";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
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
  const hasJoinedRef = useRef(false);

  // Once we have an authenticated session (guest or Google) and a resolved
  // trip, join it. Covers both the "Join as guest" button and returning
  // here after a "Continue with Google" redirect.
  useEffect(() => {
    if (authLoading || previewLoading || !user || !preview || hasJoinedRef.current) return;
    hasJoinedRef.current = true;

    (async () => {
      setJoining(true);
      const { error: joinError } = await supabase.rpc("join_trip", {
        p_trip_id: preview.trip_id,
      });

      if (joinError) {
        setError(joinError.message);
        setJoining(false);
        hasJoinedRef.current = false;
        return;
      }

      navigate(`/trips/${preview.trip_id}`, { replace: true });
    })();
  }, [authLoading, previewLoading, user, preview, navigate]);

  if (previewLoading) {
    return (
      <PageShell>
        <div className="text-secondary text-sm py-10 text-center">Loading invite…</div>
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

  return (
    <PageShell>
      <div className="flex flex-col gap-3.5 pt-6 pb-7">
        <CoverPhoto
          url={preview.cover_photo_url}
          label={`trip cover — ${preview.location_name ?? preview.name}`}
          className="h-[130px] rounded-[20px]"
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

        {joining || user ? (
          <div className="text-secondary text-sm text-center py-4">Joining…</div>
        ) : (
          <>
            <div className="text-xs font-bold uppercase tracking-[0.09em] text-secondary mt-1">
              Your name
            </div>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sofia"
            />

            {error && <p className="text-owe text-[13px]">{error}</p>}

            <Button
              fullWidth
              disabled={name.trim().length === 0}
              onClick={() => void signInAsGuest(name.trim()).catch((e) => setError(e.message))}
            >
              Join as guest
            </Button>

            <div className="flex items-center gap-3 text-faint-2 text-xs font-semibold">
              <div className="flex-1 border-t border-[#e5e7e6]" />
              or
              <div className="flex-1 border-t border-[#e5e7e6]" />
            </div>

            <button
              onClick={() => void signInWithGoogle(window.location.href)}
              className="bg-card border-[1.5px] border-[#e0e2e1] rounded-pill py-[14px] text-center font-bold text-[15px] flex items-center justify-center gap-2"
            >
              <span className="text-base">Ⓖ</span> Continue with Google
            </button>

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
