import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from "date-fns";

export const PIPELINE_STATUSES = [
  { value: "idea", label: "Ideia", color: "hsl(var(--muted-foreground))" },
  { value: "recording", label: "Gravando", color: "hsl(38, 92%, 50%)" },
  { value: "editing", label: "Editando", color: "hsl(210, 70%, 55%)" },
  { value: "ready", label: "Pronto para postar", color: "hsl(142, 71%, 45%)" },
  { value: "published", label: "Publicado", color: "hsl(262, 83%, 58%)" },
] as const;

export const CONTENT_STRATEGY_TYPES = [
  { value: "educativo", label: "Educativo" },
  { value: "promocao", label: "Promoção" },
  { value: "meme", label: "Meme" },
  { value: "bastidores", label: "Bastidores" },
  { value: "prova_social", label: "Prova Social" },
  { value: "cliente", label: "Cliente" },
  { value: "dica_tecnica", label: "Dica Técnica" },
  { value: "institucional", label: "Institucional" },
] as const;

export type PipelineStatus = typeof PIPELINE_STATUSES[number]["value"];

export interface SocialCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface SocialGoal {
  id: string;
  category_id: string;
  week_start: string;
  target_count: number;
  created_by: string;
  category?: SocialCategory;
}

export interface SocialTask {
  id: string;
  goal_id: string | null;
  category_id: string;
  title: string;
  description: string | null;
  status: string;
  pipeline_status: PipelineStatus;
  content_strategy_type: string | null;
  post_link: string | null;
  assigned_to: string | null;
  due_date: string | null;
  completed_at: string | null;
  completed_by: string | null;
  created_by: string;
  created_at: string;
  category?: SocialCategory;
  proofs?: SocialProof[];
}

export interface SocialProof {
  id: string;
  task_id: string;
  file_url: string;
  file_name: string | null;
  file_type: string;
  source: string;
  uploaded_by: string;
  created_at: string;
}

export interface SocialAutoGoal {
  id: string;
  category_id: string;
  target_count: number;
  auto_create: boolean;
  default_assigned_to: string | null;
  created_by: string;
}

export function useCategories() {
  return useQuery({
    queryKey: ["social-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_content_categories")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as SocialCategory[];
    },
  });
}

export function useWeekGoals(weekStart: string) {
  return useQuery({
    queryKey: ["social-goals", weekStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_goals")
        .select("*, category:social_content_categories(*)")
        .eq("week_start", weekStart);
      if (error) throw error;
      return data as SocialGoal[];
    },
  });
}

export function useWeekTasks(weekStart: string) {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEndStr = format(weekEnd, "yyyy-MM-dd");

  return useQuery({
    queryKey: ["social-tasks", weekStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_tasks")
        .select("*, category:social_content_categories(*), proofs:social_task_proofs(*)")
        .gte("due_date", weekStart)
        .lte("due_date", weekEndStr)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data as SocialTask[];
    },
  });
}

export function useAllTasks() {
  return useQuery({
    queryKey: ["social-tasks-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_tasks")
        .select("*, category:social_content_categories(*), proofs:social_task_proofs(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as SocialTask[];
    },
  });
}

export function useMonthTasks(monthDate: Date) {
  const monthStart = format(startOfMonth(monthDate), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(monthDate), "yyyy-MM-dd");

  return useQuery({
    queryKey: ["social-tasks-month", monthStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_tasks")
        .select("*, category:social_content_categories(*), proofs:social_task_proofs(*)")
        .gte("due_date", monthStart)
        .lte("due_date", monthEnd)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data as SocialTask[];
    },
  });
}

export function useAutoGoals() {
  return useQuery({
    queryKey: ["social-auto-goals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_auto_goals")
        .select("*");
      if (error) throw error;
      return data as SocialAutoGoal[];
    },
  });
}

export function useSocialMutations() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["social-tasks"] });
    qc.invalidateQueries({ queryKey: ["social-tasks-all"] });
    qc.invalidateQueries({ queryKey: ["social-tasks-month"] });
  };

  const saveGoal = useMutation({
    mutationFn: async (goal: { category_id: string; week_start: string; target_count: number }) => {
      const { data: existing } = await supabase
        .from("social_goals")
        .select("id")
        .eq("category_id", goal.category_id)
        .eq("week_start", goal.week_start)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("social_goals")
          .update({ target_count: goal.target_count })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("social_goals")
          .insert({ ...goal, created_by: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["social-goals"] }),
  });

  const createTask = useMutation({
    mutationFn: async (task: {
      category_id: string;
      goal_id?: string;
      title: string;
      description?: string;
      assigned_to?: string;
      due_date?: string;
      pipeline_status?: string;
      content_strategy_type?: string;
    }) => {
      const { error } = await supabase
        .from("social_tasks")
        .insert({
          ...task,
          created_by: user!.id,
          status: "pending",
          pipeline_status: task.pipeline_status || "idea",
        } as any);
      if (error) throw error;
    },
    onSuccess: invalidateAll,
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<SocialTask>) => {
      const { error } = await supabase
        .from("social_tasks")
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidateAll,
  });

  const updatePipelineStatus = useMutation({
    mutationFn: async ({ id, pipeline_status }: { id: string; pipeline_status: PipelineStatus }) => {
      const updates: any = { pipeline_status };
      if (pipeline_status === "published") {
        updates.status = "completed";
        updates.completed_at = new Date().toISOString();
        updates.completed_by = user!.id;
      }
      const { error } = await supabase
        .from("social_tasks")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidateAll,
  });

  const completeTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from("social_tasks")
        .update({ status: "completed", completed_at: new Date().toISOString(), completed_by: user!.id } as any)
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: invalidateAll,
  });

  const uncompleteTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from("social_tasks")
        .update({ status: "pending", completed_at: null, completed_by: null } as any)
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: invalidateAll,
  });

  const deleteTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from("social_tasks")
        .delete()
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: invalidateAll,
  });

  const uploadProof = useMutation({
    mutationFn: async ({ taskId, file }: { taskId: string; file: File }) => {
      const ext = file.name.split(".").pop();
      const path = `${taskId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("social-proofs")
        .upload(path, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("social-proofs")
        .getPublicUrl(path);

      const { error } = await supabase
        .from("social_task_proofs")
        .insert({
          task_id: taskId,
          file_url: urlData.publicUrl,
          file_name: file.name,
          file_type: file.type.startsWith("image") ? "image" : "file",
          source: "upload",
          uploaded_by: user!.id,
        });
      if (error) throw error;
    },
    onSuccess: invalidateAll,
  });

  const deleteProof = useMutation({
    mutationFn: async (proofId: string) => {
      const { error } = await supabase
        .from("social_task_proofs")
        .delete()
        .eq("id", proofId);
      if (error) throw error;
    },
    onSuccess: invalidateAll,
  });

  const saveAutoGoal = useMutation({
    mutationFn: async (goal: { category_id: string; target_count: number; auto_create: boolean; default_assigned_to?: string }) => {
      const { data: existing } = await supabase
        .from("social_auto_goals")
        .select("id")
        .eq("category_id", goal.category_id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("social_auto_goals")
          .update({ target_count: goal.target_count, auto_create: goal.auto_create, default_assigned_to: goal.default_assigned_to || null } as any)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("social_auto_goals")
          .insert({ ...goal, created_by: user!.id } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["social-auto-goals"] }),
  });

  const generateWeekTasks = useMutation({
    mutationFn: async ({ weekStart, autoGoals, categories }: { weekStart: string; autoGoals: SocialAutoGoal[]; categories: SocialCategory[] }) => {
      const tasksToCreate: any[] = [];
      for (const ag of autoGoals) {
        if (!ag.auto_create || ag.target_count <= 0) continue;
        const cat = categories.find(c => c.id === ag.category_id);
        if (!cat) continue;
        for (let i = 0; i < ag.target_count; i++) {
          const dayOffset = Math.floor((i / ag.target_count) * 7);
          const dueDate = new Date(weekStart);
          dueDate.setDate(dueDate.getDate() + dayOffset);
          tasksToCreate.push({
            category_id: ag.category_id,
            title: `${cat.name} ${i + 1}`,
            status: "pending",
            pipeline_status: "idea",
            due_date: format(dueDate, "yyyy-MM-dd"),
            assigned_to: ag.default_assigned_to || null,
            created_by: user!.id,
          });
        }
      }
      if (tasksToCreate.length > 0) {
        const { error } = await supabase.from("social_tasks").insert(tasksToCreate);
        if (error) throw error;
      }
      return tasksToCreate.length;
    },
    onSuccess: invalidateAll,
  });

  return {
    saveGoal, createTask, updateTask, updatePipelineStatus,
    completeTask, uncompleteTask, deleteTask,
    uploadProof, deleteProof,
    saveAutoGoal, generateWeekTasks,
  };
}
