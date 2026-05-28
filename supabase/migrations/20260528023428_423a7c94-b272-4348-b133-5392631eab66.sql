UPDATE public.inventory_products
SET brand = supplier_source->>'brand'
WHERE brand IS NULL
  AND supplier_source IS NOT NULL
  AND supplier_source->>'brand' IS NOT NULL
  AND length(trim(supplier_source->>'brand')) > 0;