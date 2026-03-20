ALTER TABLE public.fleet_maintenances 
  ADD COLUMN IF NOT EXISTS actual_cost numeric,
  ADD COLUMN IF NOT EXISTS payment_date date,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS financial_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS receipt_url text,
  ADD COLUMN IF NOT EXISTS receipt_file_name text;