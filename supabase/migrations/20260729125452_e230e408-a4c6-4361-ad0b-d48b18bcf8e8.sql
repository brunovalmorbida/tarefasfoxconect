CREATE TABLE public.tech_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL,
  client_name text NOT NULL,
  phone text,
  scheduled_date date NOT NULL,
  scheduled_time time,
  neighborhood text,
  os_number text,
  service_type text,
  technician text,
  notes text,
  position integer NOT NULL DEFAULT 0,
  forwarded_at timestamptz,
  forwarded_by uuid,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tech_appointments TO authenticated;
GRANT ALL ON public.tech_appointments TO service_role;

ALTER TABLE public.tech_appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view appointments" ON public.tech_appointments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can create appointments" ON public.tech_appointments FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Authenticated can update appointments" ON public.tech_appointments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete appointments" ON public.tech_appointments FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_tech_appointments_city_date ON public.tech_appointments (city, scheduled_date);

CREATE TRIGGER update_tech_appointments_updated_at
BEFORE UPDATE ON public.tech_appointments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();