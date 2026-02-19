import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsAppAdmin } from "@/hooks/useUserRole";
import { UsersTab } from "@/components/settings/UsersTab";
import { IntegrationsTab } from "@/components/settings/IntegrationsTab";
import { ActivityLogTab } from "@/components/settings/ActivityLogTab";
import { PurchasesConfigTab } from "@/components/settings/PurchasesConfigTab";
import { Settings, Users, Plug, ScrollText, Download, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { useLogActivity } from "@/hooks/useActivityLog";

export default function SettingsPage() {
  const { data: isAdmin } = useIsAppAdmin();
  const [exporting, setExporting] = useState(false);
  const logActivity = useLogActivity();

  const handleExportBackup = async () => {
    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("export-backup");
      if (error) throw error;

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Backup exportado com sucesso!");
      await logActivity("Exportou backup do sistema");
    } catch (err: any) {
      toast.error("Erro ao exportar backup: " + err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>

      <Tabs defaultValue="general" className="w-full">
        <TabsList>
          <TabsTrigger value="general" className="gap-2">
            <Settings className="h-4 w-4" />
            Geral
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              Usuários
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="integrations" className="gap-2">
              <Plug className="h-4 w-4" />
              Integrações
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="log" className="gap-2">
              <ScrollText className="h-4 w-4" />
              Log
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="purchases" className="gap-2">
              <ShoppingCart className="h-4 w-4" />
              Compras
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="general" className="mt-6 space-y-4">
          <p className="text-muted-foreground">Configurações gerais do sistema.</p>

          {isAdmin && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Backup do Sistema
                </CardTitle>
                <CardDescription>
                  Exporte todos os dados do sistema em formato JSON para migração ou backup.
                  Inclui equipes, quadros, tarefas, usuários, permissões, configurações e logs.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={handleExportBackup} disabled={exporting}>
                  {exporting ? "Exportando..." : "Exportar Backup Completo"}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {isAdmin && (
          <TabsContent value="users" className="mt-6">
            <UsersTab />
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="integrations" className="mt-6">
            <IntegrationsTab />
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="log" className="mt-6">
            <ActivityLogTab />
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="purchases" className="mt-6">
            <PurchasesConfigTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
