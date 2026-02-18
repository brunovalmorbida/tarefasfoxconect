
-- Add task-level frequency columns to recurring_tasks
ALTER TABLE public.recurring_tasks 
  ADD COLUMN IF NOT EXISTS weekday integer,
  ADD COLUMN IF NOT EXISTS month_day integer;

-- Update frequency column to support new types
-- existing values are 'daily' which is fine
COMMENT ON COLUMN public.recurring_tasks.frequency IS 'daily, weekly, weekday, monthly';
COMMENT ON COLUMN public.recurring_tasks.weekday IS '0=Monday..6=Sunday, used when frequency=weekday';
COMMENT ON COLUMN public.recurring_tasks.month_day IS '1-31, used when frequency=monthly';
