
-- Add can_manage_purchases permission
ALTER TABLE public.user_permissions ADD COLUMN can_manage_purchases boolean NOT NULL DEFAULT false;

-- Update RLS policies for product_catalog to allow users with purchase permission
DROP POLICY IF EXISTS "Admins can insert products" ON public.product_catalog;
CREATE POLICY "Authorized users can insert products" ON public.product_catalog
FOR INSERT WITH CHECK (is_app_admin() OR has_permission(auth.uid(), 'manage_purchases'));

DROP POLICY IF EXISTS "Admins can update products" ON public.product_catalog;
CREATE POLICY "Authorized users can update products" ON public.product_catalog
FOR UPDATE USING (is_app_admin() OR has_permission(auth.uid(), 'manage_purchases'));

DROP POLICY IF EXISTS "Admins can delete products" ON public.product_catalog;
CREATE POLICY "Authorized users can delete products" ON public.product_catalog
FOR DELETE USING (is_app_admin() OR has_permission(auth.uid(), 'manage_purchases'));

-- Update RLS policies for product_categories
DROP POLICY IF EXISTS "Admins can insert categories" ON public.product_categories;
CREATE POLICY "Authorized users can insert categories" ON public.product_categories
FOR INSERT WITH CHECK (is_app_admin() OR has_permission(auth.uid(), 'manage_purchases'));

DROP POLICY IF EXISTS "Admins can update categories" ON public.product_categories;
CREATE POLICY "Authorized users can update categories" ON public.product_categories
FOR UPDATE USING (is_app_admin() OR has_permission(auth.uid(), 'manage_purchases'));

DROP POLICY IF EXISTS "Admins can delete categories" ON public.product_categories;
CREATE POLICY "Authorized users can delete categories" ON public.product_categories
FOR DELETE USING (is_app_admin() OR has_permission(auth.uid(), 'manage_purchases'));

-- Update has_permission function to support the new permission
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE _permission
    WHEN 'manage_boards' THEN COALESCE((SELECT can_manage_boards FROM public.user_permissions WHERE user_id = _user_id), false)
    WHEN 'manage_columns' THEN COALESCE((SELECT can_manage_columns FROM public.user_permissions WHERE user_id = _user_id), false)
    WHEN 'manage_tasks' THEN COALESCE((SELECT can_manage_tasks FROM public.user_permissions WHERE user_id = _user_id), false)
    WHEN 'manage_recurring_tasks' THEN COALESCE((SELECT can_manage_recurring_tasks FROM public.user_permissions WHERE user_id = _user_id), false)
    WHEN 'manage_purchases' THEN COALESCE((SELECT can_manage_purchases FROM public.user_permissions WHERE user_id = _user_id), false)
    ELSE false
  END;
$$;
