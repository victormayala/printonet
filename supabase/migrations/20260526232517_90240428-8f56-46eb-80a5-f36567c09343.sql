
CREATE TABLE public.corporate_store_volume_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  min_qty integer NOT NULL CHECK (min_qty >= 1),
  max_qty integer CHECK (max_qty IS NULL OR max_qty >= min_qty),
  discount_pct numeric(5,2) NOT NULL CHECK (discount_pct >= 0 AND discount_pct <= 100),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_csvd_store ON public.corporate_store_volume_discounts(store_id, sort_order);

GRANT SELECT ON public.corporate_store_volume_discounts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.corporate_store_volume_discounts TO authenticated;
GRANT ALL ON public.corporate_store_volume_discounts TO service_role;

ALTER TABLE public.corporate_store_volume_discounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public view discounts for active stores"
ON public.corporate_store_volume_discounts FOR SELECT
TO anon, authenticated
USING (store_id IN (SELECT id FROM public.corporate_stores WHERE status = 'active'));

CREATE POLICY "Owners view own discounts"
ON public.corporate_store_volume_discounts FOR SELECT
TO authenticated
USING (store_id IN (SELECT id FROM public.corporate_stores WHERE user_id = auth.uid()));

CREATE POLICY "Owners insert own discounts"
ON public.corporate_store_volume_discounts FOR INSERT
TO authenticated
WITH CHECK (store_id IN (SELECT id FROM public.corporate_stores WHERE user_id = auth.uid()));

CREATE POLICY "Owners update own discounts"
ON public.corporate_store_volume_discounts FOR UPDATE
TO authenticated
USING (store_id IN (SELECT id FROM public.corporate_stores WHERE user_id = auth.uid()));

CREATE POLICY "Owners delete own discounts"
ON public.corporate_store_volume_discounts FOR DELETE
TO authenticated
USING (store_id IN (SELECT id FROM public.corporate_stores WHERE user_id = auth.uid()));

CREATE TRIGGER trg_csvd_updated_at
BEFORE UPDATE ON public.corporate_store_volume_discounts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
