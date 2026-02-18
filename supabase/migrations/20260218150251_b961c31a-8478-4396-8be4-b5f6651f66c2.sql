
-- Drop existing restrictive policies on activity_log
DROP POLICY IF EXISTS "Team members can log activity" ON public.activity_log;
DROP POLICY IF EXISTS "Team members can view activity" ON public.activity_log;

-- Admins can view all activity
CREATE POLICY "Admins can view all activity"
ON public.activity_log FOR SELECT
USING (is_app_admin());

-- Any authenticated user can insert activity (system logging)
CREATE POLICY "Authenticated users can log activity"
ON public.activity_log FOR INSERT
WITH CHECK (auth.uid() = user_id);
