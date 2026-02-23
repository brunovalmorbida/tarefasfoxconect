import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface EditBoardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  board: { id: string; name: string; description: string | null; team_id: string };
}

export function EditBoardDialog({ open, onOpenChange, board }: EditBoardDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(board.name);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("boards").update({ name: name.trim() }).eq("id", board.id);
      if (error) throw error;
      toast.success("Quadro atualizado!");
      queryClient.invalidateQueries({ queryKey: ["boards"] });
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar quadro");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase.from("boards").delete().eq("id", board.id);
      if (error) throw error;
      toast.success("Quadro excluído!");
      queryClient.invalidateQueries({ queryKey: ["boards"] });
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao excluir quadro");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" />
            Editar Quadro
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">Nome do Quadro</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do quadro" />
          </div>

          <Button onClick={handleSave} className="w-full" disabled={saving || !name.trim()}>
            {saving ? "Salvando..." : "Salvar Alterações"}
          </Button>

          <Separator />

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full gap-2">
                <Trash2 className="h-4 w-4" />
                Excluir Quadro
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir quadro?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. Todas as colunas e tarefas deste quadro serão excluídas permanentemente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} disabled={deleting}>
                  {deleting ? "Excluindo..." : "Excluir"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </DialogContent>
    </Dialog>
  );
}
