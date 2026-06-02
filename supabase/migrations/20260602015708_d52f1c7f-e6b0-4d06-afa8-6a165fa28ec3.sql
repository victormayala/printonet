-- Link each Shopify/WooCommerce integration to a dedicated corporate store
ALTER TABLE public.store_integrations
  ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.corporate_stores(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_store_integrations_store_id ON public.store_integrations(store_id);

-- Shopify/WooCommerce sync stores are dashboard-only catalog containers and
-- should not count against the user's storefront plan limit.
CREATE OR REPLACE FUNCTION public.enforce_corporate_store_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_limit integer;
  v_count integer;
BEGIN
  IF NEW.store_type IN ('shopify','woocommerce') THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'super_admin') THEN
    RETURN NEW;
  END IF;
  v_limit := public.printonet_user_store_limit(NEW.user_id);
  SELECT count(*) INTO v_count
  FROM public.corporate_stores
  WHERE user_id = NEW.user_id
    AND store_type NOT IN ('shopify','woocommerce');
  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Store limit reached for current plan (% of %). Upgrade or add a store seat.', v_count, v_limit
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;
