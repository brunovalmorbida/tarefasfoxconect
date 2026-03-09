
-- Add is_driver to user_permissions
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS is_driver boolean NOT NULL DEFAULT false;

-- Add driver_user_id to fleet_vehicles (links vehicle to a system user who is a driver)
ALTER TABLE public.fleet_vehicles ADD COLUMN IF NOT EXISTS driver_user_id uuid;

-- Add driver_user_id to fleet_checkins (links check-in to a system user)
ALTER TABLE public.fleet_checkins ADD COLUMN IF NOT EXISTS driver_user_id uuid;

-- Update has_permission function to include is_driver
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
    ELSE false
  END;
$$;
