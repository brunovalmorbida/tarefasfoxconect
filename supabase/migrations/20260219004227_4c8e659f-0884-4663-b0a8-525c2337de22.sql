
-- Custom product categories
CREATE TABLE public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view categories" ON public.product_categories FOR SELECT USING (true);
CREATE POLICY "Admins can insert categories" ON public.product_categories FOR INSERT WITH CHECK (is_app_admin());
CREATE POLICY "Admins can update categories" ON public.product_categories FOR UPDATE USING (is_app_admin());
CREATE POLICY "Admins can delete categories" ON public.product_categories FOR DELETE USING (is_app_admin());

-- Product catalog
CREATE TABLE public.product_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL,
  default_estimated_value numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view products" ON public.product_catalog FOR SELECT USING (true);
CREATE POLICY "Admins can insert products" ON public.product_catalog FOR INSERT WITH CHECK (is_app_admin());
CREATE POLICY "Admins can update products" ON public.product_catalog FOR UPDATE USING (is_app_admin());
CREATE POLICY "Admins can delete products" ON public.product_catalog FOR DELETE USING (is_app_admin());

CREATE TRIGGER update_product_catalog_updated_at
  BEFORE UPDATE ON public.product_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
