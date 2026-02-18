
-- Fix DELETE RLS policy to include app admins
DROP POLICY IF EXISTS "Team admins can delete team" ON public.teams;
CREATE POLICY "Team admins or app admins can delete team"
  ON public.teams FOR DELETE
  USING (is_app_admin() OR is_team_admin(id));

-- Add CASCADE to foreign keys referencing teams
ALTER TABLE public.team_members DROP CONSTRAINT IF EXISTS team_members_team_id_fkey;
ALTER TABLE public.team_members ADD CONSTRAINT team_members_team_id_fkey
  FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;

ALTER TABLE public.boards DROP CONSTRAINT IF EXISTS boards_team_id_fkey;
ALTER TABLE public.boards ADD CONSTRAINT boards_team_id_fkey
  FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;

ALTER TABLE public.activity_log DROP CONSTRAINT IF EXISTS activity_log_team_id_fkey;
ALTER TABLE public.activity_log ADD CONSTRAINT activity_log_team_id_fkey
  FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;

ALTER TABLE public.recurring_task_boards DROP CONSTRAINT IF EXISTS recurring_task_boards_team_id_fkey;
ALTER TABLE public.recurring_task_boards ADD CONSTRAINT recurring_task_boards_team_id_fkey
  FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;

ALTER TABLE public.recurring_tasks DROP CONSTRAINT IF EXISTS recurring_tasks_team_id_fkey;
ALTER TABLE public.recurring_tasks ADD CONSTRAINT recurring_tasks_team_id_fkey
  FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;
