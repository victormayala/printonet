-- 1. Manual tax fields on corporate_stores
ALTER TABLE public.corporate_stores
  ADD COLUMN IF NOT EXISTS tax_rate_bps integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_inclusive boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_label text NOT NULL DEFAULT 'Tax';

ALTER TABLE public.corporate_stores
  DROP CONSTRAINT IF EXISTS corporate_stores_tax_rate_bps_range;
ALTER TABLE public.corporate_stores
  ADD CONSTRAINT corporate_stores_tax_rate_bps_range
  CHECK (tax_rate_bps >= 0 AND tax_rate_bps <= 10000);

-- 2. Shipping zones table
CREATE TABLE IF NOT EXISTS public.corporate_store_shipping_zones (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES public.corporate_stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  countries text[] NOT NULL DEFAULT '{}',
  rate_amount integer NOT NULL DEFAULT 0 CHECK (rate_amount >= 0),
  free_threshold integer NULL CHECK (free_threshold IS NULL OR free_threshold >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_corp_store_shipping_zones_store_sort
  ON public.corporate_store_shipping_zones (store_id, sort_order);

ALTER TABLE public.corporate_store_shipping_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners view own shipping zones" ON public.corporate_store_shipping_zones;
CREATE POLICY "Owners view own shipping zones"
  ON public.corporate_store_shipping_zones
  FOR SELECT TO authenticated
  USING (store_id IN (SELECT id FROM public.corporate_stores WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Owners insert own shipping zones" ON public.corporate_store_shipping_zones;
CREATE POLICY "Owners insert own shipping zones"
  ON public.corporate_store_shipping_zones
  FOR INSERT TO authenticated
  WITH CHECK (store_id IN (SELECT id FROM public.corporate_stores WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Owners update own shipping zones" ON public.corporate_store_shipping_zones;
CREATE POLICY "Owners update own shipping zones"
  ON public.corporate_store_shipping_zones
  FOR UPDATE TO authenticated
  USING (store_id IN (SELECT id FROM public.corporate_stores WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Owners delete own shipping zones" ON public.corporate_store_shipping_zones;
CREATE POLICY "Owners delete own shipping zones"
  ON public.corporate_store_shipping_zones
  FOR DELETE TO authenticated
  USING (store_id IN (SELECT id FROM public.corporate_stores WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Public can view shipping zones for active stores" ON public.corporate_store_shipping_zones;
CREATE POLICY "Public can view shipping zones for active stores"
  ON public.corporate_store_shipping_zones
  FOR SELECT TO anon, authenticated
  USING (store_id IN (SELECT id FROM public.corporate_stores WHERE status = 'active'));

DROP TRIGGER IF EXISTS trg_corp_store_shipping_zones_updated_at ON public.corporate_store_shipping_zones;
CREATE TRIGGER trg_corp_store_shipping_zones_updated_at
  BEFORE UPDATE ON public.corporate_store_shipping_zones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();