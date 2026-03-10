
-- Add pipeline_status, content_strategy_type, and post_link to social_tasks
ALTER TABLE public.social_tasks 
  ADD COLUMN IF NOT EXISTS pipeline_status text NOT NULL DEFAULT 'idea',
  ADD COLUMN IF NOT EXISTS content_strategy_type text NULL,
  ADD COLUMN IF NOT EXISTS post_link text NULL;

-- Create table for auto-generation settings (fixed weekly goals)
CREATE TABLE IF NOT EXISTS public.social_auto_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.social_content_categories(id) ON DELETE CASCADE,
  target_count integer NOT NULL DEFAULT 0,
  auto_create boolean NOT NULL DEFAULT false,
  default_assigned_to uuid NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(category_id)
);

ALTER TABLE public.social_auto_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage auto goals" ON public.social_auto_goals
  FOR ALL TO authenticated
  USING (is_app_admin() OR has_permission(auth.uid(), 'manage_social'))
  WITH CHECK (is_app_admin() OR has_permission(auth.uid(), 'manage_social'));

CREATE POLICY "Authorized users can view auto goals" ON public.social_auto_goals
  FOR SELECT TO authenticated
  USING (is_app_admin() OR has_permission(auth.uid(), 'view_social') OR has_permission(auth.uid(), 'manage_social'));
