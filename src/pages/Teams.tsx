import { useState } from "react";
import { useTeams } from "@/hooks/useBoards";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export default function Teams() {
  const { user } = useAuth();
  const { data: teams, isLoading } = useTeams();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !user) return;
    setCreating(true);
    try {
      const { error } = await supabase.from("teams").insert({ name: name.trim(), description: description.trim() || null, created_by: user.id });
      if (error) throw error;
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Equipes</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Nova Equipe</Button>
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

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : !teams || teams.length === 0 ? (
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
                <CardTitle className="text-lg">{team.name}</CardTitle>
                {team.description && <CardDescription>{team.description}</CardDescription>}
              </CardHeader>
              <CardContent>
                <Badge variant="secondary">Admin</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
