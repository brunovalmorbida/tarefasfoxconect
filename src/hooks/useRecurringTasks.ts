import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { startOfDay, startOfWeek, startOfMonth, format } from "date-fns";

export type RecurringTask = {
  id: string;
  team_id: string;
  title: string;
  description: string | null;
  frequency: "daily" | "weekly" | "monthly";
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type RecurringTaskCompletion = {
  id: string;
  recurring_task_id: string;
  completed_by: string;
  period_start: string;
  completed_at: string;
};

function getCurrentPeriodStart(frequency: "daily" | "weekly" | "monthly"): string {
  const now = new Date();
  switch (frequency) {
    case "daily":
      return format(startOfDay(now), "yyyy-MM-dd");
    case "weekly":
      return format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
    case "monthly":
      return format(startOfMonth(now), "yyyy-MM-dd");
  }
}

export function useRecurringTasks(teamId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const tasksQuery = useQuery({
    queryKey: ["recurring-tasks", teamId],
    queryFn: async () => {
      let query = supabase
        .from("recurring_tasks" as any)
        .select("*")
        .order("frequency")
        .order("title");
      if (teamId) query = query.eq("team_id", teamId);
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as RecurringTask[];
    },
    enabled: !!user,
  });

  const completionsQuery = useQuery({
    queryKey: ["recurring-task-completions", teamId],
    queryFn: async () => {
      const taskIds = tasksQuery.data?.map((t) => t.id) ?? [];
      if (taskIds.length === 0) return [] as RecurringTaskCompletion[];
      const { data, error } = await supabase
        .from("recurring_task_completions" as any)
        .select("*")
        .in("recurring_task_id", taskIds);
      if (error) throw error;
      return data as unknown as RecurringTaskCompletion[];
    },
    enabled: !!user && !!tasksQuery.data,
  });

  const isTaskCompleted = (task: RecurringTask): boolean => {
    const periodStart = getCurrentPeriodStart(task.frequency);
    return (completionsQuery.data ?? []).some(
      (c) => c.recurring_task_id === task.id && c.period_start === periodStart
    );
  };

  const toggleCompletion = useMutation({
    mutationFn: async (task: RecurringTask) => {
      const periodStart = getCurrentPeriodStart(task.frequency);
      const existing = (completionsQuery.data ?? []).find(
        (c) => c.recurring_task_id === task.id && c.period_start === periodStart
      );
      if (existing) {
        const { error } = await supabase
          .from("recurring_task_completions" as any)
          .delete()
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("recurring_task_completions" as any)
          .insert({
            recurring_task_id: task.id,
            completed_by: user!.id,
            period_start: periodStart,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-task-completions"] });
    },
  });

  const createTask = useMutation({
    mutationFn: async ({
      title,
      description,
      frequency,
      teamId: tId,
    }: {
      title: string;
      description?: string;
      frequency: "daily" | "weekly" | "monthly";
      teamId: string;
    }) => {
      const { error } = await supabase.from("recurring_tasks" as any).insert({
        title,
        description: description || null,
        frequency,
        team_id: tId,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recurring-tasks"] }),
  });

  const deleteTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from("recurring_tasks" as any)
        .delete()
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recurring-tasks"] }),
  });

  const tasks = tasksQuery.data ?? [];

  return {
    dailyTasks: tasks.filter((t) => t.frequency === "daily"),
    weeklyTasks: tasks.filter((t) => t.frequency === "weekly"),
    monthlyTasks: tasks.filter((t) => t.frequency === "monthly"),
    isLoading: tasksQuery.isLoading,
    isTaskCompleted,
    toggleCompletion,
    createTask,
    deleteTask,
  };
}
