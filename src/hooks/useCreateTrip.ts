import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import type { Trip } from "@/types/schema";

interface CreateTripInput {
  name: string;
  locationName: string;
  locationPlaceId: string | null;
  locationLat: number | null;
  locationLng: number | null;
  defaultCurrency: string;
  coverPhotoUrl: string | null;
  coverPhotoAttribution: string | null;
}

export function useCreateTrip() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createTrip(input: CreateTripInput) {
    if (!user) return;
    setSubmitting(true);
    setError(null);

    const { data: trip, error: rpcError } = await supabase
      .rpc("create_trip", {
        p_name: input.name,
        p_location_name: input.locationName,
        p_default_currency: input.defaultCurrency,
        p_cover_photo_url: input.coverPhotoUrl,
        p_location_place_id: input.locationPlaceId,
        p_location_lat: input.locationLat,
        p_location_lng: input.locationLng,
        p_cover_photo_attribution: input.coverPhotoAttribution,
      })
      .single<Trip>();

    if (rpcError || !trip) {
      setError(rpcError?.message ?? "Failed to create trip");
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    navigate(`/trips/${trip.id}`);
  }

  return { createTrip, submitting, error };
}
