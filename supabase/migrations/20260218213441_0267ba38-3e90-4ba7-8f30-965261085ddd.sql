
DROP POLICY IF EXISTS "Team members can view recurring task boards" ON public.recurring_task_boards;

CREATE POLICY "Team members can view recurring task boards"
ON public.recurring_task_boards
FOR SELECT
USING (is_app_admin() OR is_team_member(team_id));
