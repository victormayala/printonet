
ALTER TABLE public.corporate_stores ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.store_integrations ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.corporate_store_products ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_corporate_stores_user_archived ON public.corporate_stores(user_id) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_store_integrations_user_archived ON public.store_integrations(user_id) WHERE archived_at IS NULL;

CREATE OR REPLACE FUNCTION public.release_user_external_integrations(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.corporate_store_products
  SET archived_at = COALESCE(archived_at, now())
  WHERE store_id IN (
    SELECT id FROM public.corporate_stores
    WHERE user_id = p_user_id AND store_type IN ('shopify','woocommerce')
  );

  UPDATE public.corporate_stores
  SET archived_at = COALESCE(archived_at, now())
  WHERE user_id = p_user_id AND store_type IN ('shopify','woocommerce');

  UPDATE public.store_integrations
  SET archived_at = COALESCE(archived_at, now())
  WHERE user_id = p_user_id AND platform IN ('shopify','woocommerce');
END;
$function$;
