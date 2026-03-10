import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, HardDrive, ExternalLink, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { useGoogleDriveStatus, getGoogleDriveAuthUrl } from "@/hooks/useGoogleDrive";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function GoogleDriveIntegration() {
  const { data: driveStatus, isLoading } = useGoogleDriveStatus();
  const queryClient = useQueryClient();

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "google-drive-connected") {
        toast.success(`Google Drive conectado: ${event.data.email}`);
        queryClient.invalidateQueries({ queryKey: ["google-drive-status"] });
      } else if (event.data?.type === "google-drive-error") {
        toast.error(`Erro: ${event.data.error}`);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [queryClient]);

  const handleConnect = () => {
    const url = getGoogleDriveAuthUrl();
    window.open(url, "google-drive-auth", "width=600,height=700,scrollbars=yes");
  };

  if (isLoading) {
    return <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  const isConnected = driveStatus?.is_connected;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
            <HardDrive className="h-5 w-5 text-blue-500" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">Google Drive</CardTitle>
              {isConnected ? (
                <Badge variant="default" className="text-xs bg-green-600">Conectado</Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">Desconectado</Badge>
              )}
            </div>
            <CardDescription>
              Integração com o Google Drive para armazenar vídeos e arquivos do módulo Social Media.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected ? (
          <>
            <div className="rounded-lg bg-muted/50 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>Conectado como <strong>{driveStatus?.connected_email}</strong></span>
              </div>
              <p className="text-xs text-muted-foreground">
                Pasta raiz: <strong>TaskFox Social Media</strong> com subpastas para cada etapa do pipeline.
              </p>
              {driveStatus?.folder_mapping && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {Object.keys(driveStatus.folder_mapping).map(stage => (
                    <Badge key={stage} variant="outline" className="text-[10px]">{stage}</Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  window.open(`https://drive.google.com/drive/folders/${driveStatus?.root_folder_id}`, "_blank")
                }
              >
                <ExternalLink className="h-4 w-4 mr-2" /> Abrir no Drive
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleConnect}
              >
                <RefreshCw className="h-4 w-4 mr-2" /> Reconectar
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-lg bg-muted/50 p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5" />
                <div className="text-xs text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">Como funciona:</p>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>Uma pasta <strong>TaskFox Social Media</strong> será criada no seu Drive</li>
                    <li>Subpastas automáticas para cada etapa: Ideias, Gravando, Editando, Pronto, Publicado</li>
                    <li>Upload direto de arquivos do módulo Social Media para o Drive</li>
                    <li>Visualização de arquivos do Drive dentro das tarefas</li>
                  </ul>
                </div>
              </div>
            </div>

            <Button onClick={handleConnect} className="w-full">
              <HardDrive className="h-4 w-4 mr-2" /> Conectar Google Drive
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
