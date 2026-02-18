import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { startOfDay, startOfWeek, startOfMonth, format, getDay } from "date-fns";

export type RecurringTaskBoard = {
  id: string;
  team_id: string;
  name: string;
  frequency_type: "weekday" | "weekly" | "monthly";
  weekday: number | null; // 0=Monday..6=Sunday
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

const WEEKDAY_NAMES = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

export function getWeekdayName(weekday: number): string {
  return WEEKDAY_NAMES[weekday] ?? "";
}

function getCurrentPeriodStart(frequencyType: "weekday" | "weekly" | "monthly", weekday?: number | null): string {
  const now = new Date();
  switch (frequencyType) {
    case "weekday":
      return format(startOfDay(now), "yyyy-MM-dd");
    case "weekly":
      return format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
    case "monthly":
      return format(startOfMonth(now), "yyyy-MM-dd");
  }
}

function isActiveToday(board: RecurringTaskBoard): boolean {
  if (board.frequency_type !== "weekday" || board.weekday === null) return true;
  // JS getDay: 0=Sun,1=Mon..6=Sat → convert to our 0=Mon..6=Sun
  const jsDay = getDay(new Date());
  const ourDay = jsDay === 0 ? 6 : jsDay - 1;
  return ourDay === board.weekday;
}

export function useRecurringTaskBoards(teamId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const boardsQuery = useQuery({
    queryKey: ["recurring-task-boards", teamId],
    queryFn: async () => {
      let query = supabase
        .from("recurring_task_boards" as any)
        .select("*")
        .order("frequency_type")
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
    }) => {
      const { error } = await supabase.from("recurring_task_boards" as any).insert({
        name: params.name,
        frequency_type: params.frequencyType,
        weekday: params.frequencyType === "weekday" ? (params.weekday ?? 0) : null,
        team_id: params.teamId,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recurring-task-boards"] }),
  });

  const updateBoard = useMutation({
    mutationFn: async (params: {
      id: string;
      name: string;
      frequencyType: "weekday" | "weekly" | "monthly";
      weekday?: number;
    }) => {
      const { error } = await supabase
        .from("recurring_task_boards" as any)
        .update({
          name: params.name,
          frequency_type: params.frequencyType,
          weekday: params.frequencyType === "weekday" ? (params.weekday ?? 0) : null,
        })
        .eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recurring-task-boards"] }),
  });

  const deleteBoard = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("recurring_task_boards" as any).delete().eq("id", id);
      if (error) throw error;
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

  const tasksQuery = useQuery({
    queryKey: ["recurring-tasks", boardId],
    queryFn: async () => {
      let query = supabase
        .from("recurring_tasks" as any)
        .select("*")
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

  const isTaskCompleted = (task: RecurringTask, board: RecurringTaskBoard): boolean => {
    const periodStart = getCurrentPeriodStart(board.frequency_type, board.weekday);
    return (completionsQuery.data ?? []).some(
      (c) => c.recurring_task_id === task.id && c.period_start === periodStart
    );
  };

  const toggleCompletion = useMutation({
    mutationFn: async ({ task, board }: { task: RecurringTask; board: RecurringTaskBoard }) => {
      const periodStart = getCurrentPeriodStart(board.frequency_type, board.weekday);
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
    mutationFn: async (params: {
      title: string;
      description?: string;
      boardId: string;
      teamId: string;
    }) => {
      const { error } = await supabase.from("recurring_tasks" as any).insert({
        title: params.title,
        description: params.description || null,
        frequency: "daily", // legacy field, frequency is now on board
        board_id: params.boardId,
        team_id: params.teamId,
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

  return {
    tasks: tasksQuery.data ?? [],
    isLoading: tasksQuery.isLoading,
    isTaskCompleted,
    toggleCompletion,
    createTask,
    deleteTask,
  };
}
