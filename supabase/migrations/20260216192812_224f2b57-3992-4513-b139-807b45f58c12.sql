
-- Create admin roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Only admins can view/manage roles
CREATE POLICY "Users can view own role" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Security definer function to check admin
CREATE OR REPLACE FUNCTION public.is_app_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

-- Insert admin role for brunovalmorbida@live.com
INSERT INTO public.user_roles (user_id, role)
VALUES ('9c9b5f63-dc3d-4277-a41a-c83b26f6883c', 'admin');

-- Update board editing policies: only app admin can update/delete boards
DROP POLICY IF EXISTS "Team admins can update boards" ON public.boards;
CREATE POLICY "Only app admin can update boards" ON public.boards
  FOR UPDATE TO authenticated
  USING (public.is_app_admin());

DROP POLICY IF EXISTS "Team admins can delete boards" ON public.boards;
CREATE POLICY "Only app admin can delete boards" ON public.boards
  FOR DELETE TO authenticated
  USING (public.is_app_admin());

-- Update board_columns: only app admin can create/update/delete columns
DROP POLICY IF EXISTS "Team members can create columns" ON public.board_columns;
CREATE POLICY "Only app admin can create columns" ON public.board_columns
  FOR INSERT TO authenticated
  WITH CHECK (public.is_app_admin());

DROP POLICY IF EXISTS "Team members can update columns" ON public.board_columns;
CREATE POLICY "Only app admin can update columns" ON public.board_columns
  FOR UPDATE TO authenticated
  USING (public.is_app_admin());

DROP POLICY IF EXISTS "Team admins can delete columns" ON public.board_columns;
CREATE POLICY "Only app admin can delete columns" ON public.board_columns
  FOR DELETE TO authenticated
  USING (public.is_app_admin());

-- Update tasks: only app admin can create/update/delete tasks
DROP POLICY IF EXISTS "Team members can create tasks" ON public.tasks;
CREATE POLICY "Only app admin can create tasks" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (public.is_app_admin());

DROP POLICY IF EXISTS "Team members can update tasks" ON public.tasks;
CREATE POLICY "Only app admin can update tasks" ON public.tasks
  FOR UPDATE TO authenticated
  USING (public.is_app_admin());

DROP POLICY IF EXISTS "Team members can delete tasks" ON public.tasks;
CREATE POLICY "Only app admin can delete tasks" ON public.tasks
  FOR DELETE TO authenticated
  USING (public.is_app_admin());
