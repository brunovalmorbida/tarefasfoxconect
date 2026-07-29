
-- Helper: quem pode acessar o módulo de agendamentos técnicos
CREATE OR REPLACE FUNCTION public.can_access_tech_appointments()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_app_admin() OR public.has_permission(auth.uid(), 'manage_tasks');
$$;

REVOKE ALL ON FUNCTION public.can_access_tech_appointments() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_tech_appointments() TO authenticated, service_role;

-- tech_appointments
DROP POLICY IF EXISTS "Authenticated can view appointments" ON public.tech_appointments;
DROP POLICY IF EXISTS "Authenticated can update appointments" ON public.tech_appointments;
DROP POLICY IF EXISTS "Authenticated can delete appointments" ON public.tech_appointments;
DROP POLICY IF EXISTS "Authenticated can create appointments" ON public.tech_appointments;

CREATE POLICY "Tech users can view appointments" ON public.tech_appointments
FOR SELECT TO authenticated USING (public.can_access_tech_appointments());

CREATE POLICY "Tech users can create appointments" ON public.tech_appointments
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by AND public.can_access_tech_appointments());

CREATE POLICY "Tech users can update appointments" ON public.tech_appointments
FOR UPDATE TO authenticated
USING (public.can_access_tech_appointments())
WITH CHECK (public.can_access_tech_appointments());

CREATE POLICY "Tech users can delete appointments" ON public.tech_appointments
FOR DELETE TO authenticated USING (public.can_access_tech_appointments());

-- tech_column_order
DROP POLICY IF EXISTS "Authenticated can view column order" ON public.tech_column_order;
DROP POLICY IF EXISTS "Authenticated can insert column order" ON public.tech_column_order;
DROP POLICY IF EXISTS "Authenticated can update column order" ON public.tech_column_order;

CREATE POLICY "Tech users can view column order" ON public.tech_column_order
FOR SELECT TO authenticated USING (public.can_access_tech_appointments());

CREATE POLICY "Tech users can insert column order" ON public.tech_column_order
FOR INSERT TO authenticated WITH CHECK (public.can_access_tech_appointments());

CREATE POLICY "Tech users can update column order" ON public.tech_column_order
FOR UPDATE TO authenticated
USING (public.can_access_tech_appointments())
WITH CHECK (public.can_access_tech_appointments());
