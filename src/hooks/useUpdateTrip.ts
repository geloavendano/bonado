import { useState } from "react";
import { supabase } from "@/lib/supabase";

interface UpdateTripInput {
  name: string;
  locationName: string;
}

export function useUpdateTrip() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function updateTrip(tripId: string, input: UpdateTripInput) {
    setSaving(true);
    setError(null);

    const { error: updateError } = await supabase
      .from("trips")
      .update({ name: input.name, location_name: input.locationName || null })
      .eq("id", tripId);

    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return false;
    }
    return true;
  }

  return { updateTrip, saving, error };
}
