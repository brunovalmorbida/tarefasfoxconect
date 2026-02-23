import { useState } from "react";
import { useTeams } from "@/hooks/useBoards";
import { useAuth } from "@/hooks/useAuth";
import { useLogActivity } from "@/hooks/useActivityLog";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export function TeamsTab() {
  const { user } = useAuth();
  const { data: teams, isLoading } = useTeams();
  const queryClient = useQueryClient();
  const logActivity = useLogActivity();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState("");
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !user) return;
    setCreating(true);
    try {
      const { data, error } = await supabase.from("teams").insert({ name: name.trim(), description: description.trim() || null, created_by: user.id }).select().single();
      if (error) throw error;
      await logActivity("Criou uma equipe", { team_name: name.trim() }, data.id);
      toast.success("Equipe criada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      setName("");
      setDescription("");
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar equipe");
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (team: { id: string; name: string; description: string | null }) => {
    setEditId(team.id);
    setEditName(team.name);
    setEditDesc(team.description ?? "");
    setEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("teams").update({ name: editName.trim(), description: editDesc.trim() || null }).eq("id", editId);
      if (error) throw error;
      await logActivity("Atualizou uma equipe", { team_name: editName.trim() }, editId);
      toast.success("Equipe atualizada!");
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      setEditOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar equipe");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, teamName: string) => {
    try {
      const { error } = await supabase.from("teams").delete().eq("id", id);
      if (error) throw error;
      await logActivity("Excluiu uma equipe", { team_name: teamName });
      toast.success("Equipe excluída!");
      queryClient.invalidateQueries({ queryKey: ["teams"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao excluir equipe");
    }
  };

  if (isLoading) {
    return <p className="text-muted-foreground">Carregando...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Gerencie as equipes do sistema.</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Nova Equipe</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Criar Nova Equipe</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground">Nome</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Marketing" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Descrição (opcional)</label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descreva a equipe..." rows={3} />
              </div>
              <Button type="submit" className="w-full" disabled={!name.trim() || creating}>
                {creating ? "Criando..." : "Criar Equipe"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {!teams || teams.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
          <Users className="h-12 w-12 text-muted-foreground/40" />
          <p className="text-muted-foreground">Nenhuma equipe encontrada.</p>
          <p className="text-sm text-muted-foreground">Crie uma equipe para começar a organizar seus quadros.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <Card key={team.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{team.name}</CardTitle>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(team)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir equipe?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Todos os quadros e tarefas desta equipe serão excluídos. Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(team.id, team.name)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                {team.description && <CardDescription>{team.description}</CardDescription>}
              </CardHeader>
              <CardContent>
                <Badge variant="secondary">Admin</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Equipe</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Nome</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Descrição (opcional)</label>
              <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3} />
            </div>
            <Button onClick={handleUpdate} className="w-full" disabled={!editName.trim() || saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
