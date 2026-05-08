-- Per-store product catalog
CREATE TABLE public.corporate_store_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL,
  product_id UUID NOT NULL,
  user_id UUID NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, product_id)
);

CREATE INDEX idx_csp_store ON public.corporate_store_products(store_id);
CREATE INDEX idx_csp_product ON public.corporate_store_products(product_id);

ALTER TABLE public.corporate_store_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view own store products"
  ON public.corporate_store_products FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Owners insert own store products"
  ON public.corporate_store_products FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners update own store products"
  ON public.corporate_store_products FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Owners delete own store products"
  ON public.corporate_store_products FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Public read so storefront shoppers can list a store's customizable products
CREATE POLICY "Public can view active store products"
  ON public.corporate_store_products FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE TRIGGER update_csp_updated_at
  BEFORE UPDATE ON public.corporate_store_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Public read on corporate_stores so shoppers can resolve a tenant_slug -> store branding
CREATE POLICY "Public can view corporate stores"
  ON public.corporate_stores FOR SELECT
  TO anon
  USING (status = 'active');

-- Attribute customizer sessions back to a store
ALTER TABLE public.customizer_sessions
  ADD COLUMN IF NOT EXISTS store_id UUID;

CREATE INDEX IF NOT EXISTS idx_sessions_store ON public.customizer_sessions(store_id);