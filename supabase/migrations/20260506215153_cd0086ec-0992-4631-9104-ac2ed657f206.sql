ALTER TABLE public.inventory_products
ADD COLUMN IF NOT EXISTS inventory jsonb NOT NULL DEFAULT '{"unlimited_stock": true, "stock": null}'::jsonb;