ALTER TABLE public.tech_appointments ALTER COLUMN scheduled_date DROP NOT NULL;
ALTER TABLE public.tech_appointments ADD COLUMN IF NOT EXISTS weekday smallint;