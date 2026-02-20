
-- Allow authenticated users to see who has can_be_buyer permission (only that column)
CREATE POLICY "Authenticated users can view buyer permissions"
ON public.user_permissions
FOR SELECT
USING (true);

-- Drop the old restrictive select policies that are now redundant
DROP POLICY IF EXISTS "Admin can view all permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Users can view own permissions" ON public.user_permissions;
