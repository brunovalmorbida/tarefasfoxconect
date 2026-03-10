import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, FolderOpen, Upload, ExternalLink, FileVideo, FileImage, File as FileIcon } from "lucide-react";
import { useDriveFiles, useUploadToDrive, DriveFile } from "@/hooks/useGoogleDrive";
import { toast } from "sonner";
import { PIPELINE_STATUSES } from "@/hooks/useSocialMedia";

const STAGE_MAP: Record<string, string> = {
  idea: "Ideias",
  recording: "Gravando",
  editing: "Editando",
  ready: "Pronto para Postar",
  published: "Publicado",
};

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("video/")) return <FileVideo className="h-4 w-4 text-blue-400" />;
  if (mimeType.startsWith("image/")) return <FileImage className="h-4 w-4 text-green-400" />;
  if (mimeType.includes("folder")) return <FolderOpen className="h-4 w-4 text-yellow-400" />;
  return <FileIcon className="h-4 w-4 text-muted-foreground" />;
}

interface Props {
  pipelineStatus: string;
  folderMapping: Record<string, string> | null;
}

export default function DriveFileBrowser({ pipelineStatus, folderMapping }: Props) {
  const stageName = STAGE_MAP[pipelineStatus] || "Ideias";
  const folderId = folderMapping?.[stageName] || null;

  const { data: files, isLoading } = useDriveFiles(folderId);
  const uploadMutation = useUploadToDrive();
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !folderId) return;

    try {
      await uploadMutation.mutateAsync({ file, folderId });
      toast.success("Arquivo enviado para o Google Drive!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar arquivo");
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  if (!folderId) {
    return (
      <div className="text-xs text-muted-foreground text-center py-3">
        Google Drive não configurado para esta etapa.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium">Google Drive — {stageName}</span>
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => fileRef.current?.click()}
            disabled={uploadMutation.isPending}
          >
            {uploadMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <Upload className="h-3 w-3 mr-1" />
            )}
            Upload
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() =>
              window.open(`https://drive.google.com/drive/folders/${folderId}`, "_blank")
            }
          >
            <ExternalLink className="h-3 w-3 mr-1" /> Abrir
          </Button>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept="image/*,video/*,.pdf,.doc,.docx"
        onChange={handleUpload}
      />

      {isLoading ? (
        <div className="flex justify-center py-3">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : !files || files.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">Nenhum arquivo nesta pasta.</p>
      ) : (
        <div className="space-y-1 max-h-[200px] overflow-y-auto">
          {files.map((file) => (
            <a
              key={file.id}
              href={file.webViewLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-1.5 rounded hover:bg-accent/50 transition-colors text-xs group"
            >
              {getFileIcon(file.mimeType)}
              <span className="flex-1 truncate">{file.name}</span>
              <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
