ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_order_items_metadata ON public.order_items USING GIN (metadata);