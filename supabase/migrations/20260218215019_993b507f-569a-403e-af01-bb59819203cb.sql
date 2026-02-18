ALTER TABLE public.recurring_tasks DROP CONSTRAINT recurring_tasks_frequency_check;

ALTER TABLE public.recurring_tasks ADD CONSTRAINT recurring_tasks_frequency_check 
  CHECK (frequency = ANY (ARRAY['daily'::text, 'weekly'::text, 'weekday'::text, 'monthly'::text]));
