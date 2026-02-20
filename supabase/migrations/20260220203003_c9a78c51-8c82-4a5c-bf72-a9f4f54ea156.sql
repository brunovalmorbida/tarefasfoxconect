-- Add scheduled_time column to tasks table
ALTER TABLE public.tasks ADD COLUMN scheduled_time time without time zone NULL;