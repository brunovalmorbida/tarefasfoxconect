import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  is_completed: boolean;
  position: number;
  created_by: string;
  created_at: string;
}

export function useSubtasks(taskId: string | null) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const queryKey = ["subtasks", taskId];

  const { data: subtasks = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!taskId) return [];
      const { data, error } = await supabase
        .from("subtasks")
        .select("*")
        .eq("task_id", taskId)
        .order("position", { ascending: true });
      if (error) throw error;
      return data as Subtask[];
    },
    enabled: !!taskId,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const addSubtask = useMutation({
    mutationFn: async (title: string) => {
      if (!taskId || !user) throw new Error("Missing task or user");
      const position = subtasks.length;
      const { error } = await supabase.from("subtasks").insert({
        task_id: taskId,
        title,
        position,
        created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const toggleSubtask = useMutation({
    mutationFn: async ({ id, is_completed }: { id: string; is_completed: boolean }) => {
      const { error } = await supabase
        .from("subtasks")
        .update({ is_completed })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const deleteSubtask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("subtasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const completedCount = subtasks.filter((s) => s.is_completed).length;
  const totalCount = subtasks.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return {
    subtasks,
    isLoading,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
    completedCount,
    totalCount,
    progressPct,
  };
}
