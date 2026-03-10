import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { startOfWeek, format } from "date-fns";

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

export function useSocialMutations() {
  const { user } = useAuth();
  const qc = useQueryClient();

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
    }) => {
      const { error } = await supabase
        .from("social_tasks")
        .insert({ ...task, created_by: user!.id, status: "pending" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["social-tasks"] }),
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<SocialTask>) => {
      const { error } = await supabase
        .from("social_tasks")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["social-tasks"] }),
  });

  const completeTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from("social_tasks")
        .update({ status: "completed", completed_at: new Date().toISOString(), completed_by: user!.id })
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["social-tasks"] }),
  });

  const uncompleteTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from("social_tasks")
        .update({ status: "pending", completed_at: null, completed_by: null })
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["social-tasks"] }),
  });

  const deleteTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from("social_tasks")
        .delete()
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["social-tasks"] }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["social-tasks"] }),
  });

  const deleteProof = useMutation({
    mutationFn: async (proofId: string) => {
      const { error } = await supabase
        .from("social_task_proofs")
        .delete()
        .eq("id", proofId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["social-tasks"] }),
  });

  return { saveGoal, createTask, updateTask, completeTask, uncompleteTask, deleteTask, uploadProof, deleteProof };
}
