import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface UserPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
}

const PERMISSIONS = [
  { key: "can_manage_boards", label: "Gerenciar Quadros", description: "Criar, editar e excluir quadros Kanban" },
  { key: "can_manage_columns", label: "Gerenciar Colunas", description: "Criar, editar e excluir colunas nos quadros" },
  { key: "can_manage_tasks", label: "Gerenciar Tarefas", description: "Criar, editar e excluir tarefas nos quadros" },
  { key: "can_manage_recurring_tasks", label: "Gerenciar Tarefas Fixas", description: "Criar, editar e excluir tarefas diárias, semanais e mensais" },
] as const;

type PermissionKey = typeof PERMISSIONS[number]["key"];

export function UserPermissionsDialog({ open, onOpenChange, userId, userName }: UserPermissionsDialogProps) {
  const queryClient = useQueryClient();
  const [permissions, setPermissions] = useState<Record<PermissionKey, boolean>>({
    can_manage_boards: false,
    can_manage_columns: false,
    can_manage_tasks: false,
    can_manage_recurring_tasks: false,
  });
  const [saving, setSaving] = useState(false);

  const { data: existing, isLoading } = useQuery({
    queryKey: ["user-permissions", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_permissions")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open && !!userId,
  });

  useEffect(() => {
    if (existing) {
      setPermissions({
        can_manage_boards: existing.can_manage_boards,
        can_manage_columns: existing.can_manage_columns,
        can_manage_tasks: existing.can_manage_tasks,
        can_manage_recurring_tasks: existing.can_manage_recurring_tasks,
      });
    } else {
      setPermissions({
        can_manage_boards: false,
        can_manage_columns: false,
        can_manage_tasks: false,
        can_manage_recurring_tasks: false,
      });
    }
  }, [existing]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (existing) {
        const { error } = await supabase
          .from("user_permissions")
          .update(permissions)
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_permissions")
          .insert({ user_id: userId, ...permissions });
        if (error) throw error;
      }
      toast.success("Permissões salvas com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["user-permissions", userId] });
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar permissões");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Permissões — {userName}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5">
            {PERMISSIONS.map((perm) => (
              <div key={perm.key} className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">{perm.label}</Label>
                  <p className="text-xs text-muted-foreground">{perm.description}</p>
                </div>
                <Switch
                  checked={permissions[perm.key]}
                  onCheckedChange={(checked) =>
                    setPermissions((prev) => ({ ...prev, [perm.key]: checked }))
                  }
                />
              </div>
            ))}
            <Button onClick={handleSave} className="w-full" disabled={saving}>
              {saving ? "Salvando..." : "Salvar Permissões"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
