import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useLogActivity } from "./useActivityLog";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type Board = Tables<"boards">;
export type BoardColumn = Tables<"board_columns">;
export type Task = Tables<"tasks">;

export function useBoards(teamId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const logActivity = useLogActivity();

  const boardsQuery = useQuery({
    queryKey: ["boards", teamId],
    queryFn: async () => {
      let query = supabase.from("boards").select("*, board_columns(*, tasks(*))").order("created_at", { ascending: false });
      if (teamId) query = query.eq("team_id", teamId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const createBoard = useMutation({
    mutationFn: async ({ name, description, teamId, assignedUserId }: { name: string; description?: string; teamId: string; assignedUserId?: string }) => {
      const { data, error } = await supabase
        .from("boards")
        .insert({ name, description: description || null, team_id: teamId, created_by: user!.id, assigned_user_id: assignedUserId || null })
        .select()
        .single();
      if (error) throw error;

      const defaultColumns = ["A Fazer", "Em Andamento", "Em Revisão", "Concluído"];
      const { error: colError } = await supabase.from("board_columns").insert(
        defaultColumns.map((name, i) => ({ board_id: data.id, name, position: i }))
      );
      if (colError) throw colError;

      await logActivity("Criou um quadro", { board_name: name }, teamId);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["boards"] }),
  });

  // Realtime: refresh boards list on any board change
  useEffect(() => {
    const channel = supabase
      .channel("boards-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "boards" }, () => {
        queryClient.invalidateQueries({ queryKey: ["boards"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return { boards: boardsQuery.data ?? [], isLoading: boardsQuery.isLoading, createBoard };
}

export function useBoardDetail(boardId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const logActivity = useLogActivity();

  const boardQuery = useQuery({
    queryKey: ["board", boardId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("boards")
        .select("*, board_columns(*, tasks(*))")
        .eq("id", boardId)
        .single();
      if (error) throw error;
      if (data.board_columns) {
        data.board_columns.sort((a: any, b: any) => a.position - b.position);
        data.board_columns.forEach((col: any) => {
          if (col.tasks) col.tasks.sort((a: any, b: any) => a.position - b.position);
        });
      }
      return data;
    },
    enabled: !!user && !!boardId,
  });

  const getTeamId = () => boardQuery.data?.team_id;

  const addColumn = useMutation({
    mutationFn: async ({ name, position }: { name: string; position: number }) => {
      const { error } = await supabase.from("board_columns").insert({ board_id: boardId, name, position });
      if (error) throw error;
      await logActivity("Adicionou uma coluna", { column_name: name, board_name: boardQuery.data?.name }, getTeamId());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["board", boardId] }),
  });

  const updateColumn = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from("board_columns").update({ name }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["board", boardId] }),
  });

  const deleteColumn = useMutation({
    mutationFn: async (columnId: string) => {
      const col = boardQuery.data?.board_columns?.find((c: any) => c.id === columnId);
      const { error } = await supabase.from("board_columns").delete().eq("id", columnId);
      if (error) throw error;
      await logActivity("Excluiu uma coluna", { column_name: col?.name, board_name: boardQuery.data?.name }, getTeamId());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["board", boardId] }),
  });

  const addTask = useMutation({
    mutationFn: async ({ columnId, title, priority, description, assigneeId, dueDate, scheduledTime }: { columnId: string; title: string; priority?: string; description?: string; assigneeId?: string; dueDate?: string; scheduledTime?: string }) => {
      const colTasks = boardQuery.data?.board_columns?.find((c: any) => c.id === columnId)?.tasks ?? [];
      const position = colTasks.length;
      const { error } = await supabase.from("tasks").insert({
        column_id: columnId,
        title,
        priority: (priority || "medium") as any,
        description: description || null,
        position,
        created_by: user!.id,
        assignee_id: assigneeId || null,
        due_date: dueDate || null,
        scheduled_time: scheduledTime || null,
      });
      if (error) throw error;
      const col = boardQuery.data?.board_columns?.find((c: any) => c.id === columnId);
      await logActivity("Criou uma tarefa", { task_title: title, column_name: col?.name, board_name: boardQuery.data?.name }, getTeamId());

      // Notify via Z-API + in-app (always on task creation)
      supabase.functions.invoke("notify-task-assigned", {
        body: { taskTitle: title, assigneeId: assigneeId || null, boardName: boardQuery.data?.name, assignedByName: user?.user_metadata?.name || user?.email, isNewTask: true, dueDate: dueDate || null, description: description || null },
      }).catch(console.error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["board", boardId] }),
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<TablesInsert<"tasks">> & { scheduled_time?: string | null }) => {
      // Find previous assignee to detect changes
      let previousAssigneeId: string | null = null;
      boardQuery.data?.board_columns?.forEach((col: any) => {
        const task = col.tasks?.find((t: any) => t.id === id);
        if (task) previousAssigneeId = task.assignee_id;
      });

      const { error } = await supabase.from("tasks").update(updates).eq("id", id);
      if (error) throw error;
      await logActivity("Atualizou uma tarefa", { task_title: updates.title, board_name: boardQuery.data?.name }, getTeamId());

      // Notify if assignee changed
      if (updates.assignee_id && updates.assignee_id !== previousAssigneeId) {
        supabase.functions.invoke("notify-task-assigned", {
          body: { taskTitle: updates.title, assigneeId: updates.assignee_id, boardName: boardQuery.data?.name, assignedByName: user?.user_metadata?.name || user?.email, dueDate: updates.due_date || null, description: updates.description || null },
        }).catch(console.error);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["board", boardId] }),
  });

  const deleteTask = useMutation({
    mutationFn: async (taskId: string) => {
      // Find task title before deleting
      let taskTitle = "";
      boardQuery.data?.board_columns?.forEach((col: any) => {
        const task = col.tasks?.find((t: any) => t.id === taskId);
        if (task) taskTitle = task.title;
      });
      const { error } = await supabase.from("tasks").delete().eq("id", taskId);
      if (error) throw error;
      await logActivity("Excluiu uma tarefa", { task_title: taskTitle, board_name: boardQuery.data?.name }, getTeamId());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["board", boardId] }),
  });

  const moveTask = useMutation({
    mutationFn: async ({ taskId, newColumnId, newPosition }: { taskId: string; newColumnId: string; newPosition: number }) => {
      // Find task and columns info before moving
      let taskTitle = "";
      let fromCol = "";
      boardQuery.data?.board_columns?.forEach((col: any) => {
        const task = col.tasks?.find((t: any) => t.id === taskId);
        if (task) {
          taskTitle = task.title;
          fromCol = col.name;
        }
      });
      const toCol = boardQuery.data?.board_columns?.find((c: any) => c.id === newColumnId)?.name;

      const { error } = await supabase.from("tasks").update({ column_id: newColumnId, position: newPosition }).eq("id", taskId);
      if (error) throw error;

      if (fromCol !== toCol) {
        await logActivity("Moveu uma tarefa", {
          task_title: taskTitle,
          from_column: fromCol,
          to_column: toCol,
          board_name: boardQuery.data?.name,
        }, getTeamId());
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["board", boardId] }),
  });

  // Realtime: refresh board detail on task/column/subtask changes
  useEffect(() => {
    if (!boardId) return;
    const channel = supabase
      .channel(`board-detail-${boardId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
        queryClient.invalidateQueries({ queryKey: ["board", boardId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "board_columns" }, () => {
        queryClient.invalidateQueries({ queryKey: ["board", boardId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "subtasks" }, () => {
        queryClient.invalidateQueries({ queryKey: ["board", boardId] });
        queryClient.invalidateQueries({ queryKey: ["subtasks"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [boardId, queryClient]);

  return {
    board: boardQuery.data,
    isLoading: boardQuery.isLoading,
    addColumn,
    updateColumn,
    deleteColumn,
    addTask,
    updateTask,
    deleteTask,
    moveTask,
  };
}

export function useTeams() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const { data, error } = await supabase.from("teams").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useTeamMembers(teamId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["team-members", teamId],
    queryFn: async () => {
      const { data: members, error } = await supabase
        .from("team_members")
        .select("user_id, role")
        .eq("team_id", teamId!);
      if (error) throw error;

      const userIds = members.map((m) => m.user_id);
      const { data: profiles, error: pError } = await supabase
        .from("profiles")
        .select("user_id, name")
        .in("user_id", userIds);
      if (pError) throw pError;

      const profileMap = new Map(profiles.map((p) => [p.user_id, p]));
      return members.map((m) => ({
        ...m,
        profiles: profileMap.get(m.user_id) ?? { user_id: m.user_id, name: "Usuário" },
      }));
    },
    enabled: !!user && !!teamId,
  });
}
