
-- Add optional scheduled_time column to recurring_tasks
ALTER TABLE public.recurring_tasks ADD COLUMN scheduled_time TIME WITHOUT TIME ZONE DEFAULT NULL;

-- Add a comment for clarity
COMMENT ON COLUMN public.recurring_tasks.scheduled_time IS 'Optional time when the task should be completed. Used for overdue notifications.';
