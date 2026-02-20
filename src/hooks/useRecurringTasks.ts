import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useLogActivity } from "./useActivityLog";
import { startOfDay, startOfWeek, startOfMonth, format, getDay } from "date-fns";

export type RecurringTaskBoard = {
  id: string;
  team_id: string;
  name: string;
  frequency_type: "weekday" | "weekly" | "monthly";
  weekday: number | null;
  assigned_user_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type RecurringTask = {
  id: string;
  team_id: string;
  board_id: string | null;
  title: string;
  description: string | null;
  frequency: "daily" | "weekly" | "weekday" | "monthly";
  weekday: number | null;
  month_day: number | null;
  scheduled_time: string | null;
  position: number;
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

const WEEKDAY_NAMES = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

export function getWeekdayName(weekday: number): string {
  return WEEKDAY_NAMES[weekday] ?? "";
}

export function getTaskFrequencyLabel(task: RecurringTask): string {
  switch (task.frequency) {
    case "daily":
      return "Diária";
    case "weekly":
      return "Semanal";
    case "weekday":
      return getWeekdayName(task.weekday ?? 0);
    case "monthly":
      return `Dia ${task.month_day ?? 1} do mês`;
  }
}

function getTaskPeriodStart(task: RecurringTask): string {
  const now = new Date();
  switch (task.frequency) {
    case "daily":
    case "weekday":
      return format(startOfDay(now), "yyyy-MM-dd");
    case "weekly":
      return format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
    case "monthly":
      return format(startOfMonth(now), "yyyy-MM-dd");
  }
}

// Sunday (JS getDay()===0) is not a business day (Mon-Sat only)
function isSunday(): boolean {
  return new Date().getDay() === 0;
}

export function isTaskActiveToday(task: RecurringTask): boolean {
  // Sundays are never active for any recurring task
  if (isSunday()) return false;

  if (task.frequency === "weekday" && task.weekday !== null) {
    const jsDay = getDay(new Date());
    const ourDay = jsDay === 0 ? 6 : jsDay - 1;
    return ourDay === task.weekday;
  }
  if (task.frequency === "monthly" && task.month_day !== null) {
    return new Date().getDate() === task.month_day;
  }
  return true; // daily and weekly are always "active" (except Sunday, handled above)
}

function isActiveToday(board: RecurringTaskBoard): boolean {
  return !isSunday();
}

export function useRecurringTaskBoards(teamId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const logActivity = useLogActivity();

  const boardsQuery = useQuery({
    queryKey: ["recurring-task-boards", teamId],
    queryFn: async () => {
      let query = supabase
        .from("recurring_task_boards" as any)
        .select("*")
        .order("name");
      if (teamId) query = query.eq("team_id", teamId);
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as RecurringTaskBoard[];
    },
    enabled: !!user,
  });

  const createBoard = useMutation({
    mutationFn: async (params: {
      name: string;
      frequencyType: "weekday" | "weekly" | "monthly";
      weekday?: number;
      teamId: string;
      assignedUserId?: string | null;
    }) => {
      const { error } = await supabase.from("recurring_task_boards" as any).insert({
        name: params.name,
        frequency_type: params.frequencyType,
        weekday: params.frequencyType === "weekday" ? (params.weekday ?? 0) : null,
        team_id: params.teamId,
        assigned_user_id: params.assignedUserId || null,
        created_by: user!.id,
      });
      if (error) throw error;
      await logActivity("Criou um quadro de tarefas fixas", { board_name: params.name }, params.teamId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recurring-task-boards"] }),
  });

  const updateBoard = useMutation({
    mutationFn: async (params: {
      id: string;
      name: string;
      frequencyType: "weekday" | "weekly" | "monthly";
      weekday?: number;
      assignedUserId?: string | null;
      teamId?: string;
    }) => {
      const updateData: any = {
        name: params.name,
        frequency_type: params.frequencyType,
        weekday: params.frequencyType === "weekday" ? (params.weekday ?? 0) : null,
        assigned_user_id: params.assignedUserId || null,
      };
      if (params.teamId) updateData.team_id = params.teamId;
      const { error } = await supabase
        .from("recurring_task_boards" as any)
        .update(updateData)
        .eq("id", params.id);
      if (error) throw error;
      await logActivity("Atualizou um quadro de tarefas fixas", { board_name: params.name }, params.teamId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recurring-task-boards"] }),
  });

  const deleteBoard = useMutation({
    mutationFn: async (id: string) => {
      const board = boardsQuery.data?.find(b => b.id === id);
      const { error } = await supabase.from("recurring_task_boards" as any).delete().eq("id", id);
      if (error) throw error;
      await logActivity("Excluiu um quadro de tarefas fixas", { board_name: board?.name }, board?.team_id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-task-boards"] });
      queryClient.invalidateQueries({ queryKey: ["recurring-tasks"] });
    },
  });

  return {
    boards: boardsQuery.data ?? [],
    isLoading: boardsQuery.isLoading,
    createBoard,
    updateBoard,
    deleteBoard,
    isActiveToday,
  };
}

export function useRecurringTasks(boardId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const logActivity = useLogActivity();

  const tasksQuery = useQuery({
    queryKey: ["recurring-tasks", boardId],
    queryFn: async () => {
      let query = supabase
        .from("recurring_tasks" as any)
        .select("*")
        .order("position")
        .order("title");
      if (boardId) query = query.eq("board_id", boardId);
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as RecurringTask[];
    },
    enabled: !!user && !!boardId,
  });

  const completionsQuery = useQuery({
    queryKey: ["recurring-task-completions", boardId],
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
    const periodStart = getTaskPeriodStart(task);
    return (completionsQuery.data ?? []).some(
      (c) => c.recurring_task_id === task.id && c.period_start === periodStart
    );
  };

  const toggleCompletion = useMutation({
    mutationFn: async ({ task }: { task: RecurringTask }) => {
      const periodStart = getTaskPeriodStart(task);
      const existing = (completionsQuery.data ?? []).find(
        (c) => c.recurring_task_id === task.id && c.period_start === periodStart
      );
      if (existing) {
        const { error } = await supabase
          .from("recurring_task_completions" as any)
          .delete()
          .eq("id", existing.id);
        if (error) throw error;
        await logActivity("Desmarcou tarefa fixa como concluída", { task_title: task.title }, task.team_id);
      } else {
        const { error } = await supabase
          .from("recurring_task_completions" as any)
          .insert({
            recurring_task_id: task.id,
            completed_by: user!.id,
            period_start: periodStart,
          });
        if (error) throw error;
        await logActivity("Marcou tarefa fixa como concluída", { task_title: task.title }, task.team_id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-task-completions"] });
    },
  });

  const createTask = useMutation({
    mutationFn: async (params: {
      title: string;
      description?: string;
      boardId: string;
      teamId: string;
      frequency: "daily" | "weekly" | "weekday" | "monthly";
      weekday?: number | null;
      monthDay?: number | null;
      scheduledTime?: string | null;
    }) => {
      const { error } = await supabase.from("recurring_tasks" as any).insert({
        title: params.title,
        description: params.description || null,
        frequency: params.frequency,
        board_id: params.boardId,
        team_id: params.teamId,
        created_by: user!.id,
        weekday: params.frequency === "weekday" ? (params.weekday ?? 0) : null,
        month_day: params.frequency === "monthly" ? (params.monthDay ?? 1) : null,
        scheduled_time: params.scheduledTime || null,
      });
      if (error) throw error;
      await logActivity("Criou uma tarefa fixa", { task_title: params.title }, params.teamId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recurring-tasks"] }),
  });

  const updateTask = useMutation({
    mutationFn: async (params: {
      id: string;
      title: string;
      description?: string | null;
      frequency: "daily" | "weekly" | "weekday" | "monthly";
      weekday?: number | null;
      monthDay?: number | null;
      scheduledTime?: string | null;
      teamId: string;
    }) => {
      const { error } = await supabase
        .from("recurring_tasks" as any)
        .update({
          title: params.title,
          description: params.description || null,
          frequency: params.frequency,
          weekday: params.frequency === "weekday" ? (params.weekday ?? 0) : null,
          month_day: params.frequency === "monthly" ? (params.monthDay ?? 1) : null,
          scheduled_time: params.scheduledTime || null,
        })
        .eq("id", params.id);
      if (error) throw error;
      await logActivity("Editou uma tarefa fixa", { task_title: params.title }, params.teamId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recurring-tasks"] }),
  });

  const deleteTask = useMutation({
    mutationFn: async (taskId: string) => {
      const task = tasksQuery.data?.find(t => t.id === taskId);
      const { error } = await supabase
        .from("recurring_tasks" as any)
        .delete()
        .eq("id", taskId);
      if (error) throw error;
      await logActivity("Excluiu uma tarefa fixa", { task_title: task?.title }, task?.team_id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recurring-tasks"] }),
  });

  const reorderTasks = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, index) =>
        supabase.from("recurring_tasks" as any).update({ position: index }).eq("id", id)
      );
      const results = await Promise.all(updates);
      const err = results.find(r => r.error);
      if (err?.error) throw err.error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recurring-tasks"] }),
  });

  return {
    tasks: tasksQuery.data ?? [],
    isLoading: tasksQuery.isLoading,
    isTaskCompleted,
    toggleCompletion,
    createTask,
    updateTask,
    deleteTask,
    reorderTasks,
  };
}
