import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { useBoards, useTeams } from "@/hooks/useBoards";
import { toast } from "sonner";

export function CreateBoardDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [teamId, setTeamId] = useState("");
  const { createBoard } = useBoards();
  const { data: teams } = useTeams();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !teamId) return;
    try {
      await createBoard.mutateAsync({ name: name.trim(), description: description.trim(), teamId });
      toast.success("Quadro criado com sucesso!");
      setName("");
      setDescription("");
      setTeamId("");
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar quadro");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" /> Novo Quadro</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar Novo Quadro</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">Equipe</label>
            <Select value={teamId} onValueChange={setTeamId}>
              <SelectTrigger><SelectValue placeholder="Selecione uma equipe" /></SelectTrigger>
              <SelectContent>
                {teams?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(!teams || teams.length === 0) && (
              <p className="text-xs text-muted-foreground mt-1">Crie uma equipe primeiro em "Equipes".</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Nome do Quadro</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Sprint 1" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Descrição (opcional)</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descreva o quadro..." rows={3} />
          </div>
          <Button type="submit" className="w-full" disabled={!name.trim() || !teamId || createBoard.isPending}>
            {createBoard.isPending ? "Criando..." : "Criar Quadro"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
