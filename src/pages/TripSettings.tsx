import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { PageShell } from "@/components/layout/PageShell";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { Input } from "@/components/ui/Input";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { useTrip } from "@/hooks/useTrip";
import { useUpdateTrip } from "@/hooks/useUpdateTrip";

export function TripSettings() {
  const { tripId } = useParams<{ tripId: string }>();
  const { trip, loading, reload } = useTrip(tripId);
  const { updateTrip, saving, error } = useUpdateTrip();

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (trip) {
      setName(trip.name);
      setLocation(trip.location_name ?? "");
    }
  }, [trip]);

  if (loading) {
    return (
      <PageShell>
        <div className="text-secondary text-sm py-10 text-center">Loading…</div>
      </PageShell>
    );
  }

  if (!trip) return <Navigate to="/" replace />;

  const dirty = name.trim() !== trip.name || location.trim() !== (trip.location_name ?? "");

  async function handleSave() {
    if (!tripId || name.trim().length === 0) return;
    const ok = await updateTrip(tripId, { name: name.trim(), locationName: location.trim() });
    if (ok) {
      await reload();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  return (
    <PageShell>
      <ScreenHeader title="Trip settings" />

      <div className="flex flex-col gap-3.5 pt-2.5 pb-6">
        <SectionLabel>Trip name</SectionLabel>
        <Input value={name} onChange={(e) => setName(e.target.value)} />

        <SectionLabel>Where to?</SectionLabel>
        <Input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="City, country"
        />

        {error && <p className="text-owe text-[13px]">{error}</p>}

        <Button
          fullWidth
          disabled={!dirty || saving || name.trim().length === 0}
          onClick={() => void handleSave()}
        >
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save changes"}
        </Button>

        <SectionLabel className="mt-2">
          Members · {trip.members.length}
        </SectionLabel>
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
                <div className="font-semibold text-[14.5px] truncate">{member.name}</div>
                {!member.is_registered && (
                  <div className="text-[12px] text-faint">Guest</div>
                )}
              </div>
              {member.role === "owner" && (
                <div className="text-[12px] font-bold text-teal-dark bg-teal-tint rounded-pill px-2.5 py-1">
                  Owner
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
