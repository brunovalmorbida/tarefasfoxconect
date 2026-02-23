import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTeams } from "@/hooks/useBoards";
import { useAuth } from "@/hooks/useAuth";
import { useLogActivity } from "@/hooks/useActivityLog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Loader2, Plus, Pencil } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";


interface Profile {
  id: string;
  user_id: string;
  name: string;
  job_title: string | null;
  whatsapp_number: string | null;
  created_at: string;
}

export function UsersTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const logActivity = useLogActivity();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Create user state
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newWhatsapp, setNewWhatsapp] = useState("");
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  // Edit user state
  const [editOpen, setEditOpen] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editJobTitle, setEditJobTitle] = useState("");
  const [editWhatsapp, setEditWhatsapp] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editTeams, setEditTeams] = useState<string[]>([]);
  const [editIsAdmin, setEditIsAdmin] = useState(false);
  const [saving, setSaving] = useState(false);


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
  const getRoleForUser = (userId: string) => {
    const role = adminRoles?.find((r) => r.user_id === userId);
    return role?.role === "admin" ? "Admin" : "Membro";
  };

  const getTeamsForUser = (userId: string) => {
    if (!teamMembers || !teams) return [];
    const userTeamIds = teamMembers.filter((tm) => tm.user_id === userId).map((tm) => tm.team_id);
    return teams.filter((t) => userTeamIds.includes(t.id));
  };

  const getTeamIdsForUser = (userId: string) => {
    if (!teamMembers) return [];
    return teamMembers.filter((tm) => tm.user_id === userId).map((tm) => tm.team_id);
  };

  const toggleTeam = (teamId: string) => {
    setSelectedTeams((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId]
    );
  };

  const toggleEditTeam = (teamId: string) => {
    setEditTeams((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId]
    );
  };

  const isMasterAdmin = user?.email === "brunovalmorbida@live.com";

  // Sync editEmail when userEmails loads after dialog is already open
  useEffect(() => {
    if (editOpen && editUserId && userEmails && !editEmail) {
      setEditEmail(userEmails[editUserId] || "");
    }
  }, [userEmails, editOpen, editUserId, editEmail]);

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
          teamIds: selectedTeams,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Usuário criado com sucesso!");
      await logActivity("Criou um usuário", { user_name: newName.trim(), email: newEmail.trim() });
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-team-members"] });
      setNewName("");
      setNewEmail("");
      setNewPassword("");
      setNewWhatsapp("");
      setSelectedTeams([]);
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

  const handleDelete = async (userId: string) => {
    setDeletingId(userId);
    try {
      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: { userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const deletedName = profiles?.find(p => p.user_id === userId)?.name ?? "Desconhecido";
      toast.success("Usuário removido com sucesso!");
      await logActivity("Removeu um usuário", { user_name: deletedName });
      queryClient.invalidateQueries({ queryKey: ["admin-team-members"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao remover usuário");
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Usuários</CardTitle>
            <CardDescription>Gerencie os usuários do sistema.</CardDescription>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Novo Usuário</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Criar Novo Usuário</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
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
                  <Label>WhatsApp</Label>
                  <Input value={newWhatsapp} onChange={(e) => setNewWhatsapp(e.target.value)} placeholder="Ex: 5511999999999" />
                </div>
                {teams && teams.length > 0 && (
                  <div className="space-y-2">
                    <Label>Equipes</Label>
                    <ScrollArea className="h-[120px] rounded-md border p-3">
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
                    <p className="text-xs text-muted-foreground">O usuário terá acesso aos quadros das equipes selecionadas.</p>
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={!newName.trim() || !newEmail.trim() || newPassword.length < 6 || creating}>
                  {creating ? "Criando..." : "Criar Usuário"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Equipes</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Cadastro</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles?.map((profile) => {
                const userTeams = getTeamsForUser(profile.user_id);
                const isAdmin = getRoleForUser(profile.user_id) === "Admin";
                return (
                  <TableRow key={profile.id}>
                    <TableCell className="font-medium">{profile.name}</TableCell>
                    <TableCell>{profile.job_title || "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {userTeams.length > 0 ? userTeams.map((t) => (
                          <Badge key={t.id} variant="outline" className="text-xs">{t.name}</Badge>
                        )) : <span className="text-muted-foreground text-xs">Nenhuma</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={isAdmin ? "default" : "secondary"}>
                        {isAdmin ? "Admin" : "Membro"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(profile.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary" onClick={() => openEditDialog(profile)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {!isAdmin && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remover usuário</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja remover {profile.name}? Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(profile.user_id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  {deletingId === profile.user_id ? "Removendo..." : "Remover"}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>


      {/* Edit User Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
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
              <Input value={editWhatsapp} onChange={(e) => setEditWhatsapp(e.target.value)} placeholder="Ex: 5511999999999" />
            </div>
            <div className="space-y-2">
              <Label>Nova Senha (opcional)</Label>
              <Input type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="Deixe vazio para manter" />
            </div>
            {teams && teams.length > 0 && (
              <div className="space-y-2">
                <Label>Equipes</Label>
                <ScrollArea className="h-[120px] rounded-md border p-3">
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
                  <p className="text-xs text-muted-foreground">Conceder privilégios de administrador ao usuário.</p>
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
    </>
  );
}