
CREATE OR REPLACE FUNCTION public.get_buyer_profiles()
RETURNS TABLE(user_id uuid, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.name
  FROM public.profiles p
  WHERE p.user_id IN (
    SELECT up.user_id FROM public.user_permissions up WHERE up.can_be_buyer = true
    UNION
    SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_buyer_profiles() TO authenticated;
