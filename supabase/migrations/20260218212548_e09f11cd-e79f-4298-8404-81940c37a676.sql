
-- Fix: Replace the overly permissive notifications INSERT policy
-- Only service_role (edge functions) should create notifications, not regular users
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;

CREATE POLICY "Only service role can create notifications"
ON public.notifications
FOR INSERT
TO service_role
WITH CHECK (true);
