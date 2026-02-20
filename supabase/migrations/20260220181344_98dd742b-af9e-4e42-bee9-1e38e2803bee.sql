
-- Allow all authenticated users to see profiles of buyers and admins (cross-team)
CREATE POLICY "Users can view buyer and admin profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_permissions up
    WHERE up.user_id = profiles.user_id AND up.can_be_buyer = true
  )
  OR
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = profiles.user_id AND ur.role = 'admin'
  )
);
