
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS tracking_number text,
  ADD COLUMN IF NOT EXISTS carrier text,
  ADD COLUMN IF NOT EXISTS shipped_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS refunded_amount integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_refund_id text;

CREATE INDEX IF NOT EXISTS orders_store_created_idx
  ON public.orders (store_id, created_at DESC);
