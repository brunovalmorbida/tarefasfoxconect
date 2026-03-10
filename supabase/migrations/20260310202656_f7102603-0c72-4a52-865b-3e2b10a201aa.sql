
-- Add social media permissions to user_permissions
ALTER TABLE public.user_permissions 
  ADD COLUMN IF NOT EXISTS can_manage_social boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_view_social boolean NOT NULL DEFAULT false;

-- Social content categories (customizable by admin)
CREATE TABLE public.social_content_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon text DEFAULT 'video',
  color text DEFAULT '#8B5CF6',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.social_content_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view categories" ON public.social_content_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage categories" ON public.social_content_categories FOR ALL TO authenticated USING (is_app_admin() OR has_permission(auth.uid(), 'manage_social'::text)) WITH CHECK (is_app_admin() OR has_permission(auth.uid(), 'manage_social'::text));

-- Insert default categories
INSERT INTO public.social_content_categories (name, icon, color) VALUES
  ('Reels', 'video', '#E11D48'),
  ('Stories', 'image', '#F59E0B'),
  ('Posts', 'image-plus', '#3B82F6'),
  ('Edições', 'scissors', '#8B5CF6');

-- Weekly goals
CREATE TABLE public.social_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.social_content_categories(id) ON DELETE CASCADE NOT NULL,
  week_start date NOT NULL,
  target_count integer NOT NULL DEFAULT 1,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(category_id, week_start)
);
ALTER TABLE public.social_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authorized users can view goals" ON public.social_goals FOR SELECT TO authenticated USING (is_app_admin() OR has_permission(auth.uid(), 'view_social'::text) OR has_permission(auth.uid(), 'manage_social'::text));
CREATE POLICY "Admins can manage goals" ON public.social_goals FOR ALL TO authenticated USING (is_app_admin() OR has_permission(auth.uid(), 'manage_social'::text)) WITH CHECK (is_app_admin() OR has_permission(auth.uid(), 'manage_social'::text));

-- Social tasks
CREATE TABLE public.social_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid REFERENCES public.social_goals(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.social_content_categories(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending',
  assigned_to uuid,
  due_date date,
  completed_at timestamptz,
  completed_by uuid,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.social_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authorized users can view tasks" ON public.social_tasks FOR SELECT TO authenticated USING (is_app_admin() OR has_permission(auth.uid(), 'view_social'::text) OR has_permission(auth.uid(), 'manage_social'::text) OR assigned_to = auth.uid());
CREATE POLICY "Admins can insert tasks" ON public.social_tasks FOR INSERT TO authenticated WITH CHECK (is_app_admin() OR has_permission(auth.uid(), 'manage_social'::text));
CREATE POLICY "Assigned or admins can update tasks" ON public.social_tasks FOR UPDATE TO authenticated USING (is_app_admin() OR has_permission(auth.uid(), 'manage_social'::text) OR assigned_to = auth.uid());
CREATE POLICY "Admins can delete tasks" ON public.social_tasks FOR DELETE TO authenticated USING (is_app_admin() OR has_permission(auth.uid(), 'manage_social'::text));

-- Social task proofs (images/files)
CREATE TABLE public.social_task_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES public.social_tasks(id) ON DELETE CASCADE NOT NULL,
  file_url text NOT NULL,
  file_name text,
  file_type text DEFAULT 'image',
  source text NOT NULL DEFAULT 'upload',
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.social_task_proofs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authorized users can view proofs" ON public.social_task_proofs FOR SELECT TO authenticated USING (is_app_admin() OR has_permission(auth.uid(), 'view_social'::text) OR has_permission(auth.uid(), 'manage_social'::text) OR uploaded_by = auth.uid());
CREATE POLICY "Assigned or admins can insert proofs" ON public.social_task_proofs FOR INSERT TO authenticated WITH CHECK (is_app_admin() OR has_permission(auth.uid(), 'manage_social'::text) OR uploaded_by = auth.uid());
CREATE POLICY "Admins can delete proofs" ON public.social_task_proofs FOR DELETE TO authenticated USING (is_app_admin() OR has_permission(auth.uid(), 'manage_social'::text));

-- Update has_permission function to include new permissions
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT CASE _permission
    WHEN 'manage_boards' THEN COALESCE((SELECT can_manage_boards FROM public.user_permissions WHERE user_id = _user_id), false)
    WHEN 'manage_columns' THEN COALESCE((SELECT can_manage_columns FROM public.user_permissions WHERE user_id = _user_id), false)
    WHEN 'manage_tasks' THEN COALESCE((SELECT can_manage_tasks FROM public.user_permissions WHERE user_id = _user_id), false)
    WHEN 'manage_recurring_tasks' THEN COALESCE((SELECT can_manage_recurring_tasks FROM public.user_permissions WHERE user_id = _user_id), false)
    WHEN 'manage_purchases' THEN COALESCE((SELECT can_manage_purchases FROM public.user_permissions WHERE user_id = _user_id), false)
    WHEN 'view_purchases' THEN COALESCE((SELECT can_view_purchases FROM public.user_permissions WHERE user_id = _user_id), false)
    WHEN 'be_buyer' THEN COALESCE((SELECT can_be_buyer FROM public.user_permissions WHERE user_id = _user_id), false)
    WHEN 'manage_fleet' THEN COALESCE((SELECT can_manage_fleet FROM public.user_permissions WHERE user_id = _user_id), false)
    WHEN 'view_fleet' THEN COALESCE((SELECT can_view_fleet FROM public.user_permissions WHERE user_id = _user_id), false)
    WHEN 'is_driver' THEN COALESCE((SELECT is_driver FROM public.user_permissions WHERE user_id = _user_id), false)
    WHEN 'manage_social' THEN COALESCE((SELECT can_manage_social FROM public.user_permissions WHERE user_id = _user_id), false)
    WHEN 'view_social' THEN COALESCE((SELECT can_view_social FROM public.user_permissions WHERE user_id = _user_id), false)
    ELSE false
  END;
$$;

-- Storage bucket for social proofs
INSERT INTO storage.buckets (id, name, public) VALUES ('social-proofs', 'social-proofs', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload proofs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'social-proofs');
CREATE POLICY "Anyone can view proofs" ON storage.objects FOR SELECT USING (bucket_id = 'social-proofs');
CREATE POLICY "Owners can delete proofs" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'social-proofs');
