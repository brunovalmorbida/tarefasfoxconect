
-- Make team_id nullable for non-team-specific logs (e.g., login)
ALTER TABLE public.activity_log ALTER COLUMN team_id DROP NOT NULL;
