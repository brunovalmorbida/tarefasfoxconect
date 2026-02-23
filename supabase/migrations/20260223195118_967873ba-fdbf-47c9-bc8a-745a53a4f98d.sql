
-- Update boards SELECT policy to restrict visibility when assigned_user_id is set
DROP POLICY IF EXISTS "Team members can view boards" ON public.boards;

CREATE POLICY "Team members can view boards"
  ON public.boards FOR SELECT
  TO authenticated
  USING (
    is_app_admin()
    OR has_team_visibility(auth.uid(), team_id)
    OR (assigned_user_id IS NULL AND is_team_member(team_id))
    OR (assigned_user_id = auth.uid())
  );
