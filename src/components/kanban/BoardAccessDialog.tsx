import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsAppAdmin } from "@/hooks/useUserRole";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Users } from "lucide-react";
import { toast } from "sonner";

interface BoardAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
  boardName: string;
  teamId: string;
}

export function BoardAccessDialog({ open, onOpenChange, boardId, boardName, teamId }: BoardAccessDialogProps) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);

  // Fetch all profiles (admin can see all)
  const { data: allProfiles, isLoading: loadingProfiles } = useQuery({
    queryKey: ["admin-profiles-access"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, name, job_title")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch current team members for this board's team
  const { data: currentMembers, isLoading: loadingMembers } = useQuery({
    queryKey: ["team-members", teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("user_id, role")
        .eq("team_id", teamId);
      if (error) throw error;
      return data;
    },
    enabled: open && !!teamId,
  });

  // Fetch admin user IDs to exclude from toggle (admins always have access)
  const { data: adminRoles } = useQuery({
    queryKey: ["admin-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, role");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Initialize selected users when data loads
  if (currentMembers && !initialized) {
    setSelectedUserIds(currentMembers.map((m) => m.user_id));
    setInitialized(true);
  }

  // Reset on close
  const handleOpenChange = (val: boolean) => {
    if (!val) setInitialized(false);
    onOpenChange(val);
  };

  const isAppAdmin = (userId: string) => {
    return adminRoles?.some((r) => r.user_id === userId && r.role === "admin") ?? false;
  };

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-board-access", {
        body: { teamId, userIds: selectedUserIds },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Acessos atualizados!");
      queryClient.invalidateQueries({ queryKey: ["team-members", teamId] });
      queryClient.invalidateQueries({ queryKey: ["admin-team-members"] });
      handleOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar acessos");
    } finally {
      setSaving(false);
    }
  };

  const isLoading = loadingProfiles || loadingMembers;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Acesso — {boardName}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Selecione os usuários que terão acesso a este quadro e sua equipe.
            </p>
            <ScrollArea className="h-[280px] rounded-md border p-3">
              <div className="space-y-3">
                {allProfiles?.map((profile) => {
                  const admin = isAppAdmin(profile.user_id);
                  const checked = selectedUserIds.includes(profile.user_id);
                  return (
                    <div key={profile.user_id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`access-${profile.user_id}`}
                          checked={checked || admin}
                          disabled={admin}
                          onCheckedChange={() => toggleUser(profile.user_id)}
                        />
                        <label
                          htmlFor={`access-${profile.user_id}`}
                          className="text-sm font-medium leading-none cursor-pointer"
                        >
                          {profile.name}
                          {profile.job_title && (
                            <span className="text-muted-foreground font-normal ml-1">
                              — {profile.job_title}
                            </span>
                          )}
                        </label>
                      </div>
                      {admin && <Badge variant="default" className="text-xs">Admin</Badge>}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
            <Button onClick={handleSave} className="w-full" disabled={saving}>
              {saving ? "Salvando..." : "Salvar Acessos"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
