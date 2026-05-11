
-- Remove orphan products (no owner) that were leaking to all storefronts/new accounts
DELETE FROM public.inventory_products WHERE user_id IS NULL;

-- Enforce ownership going forward
ALTER TABLE public.inventory_products
  ALTER COLUMN user_id SET NOT NULL;

-- Replace the broad anon policy with one that still requires a real owner
DROP POLICY IF EXISTS "Public can view active products" ON public.inventory_products;
CREATE POLICY "Public can view active products"
  ON public.inventory_products
  FOR SELECT
  TO anon
  USING (is_active = true AND user_id IS NOT NULL);
