CREATE TABLE public.shopify_compliance_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic TEXT NOT NULL,
  shop_domain TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.shopify_compliance_log TO service_role;

ALTER TABLE public.shopify_compliance_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages compliance log"
ON public.shopify_compliance_log
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE INDEX idx_shopify_compliance_log_shop ON public.shopify_compliance_log(shop_domain, created_at DESC);