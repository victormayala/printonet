-- Allow Shopify-billed subscriptions (no Stripe IDs) and track source.
ALTER TABLE public.subscriptions
  ALTER COLUMN stripe_subscription_id DROP NOT NULL,
  ALTER COLUMN stripe_customer_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'stripe',
  ADD COLUMN IF NOT EXISTS shopify_charge_id text,
  ADD COLUMN IF NOT EXISTS shopify_shop_domain text;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_source_check
  CHECK (source IN ('stripe', 'shopify'));

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_shopify_charge_id_key
  ON public.subscriptions (shopify_charge_id)
  WHERE shopify_charge_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_shopify_shop
  ON public.subscriptions (shopify_shop_domain)
  WHERE shopify_shop_domain IS NOT NULL;