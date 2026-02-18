import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsAppAdmin } from "@/hooks/useUserRole";
import { UsersTab } from "@/components/settings/UsersTab";
import { IntegrationsTab } from "@/components/settings/IntegrationsTab";
import { ActivityLogTab } from "@/components/settings/ActivityLogTab";
import { Settings, Users, Plug, ScrollText } from "lucide-react";

export default function SettingsPage() {
  const { data: isAdmin } = useIsAppAdmin();

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
        </TabsList>

        <TabsContent value="general" className="mt-6">
          <p className="text-muted-foreground">Configurações gerais do sistema.</p>
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
      </Tabs>
    </div>
  );
}
