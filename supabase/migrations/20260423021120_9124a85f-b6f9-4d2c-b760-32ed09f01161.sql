ALTER TABLE public.inventory_products
  ADD COLUMN IF NOT EXISTS product_type text NOT NULL DEFAULT 'single',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS weight numeric,
  ADD COLUMN IF NOT EXISTS weight_unit text NOT NULL DEFAULT 'lbs',
  ADD COLUMN IF NOT EXISTS length numeric,
  ADD COLUMN IF NOT EXISTS width numeric,
  ADD COLUMN IF NOT EXISTS height numeric,
  ADD COLUMN IF NOT EXISTS dimension_unit text NOT NULL DEFAULT 'in';

ALTER TABLE public.inventory_products
  DROP CONSTRAINT IF EXISTS inventory_products_product_type_check;
ALTER TABLE public.inventory_products
  ADD CONSTRAINT inventory_products_product_type_check
  CHECK (product_type IN ('single', 'variable'));

ALTER TABLE public.inventory_products
  DROP CONSTRAINT IF EXISTS inventory_products_status_check;
ALTER TABLE public.inventory_products
  ADD CONSTRAINT inventory_products_status_check
  CHECK (status IN ('draft', 'published'));

ALTER TABLE public.inventory_products
  DROP CONSTRAINT IF EXISTS inventory_products_weight_unit_check;
ALTER TABLE public.inventory_products
  ADD CONSTRAINT inventory_products_weight_unit_check
  CHECK (weight_unit IN ('lbs', 'kg'));

ALTER TABLE public.inventory_products
  DROP CONSTRAINT IF EXISTS inventory_products_dimension_unit_check;
ALTER TABLE public.inventory_products
  ADD CONSTRAINT inventory_products_dimension_unit_check
  CHECK (dimension_unit IN ('in', 'cm'));

-- Backfill existing rows: assume products already in inventory are published variable products
UPDATE public.inventory_products
SET status = 'published'
WHERE status = 'draft' AND is_active = true;

UPDATE public.inventory_products
SET product_type = 'variable'
WHERE product_type = 'single'
  AND variants IS NOT NULL
  AND jsonb_typeof(variants) = 'array'
  AND jsonb_array_length(variants) > 0;