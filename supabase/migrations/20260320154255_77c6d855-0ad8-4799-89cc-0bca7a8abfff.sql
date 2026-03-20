ALTER TABLE public.fleet_maintenances 
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'attention',
  ADD COLUMN IF NOT EXISTS scheduled_date date,
  ADD COLUMN IF NOT EXISTS scheduled_time time without time zone,
  ADD COLUMN IF NOT EXISTS assigned_to uuid,
  ADD COLUMN IF NOT EXISTS missing_tools text[];