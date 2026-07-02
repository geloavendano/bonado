import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

export function useCoverPhotoUpload() {
  const { session } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File): Promise<string | null> {
    const authId = session?.user.id;
    if (!authId) return null;
    setUploading(true);
    setError(null);

    // Storage RLS checks the folder prefix against auth.uid(), which is the
    // Supabase auth user id — not bonado.users.id (a separate app-level id).
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${authId}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("trip-covers")
      .upload(path, file, { contentType: file.type });

    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return null;
    }

    const { data } = supabase.storage.from("trip-covers").getPublicUrl(path);
    setUploading(false);
    return data.publicUrl;
  }

  return { upload, uploading, error };
}
