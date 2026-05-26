ALTER TABLE public.inventory_products
ADD COLUMN IF NOT EXISTS price_source text NOT NULL DEFAULT 'wholesale'
CHECK (price_source IN ('wholesale', 'msrp'));