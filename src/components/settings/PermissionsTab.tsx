import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Shield, Eye, Settings2, ClipboardList, ShoppingCart, Car, Megaphone, UserCog, Check } from "lucide-react";
import { toast } from "sonner";

interface Profile {
  user_id: string;
  name: string;
  job_title: string | null;
}

// ── Permission keys ──
const ALL_PERMISSION_KEYS = [
  "can_manage_boards",
  "can_manage_columns",
  "can_manage_tasks",
  "can_manage_recurring_tasks",
  "can_view_purchases",
  "can_manage_purchases",
  "can_be_buyer",
  "can_view_fleet",
  "can_manage_fleet",
  "is_driver",
  "can_view_social",
  "can_manage_social",
] as const;

type PermissionKey = typeof ALL_PERMISSION_KEYS[number];

// ── Modules ──
const MODULES = [
  {
    id: "tasks",
    label: "Tarefas",
    icon: ClipboardList,
    permissions: [
      { key: "can_manage_boards" as PermissionKey, label: "Gerenciar Quadros", description: "Criar, editar e excluir quadros Kanban" },
      { key: "can_manage_columns" as PermissionKey, label: "Gerenciar Colunas", description: "Criar, editar e excluir colunas" },
      { key: "can_manage_tasks" as PermissionKey, label: "Gerenciar Tarefas", description: "Criar, editar e excluir tarefas" },
      { key: "can_manage_recurring_tasks" as PermissionKey, label: "Gerenciar Tarefas Fixas", description: "Criar, editar e excluir tarefas recorrentes" },
    ],
  },
  {
    id: "purchases",
    label: "Compras",
    icon: ShoppingCart,
    permissions: [
      { key: "can_view_purchases" as PermissionKey, label: "Visualizar Compras", description: "Acessar e visualizar listas de compras" },
      { key: "can_manage_purchases" as PermissionKey, label: "Gerenciar Compras", description: "Cadastrar e editar categorias e produtos" },
      { key: "can_be_buyer" as PermissionKey, label: "Responsável por Compras", description: "Pode ser selecionado como comprador" },
    ],
  },
  {
    id: "fleet",
    label: "Frota",
    icon: Car,
    permissions: [
      { key: "can_view_fleet" as PermissionKey, label: "Visualizar Frota", description: "Acessar e visualizar veículos e manutenções" },
      { key: "can_manage_fleet" as PermissionKey, label: "Gerenciar Frota", description: "Cadastrar e editar veículos, motoristas e manutenções" },
      { key: "is_driver" as PermissionKey, label: "Motorista", description: "Recebe check-ins e pode responder via WhatsApp" },
    ],
  },
  {
    id: "social",
    label: "Social Media",
    icon: Megaphone,
    permissions: [
      { key: "can_view_social" as PermissionKey, label: "Visualizar Social", description: "Acessar e visualizar tarefas de social media" },
      { key: "can_manage_social" as PermissionKey, label: "Gerenciar Social", description: "Criar, editar e excluir tarefas e metas" },
    ],
  },
];

// ── Predefined profiles ──
type ProfilePreset = {
  id: string;
  label: string;
  description: string;
  permissions: Record<PermissionKey, boolean>;
};

const defaultPerms = (): Record<PermissionKey, boolean> =>
  Object.fromEntries(ALL_PERMISSION_KEYS.map((k) => [k, false])) as Record<PermissionKey, boolean>;

const PROFILE_PRESETS: ProfilePreset[] = [
  {
    id: "gerente",
    label: "Gerente",
    description: "Acesso total a tarefas, compras e visualização de frota e social",
    permissions: {
      ...defaultPerms(),
      can_manage_boards: true,
      can_manage_columns: true,
      can_manage_tasks: true,
      can_manage_recurring_tasks: true,
      can_view_purchases: true,
      can_manage_purchases: true,
      can_be_buyer: true,
      can_view_fleet: true,
      can_view_social: true,
    },
  },
  {
    id: "operador",
    label: "Operador",
    description: "Gerencia tarefas e visualiza compras",
    permissions: {
      ...defaultPerms(),
      can_manage_boards: true,
      can_manage_columns: true,
      can_manage_tasks: true,
      can_manage_recurring_tasks: true,
      can_view_purchases: true,
    },
  },
  {
    id: "financeiro",
    label: "Financeiro",
    description: "Acesso completo a compras e visualização de tarefas",
    permissions: {
      ...defaultPerms(),
      can_view_purchases: true,
      can_manage_purchases: true,
      can_be_buyer: true,
    },
  },
  {
    id: "marketing",
    label: "Marketing",
    description: "Acesso completo ao social media e visualização de tarefas",
    permissions: {
      ...defaultPerms(),
      can_manage_tasks: true,
      can_view_social: true,
      can_manage_social: true,
    },
  },
  {
    id: "motorista",
    label: "Motorista",
    description: "Acesso à frota como motorista",
    permissions: {
      ...defaultPerms(),
      can_view_fleet: true,
      is_driver: true,
    },
  },
  {
    id: "custom",
    label: "Personalizado",
    description: "Permissões definidas manualmente",
    permissions: defaultPerms(),
  },
];

function detectProfile(perms: Record<PermissionKey, boolean>): string {
  for (const preset of PROFILE_PRESETS) {
    if (preset.id === "custom") continue;
    const match = ALL_PERMISSION_KEYS.every((k) => preset.permissions[k] === perms[k]);
    if (match) return preset.id;
  }
  return "custom";
}

export function PermissionsTab() {
  const queryClient = useQueryClient();
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [localPerms, setLocalPerms] = useState<Record<PermissionKey, boolean>>(defaultPerms());
  const [saving, setSaving] = useState(false);

  const { data: profiles, isLoading: loadingProfiles } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, name, job_title")
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

  const getPermissions = (userId: string): Record<PermissionKey, boolean> => {
    const existing = allPermissions?.find((p: any) => p.user_id === userId);
    if (existing) {
      return Object.fromEntries(ALL_PERMISSION_KEYS.map((k) => [k, (existing as any)[k] ?? false])) as Record<PermissionKey, boolean>;
    }
    return defaultPerms();
  };

  const hasTeamVisibility = (userId: string, teamId: string) =>
    teamVisibility?.some((v) => v.user_id === userId && v.team_id === teamId) ?? false;

  const getActiveProfile = (userId: string) => {
    const perms = getPermissions(userId);
    return detectProfile(perms);
  };

  const getActivePermCount = (userId: string) => {
    const perms = getPermissions(userId);
    return ALL_PERMISSION_KEYS.filter((k) => perms[k]).length;
  };

  const openEditor = (profile: Profile) => {
    setLocalPerms(getPermissions(profile.user_id));
    setEditingUser(profile);
  };

  const applyPreset = (presetId: string) => {
    if (presetId === "custom") return;
    const preset = PROFILE_PRESETS.find((p) => p.id === presetId);
    if (preset) setLocalPerms({ ...preset.permissions });
  };

  const toggleLocal = (key: PermissionKey) => {
    setLocalPerms((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const savePermissions = async () => {
    if (!editingUser) return;
    setSaving(true);
    try {
      const existing = allPermissions?.find((p: any) => p.user_id === editingUser.user_id);
      if (existing) {
        const { error } = await supabase
          .from("user_permissions")
          .update(localPerms)
          .eq("user_id", editingUser.user_id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_permissions")
          .insert({ user_id: editingUser.user_id, ...localPerms });
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: ["all-user-permissions"] });
      queryClient.invalidateQueries({ queryKey: ["user-permissions"] });
      toast.success("Permissões salvas com sucesso!");
      setEditingUser(null);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar permissões");
    } finally {
      setSaving(false);
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
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const currentProfileId = editingUser ? detectProfile(localPerms) : "custom";
  const currentPreset = PROFILE_PRESETS.find((p) => p.id === currentProfileId);

  return (
    <div className="space-y-6">
      {/* User Permissions List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Permissões de Usuários
          </CardTitle>
          <CardDescription>
            Gerencie as permissões de cada usuário. Administradores possuem todas as permissões automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {nonAdminProfiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum usuário não-admin encontrado.</p>
          ) : (
            <div className="space-y-2">
              {nonAdminProfiles.map((profile) => {
                const profileId = getActiveProfile(profile.user_id);
                const preset = PROFILE_PRESETS.find((p) => p.id === profileId);
                const permCount = getActivePermCount(profile.user_id);
                return (
                  <div
                    key={profile.user_id}
                    className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                        {profile.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{profile.name}</p>
                        {profile.job_title && (
                          <p className="text-xs text-muted-foreground truncate">{profile.job_title}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="hidden sm:flex items-center gap-2">
                        <Badge variant={profileId === "custom" ? "outline" : "secondary"} className="text-xs whitespace-nowrap">
                          {preset?.label ?? "Personalizado"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {permCount} permissão{permCount !== 1 ? "ões" : ""}
                        </span>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => openEditor(profile)} className="gap-1.5">
                        <Settings2 className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Editar</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
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
              Libere a visualização de todos os quadros de uma equipe para usuários que não são membros dela.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {nonAdminProfiles.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum usuário não-admin encontrado.</p>
            ) : (
              <div className="space-y-3">
                {nonAdminProfiles.map((profile) => (
                  <div key={profile.user_id} className="rounded-lg border border-border p-4">
                    <p className="font-medium text-sm mb-3">{profile.name}</p>
                    <div className="flex flex-wrap gap-3">
                      {teams.map((team) => {
                        const visible = hasTeamVisibility(profile.user_id, team.id);
                        return (
                          <div key={team.id} className="flex items-center gap-2">
                            <Switch
                              id={`vis-${profile.user_id}-${team.id}`}
                              checked={visible}
                              onCheckedChange={() => toggleTeamVisibility(profile.user_id, team.id, visible)}
                            />
                            <Label htmlFor={`vis-${profile.user_id}-${team.id}`} className="text-xs cursor-pointer">
                              {team.name}
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Permission Editor Sheet */}
      <Sheet open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5" />
              Permissões — {editingUser?.name}
            </SheetTitle>
            <SheetDescription>
              Selecione um perfil pré-definido ou configure permissões individualmente.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Profile selector */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Perfil de Permissão</Label>
              <Select value={currentProfileId} onValueChange={applyPreset}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROFILE_PRESETS.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>
                      <div className="flex items-center gap-2">
                        <span>{preset.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {currentPreset && (
                <p className="text-xs text-muted-foreground">{currentPreset.description}</p>
              )}
            </div>

            <Separator />

            {/* Module permissions */}
            {MODULES.map((mod) => {
              const Icon = mod.icon;
              const activeCount = mod.permissions.filter((p) => localPerms[p.key]).length;
              return (
                <div key={mod.id} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <h4 className="text-sm font-semibold">{mod.label}</h4>
                    <Badge variant="secondary" className="text-xs ml-auto">
                      {activeCount}/{mod.permissions.length}
                    </Badge>
                  </div>
                  <div className="space-y-2 pl-6">
                    {mod.permissions.map((perm) => (
                      <div
                        key={perm.key}
                        className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5 transition-colors hover:bg-muted/30"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{perm.label}</p>
                          <p className="text-xs text-muted-foreground">{perm.description}</p>
                        </div>
                        <Switch
                          checked={localPerms[perm.key]}
                          onCheckedChange={() => toggleLocal(perm.key)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            <Separator />

            <Button onClick={savePermissions} disabled={saving} className="w-full gap-2">
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {saving ? "Salvando..." : "Salvar Permissões"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
