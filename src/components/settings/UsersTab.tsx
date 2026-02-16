import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTeams } from "@/hooks/useBoards";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Loader2, Plus } from "lucide-react";
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
  created_at: string;
}

export function UsersTab() {
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Create user state
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

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

  // Fetch team_members to show which teams each user belongs to
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

  const getRoleForUser = (userId: string) => {
    const role = adminRoles?.find((r) => r.user_id === userId);
    return role?.role === "admin" ? "Admin" : "Membro";
  };

  const getTeamsForUser = (userId: string) => {
    if (!teamMembers || !teams) return [];
    const userTeamIds = teamMembers.filter((tm) => tm.user_id === userId).map((tm) => tm.team_id);
    return teams.filter((t) => userTeamIds.includes(t.id));
  };

  const toggleTeam = (teamId: string) => {
    setSelectedTeams((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId]
    );
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
          teamIds: selectedTeams,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Usuário criado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-team-members"] });
      setNewName("");
      setNewEmail("");
      setNewPassword("");
      setSelectedTeams([]);
      setCreateOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar usuário");
    } finally {
      setCreating(false);
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
      toast.success("Usuário removido com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
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

              {teams && teams.length > 0 && (
                <div className="space-y-2">
                  <Label>Equipes</Label>
                  <ScrollArea className="h-[120px] rounded-md border p-3">
                    <div className="space-y-2">
                      {teams.map((team) => (
                        <div key={team.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`team-${team.id}`}
                            checked={selectedTeams.includes(team.id)}
                            onCheckedChange={() => toggleTeam(team.id)}
                          />
                          <label htmlFor={`team-${team.id}`} className="text-sm font-medium leading-none cursor-pointer">
                            {team.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  <p className="text-xs text-muted-foreground">
                    O usuário terá acesso aos quadros das equipes selecionadas.
                  </p>
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
              <TableHead className="w-[80px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles?.map((profile) => {
              const userTeams = getTeamsForUser(profile.user_id);
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
                    <Badge variant={getRoleForUser(profile.user_id) === "Admin" ? "default" : "secondary"}>
                      {getRoleForUser(profile.user_id)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(profile.created_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    {getRoleForUser(profile.user_id) !== "Admin" && (
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
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
