
-- Add assigned_user_id to recurring_task_boards
ALTER TABLE public.recurring_task_boards ADD COLUMN assigned_user_id UUID;

-- Update SELECT policy to restrict visibility
DROP POLICY IF EXISTS "Team members can view recurring task boards" ON public.recurring_task_boards;
CREATE POLICY "Team members can view recurring task boards"
ON public.recurring_task_boards FOR SELECT
USING (
  is_app_admin() OR
  (is_team_member(team_id) AND (assigned_user_id IS NULL OR assigned_user_id = auth.uid()))
);
