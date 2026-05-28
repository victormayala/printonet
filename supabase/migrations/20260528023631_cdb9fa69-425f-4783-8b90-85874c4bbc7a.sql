UPDATE public.inventory_products
SET decoration_methods = ARRAY['dtg','dtf','embroidery','screen_printing','sublimation']::text[]
WHERE decoration_methods IS NULL
   OR array_length(decoration_methods, 1) IS NULL;

ALTER TABLE public.inventory_products
  ALTER COLUMN decoration_methods SET DEFAULT ARRAY['dtg','dtf','embroidery','screen_printing','sublimation']::text[];