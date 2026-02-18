
-- Permissions table
CREATE TABLE public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  can_manage_boards boolean NOT NULL DEFAULT false,
  can_manage_columns boolean NOT NULL DEFAULT false,
  can_manage_tasks boolean NOT NULL DEFAULT false,
  can_manage_recurring_tasks boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view all permissions" ON public.user_permissions
  FOR SELECT USING (is_app_admin());

CREATE POLICY "Users can view own permissions" ON public.user_permissions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admin can insert permissions" ON public.user_permissions
  FOR INSERT WITH CHECK (is_app_admin());

CREATE POLICY "Admin can update permissions" ON public.user_permissions
  FOR UPDATE USING (is_app_admin());

CREATE POLICY "Admin can delete permissions" ON public.user_permissions
  FOR DELETE USING (is_app_admin());

-- Security definer function to check a specific permission
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE _permission
    WHEN 'manage_boards' THEN COALESCE((SELECT can_manage_boards FROM public.user_permissions WHERE user_id = _user_id), false)
    WHEN 'manage_columns' THEN COALESCE((SELECT can_manage_columns FROM public.user_permissions WHERE user_id = _user_id), false)
    WHEN 'manage_tasks' THEN COALESCE((SELECT can_manage_tasks FROM public.user_permissions WHERE user_id = _user_id), false)
    WHEN 'manage_recurring_tasks' THEN COALESCE((SELECT can_manage_recurring_tasks FROM public.user_permissions WHERE user_id = _user_id), false)
    ELSE false
  END;
$$;

-- Update RLS: boards INSERT/UPDATE/DELETE → admin OR has permission
DROP POLICY "Team members can create boards" ON public.boards;
CREATE POLICY "Authorized users can create boards" ON public.boards
  FOR INSERT WITH CHECK (
    is_team_member(team_id) AND (auth.uid() = created_by) AND (is_app_admin() OR has_permission(auth.uid(), 'manage_boards'))
  );

DROP POLICY "Only app admin can update boards" ON public.boards;
CREATE POLICY "Authorized users can update boards" ON public.boards
  FOR UPDATE USING (is_app_admin() OR (is_team_member(team_id) AND has_permission(auth.uid(), 'manage_boards')));

DROP POLICY "Only app admin can delete boards" ON public.boards;
CREATE POLICY "Authorized users can delete boards" ON public.boards
  FOR DELETE USING (is_app_admin() OR (is_team_member(team_id) AND has_permission(auth.uid(), 'manage_boards')));

-- Update RLS: board_columns
DROP POLICY "Only app admin can create columns" ON public.board_columns;
CREATE POLICY "Authorized users can create columns" ON public.board_columns
  FOR INSERT WITH CHECK (is_app_admin() OR (is_team_member(get_team_id_from_board(board_id)) AND has_permission(auth.uid(), 'manage_columns')));

DROP POLICY "Only app admin can update columns" ON public.board_columns;
CREATE POLICY "Authorized users can update columns" ON public.board_columns
  FOR UPDATE USING (is_app_admin() OR (is_team_member(get_team_id_from_board(board_id)) AND has_permission(auth.uid(), 'manage_columns')));

DROP POLICY "Only app admin can delete columns" ON public.board_columns;
CREATE POLICY "Authorized users can delete columns" ON public.board_columns
  FOR DELETE USING (is_app_admin() OR (is_team_member(get_team_id_from_board(board_id)) AND has_permission(auth.uid(), 'manage_columns')));

-- Update RLS: tasks
DROP POLICY "Only app admin can create tasks" ON public.tasks;
CREATE POLICY "Authorized users can create tasks" ON public.tasks
  FOR INSERT WITH CHECK (is_app_admin() OR (is_team_member(get_team_id_from_column(column_id)) AND has_permission(auth.uid(), 'manage_tasks')));

DROP POLICY "Only app admin can update tasks" ON public.tasks;
CREATE POLICY "Authorized users can update tasks" ON public.tasks
  FOR UPDATE USING (is_app_admin() OR (is_team_member(get_team_id_from_column(column_id)) AND has_permission(auth.uid(), 'manage_tasks')));

DROP POLICY "Only app admin can delete tasks" ON public.tasks;
CREATE POLICY "Authorized users can delete tasks" ON public.tasks
  FOR DELETE USING (is_app_admin() OR (is_team_member(get_team_id_from_column(column_id)) AND has_permission(auth.uid(), 'manage_tasks')));

-- Update RLS: recurring_tasks
DROP POLICY "App admin can create recurring tasks" ON public.recurring_tasks;
CREATE POLICY "Authorized users can create recurring tasks" ON public.recurring_tasks
  FOR INSERT WITH CHECK (is_app_admin() OR (is_team_member(team_id) AND has_permission(auth.uid(), 'manage_recurring_tasks')));

DROP POLICY "App admin can update recurring tasks" ON public.recurring_tasks;
CREATE POLICY "Authorized users can update recurring tasks" ON public.recurring_tasks
  FOR UPDATE USING (is_app_admin() OR (is_team_member(team_id) AND has_permission(auth.uid(), 'manage_recurring_tasks')));

DROP POLICY "App admin can delete recurring tasks" ON public.recurring_tasks;
CREATE POLICY "Authorized users can delete recurring tasks" ON public.recurring_tasks
  FOR DELETE USING (is_app_admin() OR (is_team_member(team_id) AND has_permission(auth.uid(), 'manage_recurring_tasks')));

-- Trigger for updated_at
CREATE TRIGGER update_user_permissions_updated_at
  BEFORE UPDATE ON public.user_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
