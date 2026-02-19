ALTER TABLE public.purchase_list_items 
  ALTER COLUMN category TYPE text USING category::text,
  ALTER COLUMN category SET DEFAULT 'other';