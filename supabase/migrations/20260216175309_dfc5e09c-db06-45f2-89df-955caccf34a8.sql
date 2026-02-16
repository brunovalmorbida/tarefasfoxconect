
-- =============================================
-- ENUMS
-- =============================================
CREATE TYPE public.team_role AS ENUM ('admin', 'member');
CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high', 'urgent');

-- =============================================
-- 1. PROFILES TABLE
-- =============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  job_title TEXT,
  whatsapp_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 2. TEAMS TABLE
-- =============================================
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 3. TEAM_MEMBERS TABLE
-- =============================================
CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role team_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id)
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 4. BOARDS TABLE
-- =============================================
CREATE TABLE public.boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 5. COLUMNS TABLE
-- =============================================
CREATE TABLE public.board_columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.board_columns ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 6. TASKS TABLE
-- =============================================
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  column_id UUID NOT NULL REFERENCES public.board_columns(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  priority task_priority NOT NULL DEFAULT 'medium',
  due_date TIMESTAMPTZ,
  position INT NOT NULL DEFAULT 0,
  labels TEXT[] DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 7. COMMENTS TABLE
-- =============================================
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 8. ACTIVITY LOG TABLE
-- =============================================
CREATE TABLE public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 9. NOTIFICATIONS TABLE
-- =============================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- =============================================
-- HELPER FUNCTIONS (SECURITY DEFINER)
-- =============================================

-- Check if user is member of a team
CREATE OR REPLACE FUNCTION public.is_team_member(_team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = _team_id AND user_id = auth.uid()
  );
$$;

-- Check if user is admin of a team
CREATE OR REPLACE FUNCTION public.is_team_admin(_team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = _team_id AND user_id = auth.uid() AND role = 'admin'
  );
$$;

-- Get team_id from board_id
CREATE OR REPLACE FUNCTION public.get_team_id_from_board(_board_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT team_id FROM public.boards WHERE id = _board_id;
$$;

-- Get team_id from column_id
CREATE OR REPLACE FUNCTION public.get_team_id_from_column(_column_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.team_id FROM public.board_columns bc
  JOIN public.boards b ON b.id = bc.board_id
  WHERE bc.id = _column_id;
$$;

-- Get team_id from task_id
CREATE OR REPLACE FUNCTION public.get_team_id_from_task(_task_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.team_id FROM public.tasks t
  JOIN public.board_columns bc ON bc.id = t.column_id
  JOIN public.boards b ON b.id = bc.board_id
  WHERE t.id = _task_id;
$$;

-- =============================================
-- TIMESTAMP TRIGGER
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_boards_updated_at BEFORE UPDATE ON public.boards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- AUTO-ADD CREATOR AS TEAM ADMIN
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_team()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.team_members (team_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'admin');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_team_created
  AFTER INSERT ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_team();

-- =============================================
-- RLS POLICIES
-- =============================================

-- PROFILES
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
-- Allow team members to see each other's basic info
CREATE POLICY "Team members can view profiles" ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm1
      JOIN public.team_members tm2 ON tm1.team_id = tm2.team_id
      WHERE tm1.user_id = auth.uid() AND tm2.user_id = profiles.user_id
    )
  );

-- TEAMS
CREATE POLICY "Team members can view their teams" ON public.teams FOR SELECT USING (public.is_team_member(id));
CREATE POLICY "Authenticated users can create teams" ON public.teams FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Team admins can update team" ON public.teams FOR UPDATE USING (public.is_team_admin(id));
CREATE POLICY "Team admins can delete team" ON public.teams FOR DELETE USING (public.is_team_admin(id));

-- TEAM_MEMBERS
CREATE POLICY "Members can view team members" ON public.team_members FOR SELECT USING (public.is_team_member(team_id));
CREATE POLICY "Admins can add members" ON public.team_members FOR INSERT TO authenticated WITH CHECK (public.is_team_admin(team_id));
CREATE POLICY "Admins can update members" ON public.team_members FOR UPDATE USING (public.is_team_admin(team_id));
CREATE POLICY "Admins can remove members" ON public.team_members FOR DELETE USING (public.is_team_admin(team_id));

-- BOARDS
CREATE POLICY "Team members can view boards" ON public.boards FOR SELECT USING (public.is_team_member(team_id));
CREATE POLICY "Team members can create boards" ON public.boards FOR INSERT TO authenticated WITH CHECK (public.is_team_member(team_id) AND auth.uid() = created_by);
CREATE POLICY "Team admins can update boards" ON public.boards FOR UPDATE USING (public.is_team_admin(team_id));
CREATE POLICY "Team admins can delete boards" ON public.boards FOR DELETE USING (public.is_team_admin(team_id));

-- BOARD_COLUMNS
CREATE POLICY "Team members can view columns" ON public.board_columns FOR SELECT USING (public.is_team_member(public.get_team_id_from_board(board_id)));
CREATE POLICY "Team members can create columns" ON public.board_columns FOR INSERT TO authenticated WITH CHECK (public.is_team_member(public.get_team_id_from_board(board_id)));
CREATE POLICY "Team members can update columns" ON public.board_columns FOR UPDATE USING (public.is_team_member(public.get_team_id_from_board(board_id)));
CREATE POLICY "Team admins can delete columns" ON public.board_columns FOR DELETE USING (public.is_team_admin(public.get_team_id_from_board(board_id)));

-- TASKS
CREATE POLICY "Team members can view tasks" ON public.tasks FOR SELECT USING (public.is_team_member(public.get_team_id_from_column(column_id)));
CREATE POLICY "Team members can create tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (public.is_team_member(public.get_team_id_from_column(column_id)) AND auth.uid() = created_by);
CREATE POLICY "Team members can update tasks" ON public.tasks FOR UPDATE USING (public.is_team_member(public.get_team_id_from_column(column_id)));
CREATE POLICY "Team members can delete tasks" ON public.tasks FOR DELETE USING (public.is_team_member(public.get_team_id_from_column(column_id)));

-- COMMENTS
CREATE POLICY "Team members can view comments" ON public.comments FOR SELECT USING (public.is_team_member(public.get_team_id_from_task(task_id)));
CREATE POLICY "Team members can create comments" ON public.comments FOR INSERT TO authenticated WITH CHECK (public.is_team_member(public.get_team_id_from_task(task_id)) AND auth.uid() = user_id);
CREATE POLICY "Comment owners can update" ON public.comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Comment owners can delete" ON public.comments FOR DELETE USING (auth.uid() = user_id);

-- ACTIVITY LOG
CREATE POLICY "Team members can view activity" ON public.activity_log FOR SELECT USING (public.is_team_member(team_id));
CREATE POLICY "Team members can log activity" ON public.activity_log FOR INSERT TO authenticated WITH CHECK (public.is_team_member(team_id) AND auth.uid() = user_id);

-- NOTIFICATIONS
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notifications" ON public.notifications FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "System can create notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
