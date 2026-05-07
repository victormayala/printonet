
ALTER TABLE public.corporate_stores
  ADD COLUMN IF NOT EXISTS store_type text NOT NULL DEFAULT 'retail';

ALTER TABLE public.corporate_stores
  DROP CONSTRAINT IF EXISTS corporate_stores_store_type_check;

ALTER TABLE public.corporate_stores
  ADD CONSTRAINT corporate_stores_store_type_check
  CHECK (store_type IN ('corporate','retail'));

CREATE TABLE IF NOT EXISTS public.corporate_store_product_logos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  store_id uuid NOT NULL,
  product_id uuid NOT NULL,
  view text NOT NULL CHECK (view IN ('front','back','side1','side2')),
  logo_url text NOT NULL,
  position jsonb NOT NULL DEFAULT '{"x_pct":0.5,"y_pct":0.5,"width_pct":0.25,"rotation_deg":0}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, product_id, view)
);

ALTER TABLE public.corporate_store_product_logos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own corp logos"
  ON public.corporate_store_product_logos FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users insert own corp logos"
  ON public.corporate_store_product_logos FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own corp logos"
  ON public.corporate_store_product_logos FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users delete own corp logos"
  ON public.corporate_store_product_logos FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_corp_logos_updated_at
  BEFORE UPDATE ON public.corporate_store_product_logos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
