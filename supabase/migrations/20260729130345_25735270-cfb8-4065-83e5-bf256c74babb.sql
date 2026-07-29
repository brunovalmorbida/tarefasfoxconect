-- 1) activity_log: allow users to read their own entries
DROP POLICY IF EXISTS "Users can view own activity" ON public.activity_log;
CREATE POLICY "Users can view own activity"
ON public.activity_log FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- 2) purchase_lists / purchase_list_items: restrict SELECT to involved users
DROP POLICY IF EXISTS "Authenticated users can view purchase lists" ON public.purchase_lists;
DROP POLICY IF EXISTS "Anyone authenticated can view purchase lists" ON public.purchase_lists;
DROP POLICY IF EXISTS "Users can view purchase lists" ON public.purchase_lists;
DROP POLICY IF EXISTS "purchase_lists_select" ON public.purchase_lists;

CREATE POLICY "Involved users can view purchase lists"
ON public.purchase_lists FOR SELECT TO authenticated
USING (
  auth.uid() = requested_by
  OR auth.uid() = buyer_id
  OR auth.uid() = received_by
  OR public.is_app_admin()
  OR public.has_permission(auth.uid(), 'view_purchases')
  OR public.has_permission(auth.uid(), 'manage_purchases')
);

DROP POLICY IF EXISTS "Authenticated users can view purchase list items" ON public.purchase_list_items;
DROP POLICY IF EXISTS "Anyone authenticated can view purchase list items" ON public.purchase_list_items;
DROP POLICY IF EXISTS "Users can view purchase list items" ON public.purchase_list_items;
DROP POLICY IF EXISTS "purchase_list_items_select" ON public.purchase_list_items;

CREATE POLICY "Involved users can view purchase list items"
ON public.purchase_list_items FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.purchase_lists pl
    WHERE pl.id = purchase_list_items.list_id
      AND (
        auth.uid() = pl.requested_by
        OR auth.uid() = pl.buyer_id
        OR auth.uid() = pl.received_by
        OR public.is_app_admin()
        OR public.has_permission(auth.uid(), 'view_purchases')
        OR public.has_permission(auth.uid(), 'manage_purchases')
      )
  )
);

-- 3) Revoke anon (and non-callable) EXECUTE on SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.get_buyer_profiles() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_buyer_profiles() TO authenticated;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.handle_new_team() FROM anon, authenticated, public;