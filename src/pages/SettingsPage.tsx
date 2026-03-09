import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsAppAdmin, useCanManage } from "@/hooks/useUserRole";
import { UsersTab } from "@/components/settings/UsersTab";
import { IntegrationsTab } from "@/components/settings/IntegrationsTab";
import { ActivityLogTab } from "@/components/settings/ActivityLogTab";
import { PurchasesConfigTab } from "@/components/settings/PurchasesConfigTab";
import { NotificationsConfigTab } from "@/components/settings/NotificationsConfigTab";
import { PermissionsTab } from "@/components/settings/PermissionsTab";
import { TeamsTab } from "@/components/settings/TeamsTab";
import { FleetConfigTab } from "@/components/settings/FleetConfigTab";
import { Settings, Users, Plug, ScrollText, Download, ShoppingCart, Bell, Shield, Users2, Car } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { useLogActivity } from "@/hooks/useActivityLog";

export default function SettingsPage() {
  const { data: isAdmin } = useIsAppAdmin();
  const canManagePurchases = useCanManage("can_manage_purchases");
  const canViewPurchases = useCanManage("can_view_purchases");
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
        <TabsList className="flex-wrap">
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
            <TabsTrigger value="teams" className="gap-2">
              <Users2 className="h-4 w-4" />
              Equipes
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="permissions" className="gap-2">
              <Shield className="h-4 w-4" />
              Permissões
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
          {(isAdmin || canManagePurchases || canViewPurchases) && (
            <TabsTrigger value="purchases" className="gap-2">
              <ShoppingCart className="h-4 w-4" />
              Compras
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-4 w-4" />
              Notificações
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="general" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                TaskFox
              </CardTitle>
              <CardDescription>Versão atual do sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary" className="text-sm font-mono">v2.0</Badge>
            </CardContent>
          </Card>

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
          <TabsContent value="teams" className="mt-6">
            <TeamsTab />
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="permissions" className="mt-6">
            <PermissionsTab />
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
        {(isAdmin || canManagePurchases || canViewPurchases) && (
          <TabsContent value="purchases" className="mt-6">
            <PurchasesConfigTab />
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="notifications" className="mt-6">
            <NotificationsConfigTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
