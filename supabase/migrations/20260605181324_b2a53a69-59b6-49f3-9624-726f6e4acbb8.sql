
-- 1. Restrict user_permissions SELECT
DROP POLICY IF EXISTS "Authenticated users can view buyer permissions" ON public.user_permissions;
CREATE POLICY "Users view own permissions or admin views all"
  ON public.user_permissions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_app_admin());

-- 2. Restrict user_roles SELECT
DROP POLICY IF EXISTS "Authenticated users can view roles" ON public.user_roles;
CREATE POLICY "Users view own roles or admin views all"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_app_admin());

-- 3. Restrict product_catalog and product_categories SELECT to authenticated
DROP POLICY IF EXISTS "Authenticated users can view products" ON public.product_catalog;
CREATE POLICY "Authenticated users can view products"
  ON public.product_catalog FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can view categories" ON public.product_categories;
CREATE POLICY "Authenticated users can view categories"
  ON public.product_categories FOR SELECT TO authenticated USING (true);

-- 4. Tighten fleet-documents INSERT to require fleet permission
DROP POLICY IF EXISTS "Authenticated users can upload fleet docs" ON storage.objects;
CREATE POLICY "Authorized users can upload fleet docs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'fleet-documents'
    AND (public.is_app_admin() OR public.has_permission(auth.uid(), 'manage_fleet'))
  );

-- 5. Tighten fleet-documents SELECT to require fleet view permission
DROP POLICY IF EXISTS "Anyone can view fleet docs" ON storage.objects;
CREATE POLICY "Authorized users can view fleet docs"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'fleet-documents'
    AND (public.is_app_admin() OR public.has_permission(auth.uid(), 'manage_fleet') OR public.has_permission(auth.uid(), 'view_fleet'))
  );

-- 6. Tighten social-proofs DELETE to require ownership or manage_social permission
DROP POLICY IF EXISTS "Owners can delete proofs" ON storage.objects;
CREATE POLICY "Authorized users can delete proofs"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'social-proofs'
    AND (owner = auth.uid() OR public.is_app_admin() OR public.has_permission(auth.uid(), 'manage_social'))
  );

-- 7. Tighten social-proofs INSERT to require social permission
DROP POLICY IF EXISTS "Authenticated users can upload proofs" ON storage.objects;
CREATE POLICY "Authorized users can upload proofs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'social-proofs'
    AND (public.is_app_admin() OR public.has_permission(auth.uid(), 'manage_social') OR public.has_permission(auth.uid(), 'view_social'))
  );

-- 8. Revoke EXECUTE from anon on SECURITY DEFINER helper functions
REVOKE EXECUTE ON FUNCTION public.is_app_admin() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_team_member(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_team_admin(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_team_visibility(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_team_id_from_board(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_team_id_from_column(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_team_id_from_task(uuid) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.is_app_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_team_visibility(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_id_from_board(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_id_from_column(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_id_from_task(uuid) TO authenticated;
