ALTER TABLE public.fleet_checkins ADD COLUMN tools_ok boolean DEFAULT NULL;
ALTER TABLE public.fleet_checkins ADD COLUMN tools_description text DEFAULT NULL;