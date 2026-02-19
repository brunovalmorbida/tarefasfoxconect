
ALTER TABLE public.recurring_tasks ADD COLUMN position integer NOT NULL DEFAULT 0;

-- Set initial positions based on current title order
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY board_id ORDER BY title) - 1 AS rn
  FROM public.recurring_tasks
)
UPDATE public.recurring_tasks SET position = ordered.rn FROM ordered WHERE recurring_tasks.id = ordered.id;
