-- Table to store Google Drive config (tokens, folder IDs)
CREATE TABLE public.google_drive_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token text,
  refresh_token text,
  token_expires_at timestamp with time zone,
  root_folder_id text,
  folder_mapping jsonb DEFAULT '{}'::jsonb,
  is_connected boolean DEFAULT false,
  connected_by uuid,
  connected_email text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.google_drive_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view drive config"
  ON public.google_drive_config FOR SELECT TO authenticated
  USING (is_app_admin());

CREATE POLICY "Only admins can insert drive config"
  ON public.google_drive_config FOR INSERT TO authenticated
  WITH CHECK (is_app_admin());

CREATE POLICY "Only admins can update drive config"
  ON public.google_drive_config FOR UPDATE TO authenticated
  USING (is_app_admin());

CREATE POLICY "Only admins can delete drive config"
  ON public.google_drive_config FOR DELETE TO authenticated
  USING (is_app_admin());

-- Add drive_folder_url to social_tasks for linking Drive files
ALTER TABLE public.social_tasks ADD COLUMN IF NOT EXISTS drive_folder_url text;