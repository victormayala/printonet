ALTER TABLE public.corporate_stores DROP CONSTRAINT IF EXISTS corporate_stores_store_type_check;
ALTER TABLE public.corporate_stores ADD CONSTRAINT corporate_stores_store_type_check
  CHECK (store_type = ANY (ARRAY['corporate'::text, 'retail'::text, 'website'::text, 'shopify'::text, 'woocommerce'::text]));