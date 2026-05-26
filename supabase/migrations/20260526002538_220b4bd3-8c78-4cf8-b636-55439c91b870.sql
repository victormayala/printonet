ALTER TABLE public.corporate_stores
ADD COLUMN IF NOT EXISTS default_price_source text NOT NULL DEFAULT 'wholesale'
CHECK (default_price_source IN ('wholesale','msrp'));