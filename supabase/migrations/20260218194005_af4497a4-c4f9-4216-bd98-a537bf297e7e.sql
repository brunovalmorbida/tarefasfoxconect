DROP POLICY "Team members can view their teams" ON public.teams;

CREATE POLICY "Team members or admins can view teams"
ON public.teams
FOR SELECT
USING (is_app_admin() OR is_team_member(id));