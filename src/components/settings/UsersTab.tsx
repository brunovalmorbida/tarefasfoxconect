import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTeams } from "@/hooks/useBoards";
import { useAuth } from "@/hooks/useAuth";
import { useLogActivity } from "@/hooks/useActivityLog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2, Plus, Search, Users, ShieldCheck, UserCheck, UserX,
  MoreHorizontal, Pencil, KeyRound, Shield, ScrollText, UserMinus,
  ArrowUpDown, CheckCircle2, Clock, ListTodo, Eye, Activity,
  ChevronDown, Filter, User,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Profile {
  id: string;
  user_id: string;
  name: string;
  job_title: string | null;
  whatsapp_number: string | null;
  created_at: string;
  is_active: boolean;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function getActivityInfo(lastAccess: string | undefined): { color: string; label: string; status: "active" | "recent" | "inactive" | "never" } {
  if (!lastAccess) return { color: "bg-muted-foreground/40", label: "Nunca acessou", status: "never" };
  const diff = Date.now() - new Date(lastAccess).getTime();
  const days = diff / (1000 * 60 * 60 * 24);
  const hours = diff / (1000 * 60 * 60);
  const minutes = diff / (1000 * 60);

  if (days < 1) {
    const date = new Date(lastAccess);
    const time = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    return { color: "bg-green-500", label: `Hoje às ${time}`, status: "active" };
  }
  if (days < 2) return { color: "bg-yellow-500", label: "Ativo há 1 dia", status: "recent" };
  if (days <= 7) return { color: "bg-yellow-500", label: `Ativo há ${Math.floor(days)} dias`, status: "recent" };
  return { color: "bg-red-500", label: `Inativo há ${Math.floor(days)} dias`, status: "inactive" };
}

type SortOption = "name" | "most-active" | "least-active" | "most-tasks" | "least-tasks" | "team";
type ActivityFilter = "all" | "active" | "recent" | "inactive";

export function UsersTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const logActivity = useLogActivity();

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("name");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [detailProfile, setDetailProfile] = useState<Profile | null>(null);
  const [deactivateDialog, setDeactivateDialog] = useState<Profile | null>(null);
  const [resetPasswordDialog, setResetPasswordDialog] = useState<Profile | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);

  // Create user state
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newJobTitle, setNewJobTitle] = useState("");
  const [newWhatsapp, setNewWhatsapp] = useState("");
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  // Edit user state
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editJobTitle, setEditJobTitle] = useState("");
  const [editWhatsapp, setEditWhatsapp] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editTeams, setEditTeams] = useState<string[]>([]);
  const [editIsAdmin, setEditIsAdmin] = useState(false);
  const [saving, setSaving] = useState(false);

  // Queries
  const { data: profiles, isLoading } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: true });
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

  const { data: teams } = useTeams();

  const { data: teamMembers } = useQuery({
    queryKey: ["admin-team-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("user_id, team_id");
      if (error) throw error;
      return data;
    },
  });

  const { data: userEmails } = useQuery({
    queryKey: ["admin-user-emails"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-user-emails");
      if (error) throw error;
      return data as Record<string, string>;
    },
  });

  const { data: lastActivity } = useQuery({
    queryKey: ["admin-last-activity"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_log")
        .select("user_id, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const row of data ?? []) {
        if (!map[row.user_id]) map[row.user_id] = row.created_at;
      }
      return map;
    },
  });

  const { data: openTaskCounts } = useQuery({
    queryKey: ["admin-open-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("assignee_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        if (row.assignee_id) {
          counts[row.assignee_id] = (counts[row.assignee_id] || 0) + 1;
        }
      }
      return counts;
    },
  });

  // Query for completed tasks (tasks in last column of each board)
  const { data: completedTaskCounts } = useQuery({
    queryKey: ["admin-completed-tasks"],
    queryFn: async () => {
      // Get all board columns to find "done" columns (last position per board)
      const { data: columns, error: colError } = await supabase
        .from("board_columns")
        .select("id, board_id, position")
        .order("position", { ascending: false });
      if (colError) throw colError;

      // Get last column per board
      const lastCols = new Map<string, string>();
      for (const col of columns ?? []) {
        if (!lastCols.has(col.board_id)) lastCols.set(col.board_id, col.id);
      }
      const doneColumnIds = Array.from(lastCols.values());

      if (doneColumnIds.length === 0) return {} as Record<string, number>;

      const { data: tasks, error } = await supabase
        .from("tasks")
        .select("assignee_id")
        .in("column_id", doneColumnIds);
      if (error) throw error;

      const counts: Record<string, number> = {};
      for (const row of tasks ?? []) {
        if (row.assignee_id) {
          counts[row.assignee_id] = (counts[row.assignee_id] || 0) + 1;
        }
      }
      return counts;
    },
  });

  // Activity log for user detail
  const { data: detailActivityLog } = useQuery({
    queryKey: ["user-detail-activity", detailProfile?.user_id],
    queryFn: async () => {
      if (!detailProfile) return [];
      const { data, error } = await supabase
        .from("activity_log")
        .select("action, created_at")
        .eq("user_id", detailProfile.user_id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!detailProfile,
  });

  // Helpers
  const getRoleForUser = (userId: string) =>
    adminRoles?.find((r) => r.user_id === userId)?.role === "admin" ? "Admin" : "Membro";

  const getTeamsForUser = (userId: string) => {
    if (!teamMembers || !teams) return [];
    const ids = teamMembers.filter((tm) => tm.user_id === userId).map((tm) => tm.team_id);
    return teams.filter((t) => ids.includes(t.id));
  };

  const getTeamIdsForUser = (userId: string) =>
    teamMembers?.filter((tm) => tm.user_id === userId).map((tm) => tm.team_id) ?? [];

  const isMasterAdmin = user?.email === "brunovalmorbida@live.com";

  // Metrics
  const metrics = useMemo(() => {
    if (!profiles) return { total: 0, admins: 0, members: 0, activeToday: 0 };
    const activeProfiles = profiles.filter((p) => p.is_active !== false);
    const admins = activeProfiles.filter((p) => getRoleForUser(p.user_id) === "Admin").length;
    const activeToday = activeProfiles.filter((p) => {
      const la = lastActivity?.[p.user_id];
      if (!la) return false;
      return Date.now() - new Date(la).getTime() < 86400000;
    }).length;
    return {
      total: activeProfiles.length,
      admins,
      members: activeProfiles.length - admins,
      activeToday,
    };
  }, [profiles, adminRoles, lastActivity]);

  // Filtered profiles
  const filteredProfiles = useMemo(() => {
    if (!profiles) return [];
    let result = [...profiles];
    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((p) => {
        const role = getRoleForUser(p.user_id).toLowerCase();
        const userTeams = getTeamsForUser(p.user_id).map((t) => t.name.toLowerCase()).join(" ");
        return (
          p.name.toLowerCase().includes(q) ||
          (p.job_title?.toLowerCase().includes(q) ?? false) ||
          role.includes(q) ||
          userTeams.includes(q)
        );
      });
    }
    // Team filter
    if (teamFilter !== "all") {
      result = result.filter((p) => getTeamIdsForUser(p.user_id).includes(teamFilter));
    }
    // Activity filter
    if (activityFilter !== "all") {
      result = result.filter((p) => {
        const info = getActivityInfo(lastActivity?.[p.user_id]);
        return info.status === activityFilter;
      });
    }
    // Sort
    result.sort((a, b) => {
      // Always: active first
      if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
      switch (sortBy) {
        case "most-active": {
          const aTime = lastActivity?.[a.user_id] ? new Date(lastActivity[a.user_id]).getTime() : 0;
          const bTime = lastActivity?.[b.user_id] ? new Date(lastActivity[b.user_id]).getTime() : 0;
          return bTime - aTime;
        }
        case "least-active": {
          const aTime = lastActivity?.[a.user_id] ? new Date(lastActivity[a.user_id]).getTime() : 0;
          const bTime = lastActivity?.[b.user_id] ? new Date(lastActivity[b.user_id]).getTime() : 0;
          return aTime - bTime;
        }
        case "most-tasks":
          return (openTaskCounts?.[b.user_id] ?? 0) - (openTaskCounts?.[a.user_id] ?? 0);
        case "least-tasks":
          return (openTaskCounts?.[a.user_id] ?? 0) - (openTaskCounts?.[b.user_id] ?? 0);
        case "team": {
          const aTeam = getTeamsForUser(a.user_id)[0]?.name ?? "zzz";
          const bTeam = getTeamsForUser(b.user_id)[0]?.name ?? "zzz";
          return aTeam.localeCompare(bTeam);
        }
        default:
          return a.name.localeCompare(b.name);
      }
    });
    return result;
  }, [profiles, searchQuery, teamFilter, activityFilter, sortBy, teamMembers, teams, adminRoles, lastActivity, openTaskCounts]);

  // Sync editEmail
  useEffect(() => {
    if (editOpen && editUserId && userEmails && !editEmail) {
      setEditEmail(userEmails[editUserId] || "");
    }
  }, [userEmails, editOpen, editUserId, editEmail]);

  // Handlers
  const openEditDialog = (profile: Profile) => {
    setEditUserId(profile.user_id);
    setEditName(profile.name);
    setEditEmail(userEmails?.[profile.user_id] || "");
    setEditJobTitle(profile.job_title || "");
    setEditWhatsapp(profile.whatsapp_number || "");
    setEditPassword("");
    setEditTeams(getTeamIdsForUser(profile.user_id));
    setEditIsAdmin(getRoleForUser(profile.user_id) === "Admin");
    setEditOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim() || !newPassword) return;
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: {
          name: newName.trim(),
          email: newEmail.trim(),
          password: newPassword,
          whatsappNumber: newWhatsapp.trim() || undefined,
          jobTitle: newJobTitle.trim() || undefined,
          teamIds: selectedTeams,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Usuário criado com sucesso!");
      await logActivity("Criou um usuário", { user_name: newName.trim(), email: newEmail.trim() });
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-team-members"] });
      setNewName(""); setNewEmail(""); setNewPassword(""); setNewWhatsapp(""); setNewJobTitle(""); setSelectedTeams([]);
      setCreateOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar usuário");
    } finally {
      setCreating(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUserId || !editName.trim()) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-user", {
        body: {
          userId: editUserId,
          name: editName.trim(),
          email: editEmail.trim() || undefined,
          jobTitle: editJobTitle.trim(),
          whatsappNumber: editWhatsapp.trim() || null,
          password: editPassword || undefined,
          teamIds: editTeams,
          isAdmin: isMasterAdmin ? editIsAdmin : undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Usuário atualizado com sucesso!");
      await logActivity("Atualizou um usuário", { user_name: editName.trim() });
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-team-members"] });
      queryClient.invalidateQueries({ queryKey: ["admin-roles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user-emails"] });
      setEditOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar usuário");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (profile: Profile) => {
    const newStatus = !profile.is_active;
    try {
      const { data, error } = await supabase.functions.invoke("update-user", {
        body: { userId: profile.user_id, isActive: newStatus },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(newStatus ? "Usuário reativado!" : "Usuário desativado!");
      await logActivity(newStatus ? "Reativou um usuário" : "Desativou um usuário", { user_name: profile.name });
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao alterar status");
    }
    setDeactivateDialog(null);
  };

  const handleResetPassword = async () => {
    if (!resetPasswordDialog || resetPassword.length < 6) return;
    setResettingPassword(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-user", {
        body: { userId: resetPasswordDialog.user_id, password: resetPassword },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Senha resetada com sucesso!");
      await logActivity("Resetou a senha de um usuário", { user_name: resetPasswordDialog.name });
      setResetPasswordDialog(null);
      setResetPassword("");
    } catch (err: any) {
      toast.error(err.message || "Erro ao resetar senha");
    } finally {
      setResettingPassword(false);
    }
  };

  const toggleTeam = (teamId: string) =>
    setSelectedTeams((prev) => prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId]);

  const toggleEditTeam = (teamId: string) =>
    setEditTeams((prev) => prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Metrics bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total de Usuários", value: metrics.total, icon: Users, color: "text-primary", bg: "bg-primary/10" },
          { label: "Administradores", value: metrics.admins, icon: ShieldCheck, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" },
          { label: "Membros", value: metrics.members, icon: UserCheck, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10" },
          { label: "Ativos Hoje", value: metrics.activeToday, icon: Activity, color: "text-green-600 dark:text-green-400", bg: "bg-green-500/10" },
        ].map((m) => (
          <Card key={m.label} className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${m.bg} ${m.color}`}>
                  <m.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold tracking-tight">{m.value}</p>
                  <p className="text-[11px] text-muted-foreground font-medium">{m.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search, Filters & Sort */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nome, cargo, equipe ou papel..."
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-[160px]">
                <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Nome</SelectItem>
                <SelectItem value="most-active">Mais ativos</SelectItem>
                <SelectItem value="least-active">Menos ativos</SelectItem>
                <SelectItem value="most-tasks">Mais tarefas</SelectItem>
                <SelectItem value="least-tasks">Menos tarefas</SelectItem>
                <SelectItem value="team">Equipe</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setCreateOpen(true)} className="gap-1.5 shrink-0">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Novo Usuário</span>
            </Button>
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 flex-wrap items-center">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium mr-1">
            <Filter className="h-3.5 w-3.5" />
            Filtros:
          </div>
          {/* Team filters */}
          <Button
            variant={teamFilter === "all" ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs rounded-full px-3"
            onClick={() => setTeamFilter("all")}
          >
            Todas equipes
          </Button>
          {teams?.map((team) => (
            <Button
              key={team.id}
              variant={teamFilter === team.id ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs rounded-full px-3"
              onClick={() => setTeamFilter(team.id)}
            >
              {team.name}
            </Button>
          ))}
          <Separator orientation="vertical" className="h-5 mx-1" />
          {/* Activity filters */}
          {[
            { value: "all" as ActivityFilter, label: "Todos" },
            { value: "active" as ActivityFilter, label: "Ativos hoje" },
            { value: "recent" as ActivityFilter, label: "Recentes" },
            { value: "inactive" as ActivityFilter, label: "Inativos" },
          ].map((f) => (
            <Button
              key={f.value}
              variant={activityFilter === f.value ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs rounded-full px-3"
              onClick={() => setActivityFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {/* User list */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filteredProfiles.length === 0 ? (
          <Card className="sm:col-span-2 lg:col-span-3 p-8">
            <p className="text-center text-sm text-muted-foreground">Nenhum usuário encontrado.</p>
          </Card>
        ) : (
          filteredProfiles.map((profile) => {
            const isAdmin = getRoleForUser(profile.user_id) === "Admin";
            const userTeams = getTeamsForUser(profile.user_id);
            const activity = getActivityInfo(lastActivity?.[profile.user_id]);
            const openTasks = openTaskCounts?.[profile.user_id] ?? 0;
            const completedTasks = completedTaskCounts?.[profile.user_id] ?? 0;
            const inactive = profile.is_active === false;

            return (
              <Card
                key={profile.id}
                className={`group relative border-border/50 transition-all hover:shadow-md hover:border-border cursor-pointer ${inactive ? "opacity-50" : ""}`}
                onClick={() => setDetailProfile(profile)}
              >
                <CardContent className="p-5">
                  {/* Top row: avatar + info + actions */}
                  <div className="flex items-start gap-3.5">
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      <Avatar className={`h-12 w-12 ${isAdmin ? "ring-2 ring-primary/30" : ""}`}>
                        <AvatarFallback className={`text-sm font-semibold ${
                          isAdmin ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                        }`}>
                          {getInitials(profile.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card ${activity.color}`}
                        title={activity.label}
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{profile.name}</span>
                        <Badge
                          variant={isAdmin ? "default" : "secondary"}
                          className={`text-[10px] px-1.5 py-0 shrink-0 ${
                            isAdmin ? "bg-blue-600 hover:bg-blue-700 text-white" : ""
                          }`}
                        >
                          {isAdmin ? "Admin" : "Membro"}
                        </Badge>
                      </div>
                      {profile.job_title && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{profile.job_title}</p>
                      )}
                      {inactive && (
                        <Badge variant="outline" className="text-[10px] mt-1 text-destructive border-destructive/30">
                          Inativo
                        </Badge>
                      )}
                    </div>

                    {/* Quick actions */}
                    <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar" onClick={() => openEditDialog(profile)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Permissões" onClick={() => {
                        const permTab = document.querySelector('[value="permissions"]') as HTMLElement;
                        permTab?.click();
                      }}>
                        <Shield className="h-3.5 w-3.5" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => setDetailProfile(profile)}>
                            <Eye className="mr-2 h-4 w-4" />
                            Ver perfil
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditDialog(profile)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar usuário
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setResetPasswordDialog(profile); setResetPassword(""); }}>
                            <KeyRound className="mr-2 h-4 w-4" />
                            Resetar senha
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            const permTab = document.querySelector('[value="permissions"]') as HTMLElement;
                            permTab?.click();
                          }}>
                            <Shield className="mr-2 h-4 w-4" />
                            Alterar permissões
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            const logTab = document.querySelector('[value="log"]') as HTMLElement;
                            logTab?.click();
                          }}>
                            <ScrollText className="mr-2 h-4 w-4" />
                            Ver histórico
                          </DropdownMenuItem>
                          {!isAdmin && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setDeactivateDialog(profile)}
                                className={inactive ? "text-green-600" : "text-destructive"}
                              >
                                <UserMinus className="mr-2 h-4 w-4" />
                                {inactive ? "Reativar usuário" : "Desativar usuário"}
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Teams */}
                  {userTeams.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap mt-3">
                      {userTeams.map((t) => (
                        <Badge key={t.id} variant="outline" className="text-[10px] px-2 py-0.5 bg-muted/50">
                          {t.name}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Divider */}
                  <Separator className="my-3" />

                  {/* Bottom stats */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <ListTodo className="h-3.5 w-3.5" />
                        <span className="font-medium text-foreground">{openTasks}</span>
                        <span>abertas</span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span className="font-medium text-foreground">{completedTasks}</span>
                        <span>concluídas</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span className="text-[11px]">{activity.label}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* User Detail Modal */}
      <Dialog open={!!detailProfile} onOpenChange={(open) => !open && setDetailProfile(null)}>
        <DialogContent className="sm:max-w-lg" onInteractOutside={(e) => e.preventDefault()}>
          {detailProfile && (() => {
            const isAdmin = getRoleForUser(detailProfile.user_id) === "Admin";
            const userTeams = getTeamsForUser(detailProfile.user_id);
            const activity = getActivityInfo(lastActivity?.[detailProfile.user_id]);
            const openTasks = openTaskCounts?.[detailProfile.user_id] ?? 0;
            const completedTasks = completedTaskCounts?.[detailProfile.user_id] ?? 0;
            const email = userEmails?.[detailProfile.user_id];

            return (
              <>
                <DialogHeader>
                  <DialogTitle className="sr-only">Perfil do Usuário</DialogTitle>
                </DialogHeader>
                <div className="space-y-5">
                  {/* Header */}
                  <div className="flex items-center gap-4">
                    <Avatar className={`h-16 w-16 ${isAdmin ? "ring-2 ring-primary/30" : ""}`}>
                      <AvatarFallback className={`text-lg font-bold ${
                        isAdmin ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                      }`}>
                        {getInitials(detailProfile.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-lg truncate">{detailProfile.name}</h3>
                        <Badge variant={isAdmin ? "default" : "secondary"} className={`text-xs shrink-0 ${isAdmin ? "bg-blue-600 text-white" : ""}`}>
                          {isAdmin ? "Admin" : "Membro"}
                        </Badge>
                      </div>
                      {detailProfile.job_title && (
                        <p className="text-sm text-muted-foreground">{detailProfile.job_title}</p>
                      )}
                      {email && <p className="text-xs text-muted-foreground mt-0.5">{email}</p>}
                    </div>
                  </div>

                  {/* Status */}
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${activity.color}`} />
                    <span className="text-sm text-muted-foreground">{activity.label}</span>
                    {detailProfile.is_active === false && (
                      <Badge variant="outline" className="text-xs text-destructive border-destructive/30 ml-auto">Conta Inativa</Badge>
                    )}
                  </div>

                  {/* Teams */}
                  {userTeams.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Equipes</p>
                      <div className="flex flex-wrap gap-1.5">
                        {userTeams.map((t) => (
                          <Badge key={t.id} variant="outline" className="text-xs">{t.name}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Task stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <Card className="border-border/50">
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400">
                          <ListTodo className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-xl font-bold">{openTasks}</p>
                          <p className="text-[11px] text-muted-foreground">Tarefas Abertas</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="border-border/50">
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500/10 text-green-600 dark:text-green-400">
                          <CheckCircle2 className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-xl font-bold">{completedTasks}</p>
                          <p className="text-[11px] text-muted-foreground">Concluídas</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Recent activity */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Atividade Recente</p>
                    {detailActivityLog && detailActivityLog.length > 0 ? (
                      <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                        {detailActivityLog.map((log, i) => (
                          <div key={i} className="flex items-center justify-between gap-3 text-sm px-3 py-2 rounded-md bg-muted/30">
                            <span className="truncate">{log.action}</span>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {new Date(log.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                              {" "}
                              {new Date(log.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground py-3 text-center">Nenhuma atividade registrada.</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => { setDetailProfile(null); openEditDialog(detailProfile); }}>
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => {
                      setDetailProfile(null);
                      const permTab = document.querySelector('[value="permissions"]') as HTMLElement;
                      permTab?.click();
                    }}>
                      <Shield className="h-3.5 w-3.5" />
                      Permissões
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => { setDetailProfile(null); setResetPasswordDialog(detailProfile); setResetPassword(""); }}>
                      <KeyRound className="h-3.5 w-3.5" />
                      Senha
                    </Button>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Criar Novo Usuário</DialogTitle>
            <DialogDescription>Preencha os dados do novo membro da equipe.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2 col-span-2">
                <Label>Nome</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome completo" />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="email@exemplo.com" />
              </div>
              <div className="space-y-2">
                <Label>Senha</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
              </div>
              <div className="space-y-2">
                <Label>Cargo</Label>
                <Input value={newJobTitle} onChange={(e) => setNewJobTitle(e.target.value)} placeholder="Ex: Analista" />
              </div>
              <div className="space-y-2">
                <Label>WhatsApp</Label>
                <Input value={newWhatsapp} onChange={(e) => setNewWhatsapp(e.target.value)} placeholder="5511999999999" />
              </div>
            </div>
            {teams && teams.length > 0 && (
              <div className="space-y-2">
                <Label>Equipes</Label>
                <ScrollArea className="h-[100px] rounded-md border p-3">
                  <div className="space-y-2">
                    {teams.map((team) => (
                      <div key={team.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`create-team-${team.id}`}
                          checked={selectedTeams.includes(team.id)}
                          onCheckedChange={() => toggleTeam(team.id)}
                        />
                        <label htmlFor={`create-team-${team.id}`} className="text-sm font-medium leading-none cursor-pointer">
                          {team.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={!newName.trim() || !newEmail.trim() || newPassword.length < 6 || creating}>
              {creating ? "Criando..." : "Criar Usuário"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2 col-span-2">
                <Label>Nome</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nome completo" />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="email@exemplo.com" />
              </div>
              <div className="space-y-2">
                <Label>Cargo</Label>
                <Input value={editJobTitle} onChange={(e) => setEditJobTitle(e.target.value)} placeholder="Ex: Desenvolvedor" />
              </div>
              <div className="space-y-2">
                <Label>WhatsApp</Label>
                <Input value={editWhatsapp} onChange={(e) => setEditWhatsapp(e.target.value)} placeholder="5511999999999" />
              </div>
              <div className="space-y-2">
                <Label>Nova Senha (opcional)</Label>
                <Input type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="Deixe vazio para manter" />
              </div>
            </div>
            {teams && teams.length > 0 && (
              <div className="space-y-2">
                <Label>Equipes</Label>
                <ScrollArea className="h-[100px] rounded-md border p-3">
                  <div className="space-y-2">
                    {teams.map((team) => (
                      <div key={team.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`edit-team-${team.id}`}
                          checked={editTeams.includes(team.id)}
                          onCheckedChange={() => toggleEditTeam(team.id)}
                        />
                        <label htmlFor={`edit-team-${team.id}`} className="text-sm font-medium leading-none cursor-pointer">
                          {team.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
            {isMasterAdmin && editUserId !== user?.id && (
              <div className="flex items-center justify-between rounded-md border p-3">
                <div className="space-y-0.5">
                  <Label>Administrador</Label>
                  <p className="text-xs text-muted-foreground">Conceder privilégios de administrador.</p>
                </div>
                <Switch checked={editIsAdmin} onCheckedChange={setEditIsAdmin} />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={!editName.trim() || saving}>
              {saving ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Deactivate/Reactivate Dialog */}
      <AlertDialog open={!!deactivateDialog} onOpenChange={(open) => !open && setDeactivateDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deactivateDialog?.is_active === false ? "Reativar" : "Desativar"} usuário
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deactivateDialog?.is_active === false
                ? `Deseja reativar ${deactivateDialog?.name}? O usuário poderá acessar o sistema novamente.`
                : `Deseja desativar ${deactivateDialog?.name}? O usuário não será excluído, mas perderá o acesso ao sistema.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deactivateDialog && handleToggleActive(deactivateDialog)}
              className={deactivateDialog?.is_active === false ? "" : "bg-destructive text-destructive-foreground hover:bg-destructive/90"}
            >
              {deactivateDialog?.is_active === false ? "Reativar" : "Desativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetPasswordDialog} onOpenChange={(open) => !open && setResetPasswordDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Resetar Senha — {resetPasswordDialog?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nova Senha</Label>
              <Input
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <Button onClick={handleResetPassword} className="w-full" disabled={resetPassword.length < 6 || resettingPassword}>
              {resettingPassword ? "Resetando..." : "Resetar Senha"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
