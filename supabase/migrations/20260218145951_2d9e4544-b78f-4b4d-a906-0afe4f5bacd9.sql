
-- Table to store Z-API integration settings
CREATE TABLE public.zapi_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id text NOT NULL,
  token text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.zapi_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view zapi config"
ON public.zapi_config FOR SELECT
USING (is_app_admin());

CREATE POLICY "Only admins can insert zapi config"
ON public.zapi_config FOR INSERT
WITH CHECK (is_app_admin());

CREATE POLICY "Only admins can update zapi config"
ON public.zapi_config FOR UPDATE
USING (is_app_admin());

CREATE POLICY "Only admins can delete zapi config"
ON public.zapi_config FOR DELETE
USING (is_app_admin());

CREATE TRIGGER update_zapi_config_updated_at
BEFORE UPDATE ON public.zapi_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
