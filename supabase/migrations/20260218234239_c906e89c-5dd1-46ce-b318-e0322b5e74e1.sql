
-- Create purchase_lists table (the parent list)
CREATE TABLE public.purchase_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'Lista de Compras',
  status public.purchase_status NOT NULL DEFAULT 'pending',
  urgency public.purchase_urgency NOT NULL DEFAULT 'medium',
  requested_by UUID NOT NULL,
  buyer_id UUID,
  purchased_at TIMESTAMP WITH TIME ZONE,
  purchase_notes TEXT,
  received_at TIMESTAMP WITH TIME ZONE,
  received_by UUID,
  receive_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create purchase_list_items table
CREATE TABLE public.purchase_list_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id UUID NOT NULL REFERENCES public.purchase_lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  category public.purchase_category NOT NULL DEFAULT 'other',
  estimated_value NUMERIC(10,2),
  actual_value NUMERIC(10,2),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.purchase_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_list_items ENABLE ROW LEVEL SECURITY;

-- purchase_lists policies
CREATE POLICY "Authenticated users can view lists" ON public.purchase_lists FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create lists" ON public.purchase_lists FOR INSERT TO authenticated WITH CHECK (auth.uid() = requested_by);
CREATE POLICY "Authorized users can update lists" ON public.purchase_lists FOR UPDATE TO authenticated USING (is_app_admin() OR auth.uid() = requested_by OR auth.uid() = buyer_id);
CREATE POLICY "Admins can delete lists" ON public.purchase_lists FOR DELETE TO authenticated USING (is_app_admin());

-- purchase_list_items policies
CREATE POLICY "Authenticated users can view items" ON public.purchase_list_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert items" ON public.purchase_list_items FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.purchase_lists WHERE id = list_id AND requested_by = auth.uid()));
CREATE POLICY "Authorized users can update items" ON public.purchase_list_items FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.purchase_lists pl WHERE pl.id = list_id AND (is_app_admin() OR pl.requested_by = auth.uid() OR pl.buyer_id = auth.uid())));
CREATE POLICY "Admins can delete items" ON public.purchase_list_items FOR DELETE TO authenticated USING (is_app_admin() OR EXISTS (SELECT 1 FROM public.purchase_lists pl WHERE pl.id = list_id AND pl.requested_by = auth.uid()));

-- Triggers
CREATE TRIGGER update_purchase_lists_updated_at BEFORE UPDATE ON public.purchase_lists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Drop old table
DROP TABLE IF EXISTS public.purchase_requests;
DROP TYPE IF EXISTS public.purchase_status CASCADE;
DROP TYPE IF EXISTS public.purchase_urgency CASCADE;
DROP TYPE IF EXISTS public.purchase_category CASCADE;

-- Recreate enums (needed since we dropped cascade)
CREATE TYPE public.purchase_status AS ENUM ('pending', 'purchased', 'received');
CREATE TYPE public.purchase_urgency AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE public.purchase_category AS ENUM ('office', 'cleaning', 'technology', 'maintenance', 'food', 'other');
