CREATE TABLE public.tech_column_order (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  city text NOT NULL UNIQUE,
  technicians text[] NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tech_column_order TO authenticated;
GRANT ALL ON public.tech_column_order TO service_role;

ALTER TABLE public.tech_column_order ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view column order"
ON public.tech_column_order FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert column order"
ON public.tech_column_order FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update column order"
ON public.tech_column_order FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_tech_column_order_updated_at
BEFORE UPDATE ON public.tech_column_order
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();