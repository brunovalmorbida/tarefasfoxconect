
-- Add assigned_user_id column to boards
ALTER TABLE public.boards ADD COLUMN assigned_user_id uuid DEFAULT NULL;

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Team members can view boards" ON public.boards;

-- New SELECT policy: if assigned_user_id is null, team members can see; if set, only that user (or admin) can see
CREATE POLICY "Team members can view boards" ON public.boards
FOR SELECT USING (
  is_app_admin() OR
  (is_team_member(team_id) AND (assigned_user_id IS NULL OR assigned_user_id = auth.uid()))
);
