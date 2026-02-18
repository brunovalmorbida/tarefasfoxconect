
-- Create recurring task boards table
CREATE TABLE public.recurring_task_boards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  frequency_type TEXT NOT NULL, -- 'weekday', 'weekly', 'monthly'
  weekday INTEGER, -- 0=Monday..6=Sunday, only used when frequency_type='weekday'
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Validation trigger instead of CHECK for frequency_type
CREATE OR REPLACE FUNCTION public.validate_recurring_task_board()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.frequency_type NOT IN ('weekday', 'weekly', 'monthly') THEN
    RAISE EXCEPTION 'frequency_type must be weekday, weekly, or monthly';
  END IF;
  IF NEW.frequency_type = 'weekday' AND (NEW.weekday IS NULL OR NEW.weekday < 0 OR NEW.weekday > 6) THEN
    RAISE EXCEPTION 'weekday must be 0-6 when frequency_type is weekday';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_recurring_task_board_trigger
BEFORE INSERT OR UPDATE ON public.recurring_task_boards
FOR EACH ROW EXECUTE FUNCTION public.validate_recurring_task_board();

-- Updated_at trigger
CREATE TRIGGER update_recurring_task_boards_updated_at
BEFORE UPDATE ON public.recurring_task_boards
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.recurring_task_boards ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Team members can view recurring task boards"
ON public.recurring_task_boards FOR SELECT
USING (is_team_member(team_id));

CREATE POLICY "Authorized users can create recurring task boards"
ON public.recurring_task_boards FOR INSERT
WITH CHECK (is_app_admin() OR (is_team_member(team_id) AND has_permission(auth.uid(), 'manage_recurring_tasks')));

CREATE POLICY "Authorized users can update recurring task boards"
ON public.recurring_task_boards FOR UPDATE
USING (is_app_admin() OR (is_team_member(team_id) AND has_permission(auth.uid(), 'manage_recurring_tasks')));

CREATE POLICY "Authorized users can delete recurring task boards"
ON public.recurring_task_boards FOR DELETE
USING (is_app_admin() OR (is_team_member(team_id) AND has_permission(auth.uid(), 'manage_recurring_tasks')));

-- Add board_id to recurring_tasks
ALTER TABLE public.recurring_tasks ADD COLUMN board_id UUID REFERENCES public.recurring_task_boards(id) ON DELETE CASCADE;
