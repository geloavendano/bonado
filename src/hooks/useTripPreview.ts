import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface TripPreview {
  trip_id: string;
  name: string;
  location_name: string | null;
  cover_photo_url: string | null;
  member_count: number;
  members: {
    id: string;
    name: string;
    avatar_url: string | null;
    is_claimable: boolean;
  }[];
}

export function useTripPreview(token: string | undefined) {
  const [preview, setPreview] = useState<TripPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .rpc("get_trip_preview", { p_token: token })
        .maybeSingle<TripPreview>();

      if (cancelled) return;
      if (error) {
        setError(error.message);
      } else {
        setPreview(data);
      }
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return { preview, loading, error };
}
