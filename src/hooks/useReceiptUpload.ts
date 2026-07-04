import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { compressImage } from "@/lib/compressImage";

export function useReceiptUpload() {
  const { session, user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uploadReceipt(entryId: string, file: File) {
    if (!session || !user) return false;
    setUploading(true);
    setError(null);

    const upload = await compressImage(file);
    const extension = upload.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${session.user.id}/${entryId}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("receipts")
      .upload(path, upload, { contentType: upload.type, upsert: false });

    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return false;
    }

    const { error: rowError } = await supabase.from("entry_attachments").insert({
      entry_id: entryId,
      storage_path: path,
      uploaded_by: user.id,
    });
    if (rowError) {
      await supabase.storage.from("receipts").remove([path]);
      setError(rowError.message);
      setUploading(false);
      return false;
    }

    setUploading(false);
    return true;
  }

  return { uploadReceipt, uploading, error };
}
