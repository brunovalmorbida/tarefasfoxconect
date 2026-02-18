
-- Create urgency enum
CREATE TYPE public.purchase_urgency AS ENUM ('low', 'medium', 'high', 'urgent');

-- Create status enum
CREATE TYPE public.purchase_status AS ENUM ('pending', 'purchased', 'received');

-- Create category enum
CREATE TYPE public.purchase_category AS ENUM ('office', 'cleaning', 'technology', 'maintenance', 'food', 'other');

-- Create purchase_requests table
CREATE TABLE public.purchase_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  category public.purchase_category NOT NULL DEFAULT 'other',
  urgency public.purchase_urgency NOT NULL DEFAULT 'medium',
  estimated_value NUMERIC(10,2),
  status public.purchase_status NOT NULL DEFAULT 'pending',
  requested_by UUID NOT NULL,
  buyer_id UUID,
  purchased_at TIMESTAMP WITH TIME ZONE,
  purchase_notes TEXT,
  actual_value NUMERIC(10,2),
  received_at TIMESTAMP WITH TIME ZONE,
  received_by UUID,
  receive_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view
CREATE POLICY "Authenticated users can view purchases"
ON public.purchase_requests FOR SELECT
TO authenticated
USING (true);

-- Any authenticated user can create a request
CREATE POLICY "Authenticated users can create purchases"
ON public.purchase_requests FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = requested_by);

-- Admins and designated buyer can update
CREATE POLICY "Authorized users can update purchases"
ON public.purchase_requests FOR UPDATE
TO authenticated
USING (
  is_app_admin() 
  OR auth.uid() = requested_by 
  OR auth.uid() = buyer_id
);

-- Only admins can delete
CREATE POLICY "Admins can delete purchases"
ON public.purchase_requests FOR DELETE
TO authenticated
USING (is_app_admin());

-- Trigger for updated_at
CREATE TRIGGER update_purchase_requests_updated_at
BEFORE UPDATE ON public.purchase_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
