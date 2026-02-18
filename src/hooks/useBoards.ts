import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type Board = Tables<"boards">;
export type BoardColumn = Tables<"board_columns">;
export type Task = Tables<"tasks">;

export function useBoards(teamId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

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

      // Create default columns
      const defaultColumns = ["A Fazer", "Em Andamento", "Em Revisão", "Concluído"];
      const { error: colError } = await supabase.from("board_columns").insert(
        defaultColumns.map((name, i) => ({ board_id: data.id, name, position: i }))
      );
      if (colError) throw colError;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["boards"] }),
  });

  return { boards: boardsQuery.data ?? [], isLoading: boardsQuery.isLoading, createBoard };
}

export function useBoardDetail(boardId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const boardQuery = useQuery({
    queryKey: ["board", boardId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("boards")
        .select("*, board_columns(*, tasks(*))")
        .eq("id", boardId)
        .single();
      if (error) throw error;
      // Sort columns by position, tasks by position
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

  const addColumn = useMutation({
    mutationFn: async ({ name, position }: { name: string; position: number }) => {
      const { error } = await supabase.from("board_columns").insert({ board_id: boardId, name, position });
      if (error) throw error;
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
      const { error } = await supabase.from("board_columns").delete().eq("id", columnId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["board", boardId] }),
  });

  const addTask = useMutation({
    mutationFn: async ({ columnId, title, priority, description }: { columnId: string; title: string; priority?: string; description?: string }) => {
      const colTasks = boardQuery.data?.board_columns?.find((c: any) => c.id === columnId)?.tasks ?? [];
      const position = colTasks.length;
      const { error } = await supabase.from("tasks").insert({
        column_id: columnId,
        title,
        priority: (priority || "medium") as any,
        description: description || null,
        position,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["board", boardId] }),
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<TablesInsert<"tasks">>) => {
      const { error } = await supabase.from("tasks").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["board", boardId] }),
  });

  const deleteTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["board", boardId] }),
  });

  const moveTask = useMutation({
    mutationFn: async ({ taskId, newColumnId, newPosition }: { taskId: string; newColumnId: string; newPosition: number }) => {
      const { error } = await supabase.from("tasks").update({ column_id: newColumnId, position: newPosition }).eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["board", boardId] }),
  });

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
      const { data, error } = await supabase
        .from("team_members")
        .select("user_id, role, profiles:user_id(name, user_id)")
        .eq("team_id", teamId!);
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!teamId,
  });
}
