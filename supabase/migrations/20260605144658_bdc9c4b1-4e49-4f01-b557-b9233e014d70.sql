
-- 1) Uniqueness: one account per external Shopify/Woo store
CREATE UNIQUE INDEX IF NOT EXISTS store_integrations_unique_external_store
  ON public.store_integrations (
    platform,
    lower(regexp_replace(regexp_replace(store_url, '^https?://', ''), '/+$', ''))
  )
  WHERE platform IN ('shopify','woocommerce');

-- 2) Release helper: tear down a user's external integrations + dashboard sync stores
CREATE OR REPLACE FUNCTION public.release_user_external_integrations(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.corporate_store_products
  WHERE store_id IN (
    SELECT id FROM public.corporate_stores
    WHERE user_id = p_user_id AND store_type IN ('shopify','woocommerce')
  );

  DELETE FROM public.corporate_stores
  WHERE user_id = p_user_id AND store_type IN ('shopify','woocommerce');

  DELETE FROM public.store_integrations
  WHERE user_id = p_user_id AND platform IN ('shopify','woocommerce');
END;
$$;

-- 3) Trigger: when subscription is no longer active in any environment, release
CREATE OR REPLACE FUNCTION public.release_integrations_on_subscription_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_has_any_active boolean;
BEGIN
  v_user_id := COALESCE(NEW.user_id, OLD.user_id);
  IF v_user_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.status IS NOT DISTINCT FROM OLD.status
     AND NEW.current_period_end IS NOT DISTINCT FROM OLD.current_period_end THEN
    RETURN NEW;
  END IF;

  SELECT (
    public.has_active_subscription(v_user_id, 'live')
    OR public.has_active_subscription(v_user_id, 'sandbox')
  ) INTO v_has_any_active;

  IF NOT v_has_any_active THEN
    PERFORM public.release_user_external_integrations(v_user_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_subscriptions_release_integrations ON public.subscriptions;
CREATE TRIGGER trg_subscriptions_release_integrations
AFTER INSERT OR UPDATE OR DELETE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.release_integrations_on_subscription_change();
