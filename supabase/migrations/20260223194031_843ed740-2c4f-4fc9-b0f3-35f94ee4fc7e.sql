
-- Table to track which teams a user can view boards from
CREATE TABLE public.user_team_visibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, team_id)
);

ALTER TABLE public.user_team_visibility ENABLE ROW LEVEL SECURITY;

-- Only admins can manage visibility
CREATE POLICY "Admins can view team visibility"
  ON public.user_team_visibility FOR SELECT
  TO authenticated
  USING (is_app_admin() OR auth.uid() = user_id);

CREATE POLICY "Admins can insert team visibility"
  ON public.user_team_visibility FOR INSERT
  TO authenticated
  WITH CHECK (is_app_admin());

CREATE POLICY "Admins can delete team visibility"
  ON public.user_team_visibility FOR DELETE
  TO authenticated
  USING (is_app_admin());

-- Security definer function to check team visibility
CREATE OR REPLACE FUNCTION public.has_team_visibility(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_team_visibility
    WHERE user_id = _user_id AND team_id = _team_id
  );
$$;

-- Update boards SELECT policy: team members OR users with team visibility OR admins
DROP POLICY IF EXISTS "Team members can view boards" ON public.boards;

CREATE POLICY "Team members can view boards"
  ON public.boards FOR SELECT
  TO authenticated
  USING (
    is_app_admin()
    OR is_team_member(team_id)
    OR has_team_visibility(auth.uid(), team_id)
  );
