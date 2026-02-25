
-- Create subtasks table
CREATE TABLE public.subtasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;

-- Policies: same access as the parent task (team members)
CREATE POLICY "Team members can view subtasks"
  ON public.subtasks FOR SELECT
  USING (is_team_member(get_team_id_from_task(task_id)));

CREATE POLICY "Authorized users can create subtasks"
  ON public.subtasks FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    AND (is_app_admin() OR (is_team_member(get_team_id_from_task(task_id)) AND has_permission(auth.uid(), 'manage_tasks')))
  );

CREATE POLICY "Authorized users can update subtasks"
  ON public.subtasks FOR UPDATE
  USING (
    is_app_admin() OR (is_team_member(get_team_id_from_task(task_id)) AND has_permission(auth.uid(), 'manage_tasks'))
  );

CREATE POLICY "Authorized users can delete subtasks"
  ON public.subtasks FOR DELETE
  USING (
    is_app_admin() OR (is_team_member(get_team_id_from_task(task_id)) AND has_permission(auth.uid(), 'manage_tasks'))
  );

-- Trigger for updated_at
CREATE TRIGGER update_subtasks_updated_at
  BEFORE UPDATE ON public.subtasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
