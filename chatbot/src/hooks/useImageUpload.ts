import { useState, useCallback } from "react";
import { apiUploadImage } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";

const MAX_SIZE_MB = 5;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function useImageUpload(conversationId: string | null) {
  const { token, userId } = useAuth();
  const [preview, setPreview] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectFile = useCallback((file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Only JPEG, PNG, WebP or GIF images allowed");
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`Image must be under ${MAX_SIZE_MB} MB`);
      return;
    }
    setError(null);
    setPendingFile(file);
    setPreview(URL.createObjectURL(file));
  }, []);

  const clearFile = useCallback(() => {
    if (preview) URL.revokeObjectURL(preview);
    setPendingFile(null);
    setPreview(null);
    setError(null);
  }, [preview]);

  const uploadPending = useCallback(async (): Promise<string | undefined> => {
    if (!pendingFile || !token || !userId || !conversationId) return undefined;
    setUploading(true);
    setError(null);
    try {
      const { key } = await apiUploadImage(token, pendingFile, userId, conversationId);
      clearFile();
      return key;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
      return undefined;
    } finally {
      setUploading(false);
    }
  }, [pendingFile, token, userId, conversationId, clearFile]);

  return { preview, pendingFile, uploading, error, selectFile, clearFile, uploadPending };
}
