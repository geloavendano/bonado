import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

export function useCoverPhotoUpload() {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File): Promise<string | null> {
    if (!user) return null;
    setUploading(true);
    setError(null);

    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

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
