import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

export function GuestBanner() {
  const { user } = useAuth();
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user || user.is_registered) return null;

  async function claim() {
    setClaiming(true);
    setError(null);
    const { error } = await supabase.auth.linkIdentity({
      provider: "google",
      options: { redirectTo: window.location.href },
    });
    if (error) {
      setError(error.message);
      setClaiming(false);
    }
    // on success the browser navigates away to Google, then back here
  }

  return (
    <div className="bg-track rounded-[16px] px-4 py-3 flex items-center gap-3">
      <div className="flex-1 text-[13px] text-secondary font-medium">
        You're browsing as a guest.
      </div>
      <button
        onClick={() => void claim()}
        disabled={claiming}
        className="text-[13px] font-bold text-teal disabled:opacity-50 flex-none"
      >
        {claiming ? "…" : "Claim account"}
      </button>
      {error && <p className="text-owe text-[12px] w-full">{error}</p>}
    </div>
  );
}
