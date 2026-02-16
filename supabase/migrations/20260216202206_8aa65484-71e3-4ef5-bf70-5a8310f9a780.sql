
-- Recurring tasks table
CREATE TABLE public.recurring_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  frequency text NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Track completions per period
CREATE TABLE public.recurring_task_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_task_id uuid NOT NULL REFERENCES public.recurring_tasks(id) ON DELETE CASCADE,
  completed_by uuid NOT NULL,
  period_start date NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(recurring_task_id, period_start)
);

-- Enable RLS
ALTER TABLE public.recurring_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_task_completions ENABLE ROW LEVEL SECURITY;

-- RLS for recurring_tasks
CREATE POLICY "Team members can view recurring tasks"
ON public.recurring_tasks FOR SELECT
USING (is_team_member(team_id));

CREATE POLICY "App admin can create recurring tasks"
ON public.recurring_tasks FOR INSERT
WITH CHECK (is_app_admin());

CREATE POLICY "App admin can update recurring tasks"
ON public.recurring_tasks FOR UPDATE
USING (is_app_admin());

CREATE POLICY "App admin can delete recurring tasks"
ON public.recurring_tasks FOR DELETE
USING (is_app_admin());

-- RLS for completions - any team member can check/uncheck
CREATE POLICY "Team members can view completions"
ON public.recurring_task_completions FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.recurring_tasks rt
  WHERE rt.id = recurring_task_id AND is_team_member(rt.team_id)
));

CREATE POLICY "Team members can create completions"
ON public.recurring_task_completions FOR INSERT
WITH CHECK (
  auth.uid() = completed_by AND
  EXISTS (
    SELECT 1 FROM public.recurring_tasks rt
    WHERE rt.id = recurring_task_id AND is_team_member(rt.team_id)
  )
);

CREATE POLICY "Team members can delete own completions"
ON public.recurring_task_completions FOR DELETE
USING (
  auth.uid() = completed_by AND
  EXISTS (
    SELECT 1 FROM public.recurring_tasks rt
    WHERE rt.id = recurring_task_id AND is_team_member(rt.team_id)
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_recurring_tasks_updated_at
BEFORE UPDATE ON public.recurring_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
