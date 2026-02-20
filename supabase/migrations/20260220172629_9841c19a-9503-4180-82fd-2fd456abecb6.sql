
-- Table to store purchase notification settings per stage
CREATE TABLE public.purchase_notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage text NOT NULL UNIQUE, -- 'created', 'purchased', 'received', 'pending_purchase_reminder', 'pending_receipt_reminder'
  notify_user_ids uuid[] NOT NULL DEFAULT '{}',
  reminder_days integer DEFAULT NULL, -- only for reminder stages
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.purchase_notification_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can manage these settings
CREATE POLICY "Admins can view purchase notification settings"
ON public.purchase_notification_settings FOR SELECT
USING (is_app_admin() OR has_permission(auth.uid(), 'manage_purchases'));

CREATE POLICY "Admins can insert purchase notification settings"
ON public.purchase_notification_settings FOR INSERT
WITH CHECK (is_app_admin());

CREATE POLICY "Admins can update purchase notification settings"
ON public.purchase_notification_settings FOR UPDATE
USING (is_app_admin());

CREATE POLICY "Admins can delete purchase notification settings"
ON public.purchase_notification_settings FOR DELETE
USING (is_app_admin());

-- Seed default rows for each stage
INSERT INTO public.purchase_notification_settings (stage, notify_user_ids, reminder_days, is_active) VALUES
  ('created', '{}', NULL, true),
  ('purchased', '{}', NULL, true),
  ('received', '{}', NULL, true),
  ('pending_purchase_reminder', '{}', 7, true),
  ('pending_receipt_reminder', '{}', 15, true);

-- Trigger for updated_at
CREATE TRIGGER update_purchase_notification_settings_updated_at
BEFORE UPDATE ON public.purchase_notification_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
