import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Loader2, Shield, Eye } from "lucide-react";
import { toast } from "sonner";

interface Profile {
  user_id: string;
  name: string;
}

const PERMISSIONS = [
  { key: "can_manage_boards", label: "Quadros", shortLabel: "Quadros" },
  { key: "can_manage_columns", label: "Colunas", shortLabel: "Colunas" },
  { key: "can_manage_tasks", label: "Tarefas", shortLabel: "Tarefas" },
  { key: "can_manage_recurring_tasks", label: "Tarefas Fixas", shortLabel: "T. Fixas" },
  { key: "can_view_purchases", label: "Ver Compras", shortLabel: "Ver Compras" },
  { key: "can_manage_purchases", label: "Ger. Compras", shortLabel: "Ger. Compras" },
  { key: "can_be_buyer", label: "Comprador", shortLabel: "Comprador" },
  { key: "can_view_fleet", label: "Ver Frota", shortLabel: "Ver Frota" },
  { key: "can_manage_fleet", label: "Ger. Frota", shortLabel: "Ger. Frota" },
  { key: "is_driver", label: "Motorista", shortLabel: "Motorista" },
  { key: "can_view_social", label: "Ver Social", shortLabel: "Ver Social" },
  { key: "can_manage_social", label: "Ger. Social", shortLabel: "Ger. Social" },
] as const;

type PermissionKey = typeof PERMISSIONS[number]["key"];

type UserPermission = Record<PermissionKey, boolean> & { user_id: string; id?: string };

export function PermissionsTab() {
  const queryClient = useQueryClient();

  const { data: profiles, isLoading: loadingProfiles } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, name")
        .order("name");
      if (error) throw error;
      return data as Profile[];
    },
  });

  const { data: adminRoles } = useQuery({
    queryKey: ["admin-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, role");
      if (error) throw error;
      return data;
    },
  });

  const { data: allPermissions, isLoading: loadingPerms } = useQuery({
    queryKey: ["all-user-permissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_permissions")
        .select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: teams, isLoading: loadingTeams } = useQuery({
    queryKey: ["all-teams"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: teamVisibility, isLoading: loadingVisibility } = useQuery({
    queryKey: ["all-team-visibility"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_team_visibility")
        .select("*");
      if (error) throw error;
      return data;
    },
  });

  const isAdmin = (userId: string) =>
    adminRoles?.some((r) => r.user_id === userId && r.role === "admin") ?? false;

  const nonAdminProfiles = profiles?.filter((p) => !isAdmin(p.user_id)) ?? [];

  const getPermissions = (userId: string): UserPermission => {
    const existing = allPermissions?.find((p: any) => p.user_id === userId);
    if (existing) return existing as any;
    return {
      user_id: userId,
      can_manage_boards: false,
      can_manage_columns: false,
      can_manage_tasks: false,
      can_manage_recurring_tasks: false,
      can_view_purchases: false,
      can_manage_purchases: false,
      can_be_buyer: false,
      can_view_fleet: false,
      can_manage_fleet: false,
      is_driver: false,
    };
  };

  const hasTeamVisibility = (userId: string, teamId: string) =>
    teamVisibility?.some((v) => v.user_id === userId && v.team_id === teamId) ?? false;

  const togglePermission = async (userId: string, key: PermissionKey, currentValue: boolean) => {
    try {
      const existing = allPermissions?.find((p: any) => p.user_id === userId);
      if (existing) {
        const { error } = await supabase
          .from("user_permissions")
          .update({ [key]: !currentValue })
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        const newRow: any = {
          user_id: userId,
          can_manage_boards: false,
          can_manage_columns: false,
          can_manage_tasks: false,
          can_manage_recurring_tasks: false,
          can_view_purchases: false,
          can_manage_purchases: false,
          can_be_buyer: false,
          [key]: true,
        };
        const { error } = await supabase
          .from("user_permissions")
          .insert(newRow);
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: ["all-user-permissions"] });
      queryClient.invalidateQueries({ queryKey: ["user-permissions"] });
      toast.success("Permissão atualizada");
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar permissão");
    }
  };

  const toggleTeamVisibility = async (userId: string, teamId: string, currentlyVisible: boolean) => {
    try {
      if (currentlyVisible) {
        const { error } = await supabase
          .from("user_team_visibility")
          .delete()
          .eq("user_id", userId)
          .eq("team_id", teamId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_team_visibility")
          .insert({ user_id: userId, team_id: teamId });
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: ["all-team-visibility"] });
      toast.success("Visibilidade atualizada");
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar visibilidade");
    }
  };

  const isLoading = loadingProfiles || loadingPerms || loadingTeams || loadingVisibility;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Permissões de Usuários
          </CardTitle>
          <CardDescription>
            Gerencie as permissões de cada usuário. Administradores possuem todas as permissões automaticamente e não aparecem nesta lista.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {nonAdminProfiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum usuário não-admin encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[140px]">Usuário</TableHead>
                    {PERMISSIONS.map((p) => (
                      <TableHead key={p.key} className="text-center text-xs min-w-[90px]">
                        {p.shortLabel}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nonAdminProfiles.map((profile) => {
                    const perms = getPermissions(profile.user_id);
                    return (
                      <TableRow key={profile.user_id}>
                        <TableCell className="font-medium text-sm">{profile.name}</TableCell>
                        {PERMISSIONS.map((perm) => (
                          <TableCell key={perm.key} className="text-center">
                            <div className="flex justify-center">
                              <Switch
                                checked={perms[perm.key]}
                                onCheckedChange={() =>
                                  togglePermission(profile.user_id, perm.key, perms[perm.key])
                                }
                              />
                            </div>
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Team Visibility */}
      {teams && teams.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Visibilidade de Quadros por Equipe
            </CardTitle>
            <CardDescription>
              Libere a visualização de todos os quadros de uma equipe para usuários que não são membros dela. Membros da equipe e administradores já possuem acesso automaticamente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {nonAdminProfiles.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum usuário não-admin encontrado.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[140px]">Usuário</TableHead>
                      {teams.map((team) => (
                        <TableHead key={team.id} className="text-center text-xs min-w-[100px]">
                          {team.name}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {nonAdminProfiles.map((profile) => (
                      <TableRow key={profile.user_id}>
                        <TableCell className="font-medium text-sm">{profile.name}</TableCell>
                        {teams.map((team) => {
                          const visible = hasTeamVisibility(profile.user_id, team.id);
                          return (
                            <TableCell key={team.id} className="text-center">
                              <div className="flex justify-center">
                                <Switch
                                  checked={visible}
                                  onCheckedChange={() =>
                                    toggleTeamVisibility(profile.user_id, team.id, visible)
                                  }
                                />
                              </div>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
