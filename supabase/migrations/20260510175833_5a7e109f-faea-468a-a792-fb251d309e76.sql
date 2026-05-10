ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS store_id uuid,
  ADD COLUMN IF NOT EXISTS stripe_account_id text,
  ADD COLUMN IF NOT EXISTS application_fee_amount integer;

CREATE INDEX IF NOT EXISTS idx_orders_store_id ON public.orders(store_id);
CREATE INDEX IF NOT EXISTS idx_orders_stripe_account_id ON public.orders(stripe_account_id);

-- Allow store owners to view orders that belong to their corporate store.
DROP POLICY IF EXISTS "Owners can view orders for their stores" ON public.orders;
CREATE POLICY "Owners can view orders for their stores"
ON public.orders
FOR SELECT
TO authenticated
USING (
  store_id IN (
    SELECT id FROM public.corporate_stores WHERE user_id = auth.uid()
  )
);