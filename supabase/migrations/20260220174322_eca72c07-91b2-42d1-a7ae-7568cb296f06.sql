
-- Add new permission columns
ALTER TABLE public.user_permissions
  ADD COLUMN can_view_purchases boolean NOT NULL DEFAULT false,
  ADD COLUMN can_be_buyer boolean NOT NULL DEFAULT false;

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
    ELSE false
  END;
$$;
