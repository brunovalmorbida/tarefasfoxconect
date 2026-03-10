import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  iconLink?: string;
  thumbnailLink?: string;
  modifiedTime: string;
  size?: string;
}

export function useGoogleDriveStatus() {
  return useQuery({
    queryKey: ["google-drive-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("google_drive_config" as any)
        .select("is_connected, connected_email, root_folder_id, folder_mapping")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as { is_connected: boolean; connected_email: string; root_folder_id: string; folder_mapping: Record<string, string> } | null;
    },
  });
}

export function useDriveFiles(folderId: string | null) {
  return useQuery({
    queryKey: ["drive-files", folderId],
    enabled: !!folderId,
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const res = await fetch(`${SUPABASE_URL}/functions/v1/google-drive-api`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: "list-files", folderId }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to list files");
      }

      const data = await res.json();
      return data.files as DriveFile[];
    },
  });
}

export function useUploadToDrive() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ file, folderId }: { file: File; folderId: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Convert file to base64
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      const res = await fetch(`${SUPABASE_URL}/functions/v1/google-drive-api`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: "upload",
          fileName: file.name,
          fileBase64: base64,
          mimeType: file.type,
          folderId,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }

      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["drive-files"] });
    },
  });
}

export function getGoogleDriveAuthUrl() {
  const clientId = "1095217366408-glfgggu691l8aecm27l9qh23egh0imil.apps.googleusercontent.com";
  const redirectUri = `${SUPABASE_URL}/functions/v1/google-drive-callback`;
  const scopes = [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/userinfo.email",
  ].join(" ");

  return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent`;
}
