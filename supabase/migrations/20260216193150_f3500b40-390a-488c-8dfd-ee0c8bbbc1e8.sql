
-- Allow admin to view ALL profiles (not just team members)
CREATE POLICY "Admin can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.is_app_admin());

-- Allow admin to view all user roles
CREATE POLICY "Admin can view all roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.is_app_admin());
