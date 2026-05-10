ALTER TABLE public.corporate_stores
  ADD COLUMN IF NOT EXISTS stripe_account_id text,
  ADD COLUMN IF NOT EXISTS stripe_charges_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_payouts_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_details_submitted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_connected_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS corporate_stores_stripe_account_uidx
  ON public.corporate_stores (stripe_account_id)
  WHERE stripe_account_id IS NOT NULL;