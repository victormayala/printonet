-- Subscriptions table for Printonet store-owner plans
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  stripe_subscription_id text NOT NULL UNIQUE,
  stripe_customer_id text NOT NULL,
  product_id text,
  price_id text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  extra_store_quantity integer NOT NULL DEFAULT 0,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_id ON public.subscriptions(stripe_subscription_id);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage subscriptions"
  ON public.subscriptions FOR ALL
  USING (auth.role() = 'service_role');

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: does this user have an active subscription in the given env?
CREATE OR REPLACE FUNCTION public.has_active_subscription(
  user_uuid uuid,
  check_env text DEFAULT 'live'
)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = user_uuid
      AND environment = check_env
      AND (
        (status IN ('active','trialing','past_due')
          AND (current_period_end IS NULL OR current_period_end > now()))
        OR (status = 'canceled' AND current_period_end > now())
      )
  );
$$;

-- Resolve included store count from the price_id (server-authoritative)
CREATE OR REPLACE FUNCTION public.printonet_plan_included_stores(p_price_id text)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_price_id
    WHEN 'starter_monthly' THEN 1
    WHEN 'growth_monthly'  THEN 3
    WHEN 'pro_monthly'     THEN 10
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION public.printonet_plan_fee_bps(p_price_id text)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_price_id
    WHEN 'starter_monthly' THEN 250
    WHEN 'growth_monthly'  THEN 150
    WHEN 'pro_monthly'     THEN 50
    ELSE 250
  END;
$$;

-- Return the user's effective store limit based on current subscription
CREATE OR REPLACE FUNCTION public.printonet_user_store_limit(p_user_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((
    SELECT public.printonet_plan_included_stores(price_id) + extra_store_quantity
    FROM public.subscriptions
    WHERE user_id = p_user_id
      AND status IN ('active','trialing','past_due')
      AND (current_period_end IS NULL OR current_period_end > now())
    ORDER BY created_at DESC
    LIMIT 1
  ), 0);
$$;

-- Bulk-apply a plan's fee to all of a user's stores. SECURITY DEFINER so the
-- existing protect_corporate_stores_platform_fee trigger (which gates writes
-- on auth.uid() being super_admin) is bypassed when the webhook calls it.
CREATE OR REPLACE FUNCTION public.printonet_apply_plan_fee_to_user_stores(
  p_user_id uuid, p_bps integer
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Temporarily disable the protective trigger by using a session GUC
  -- check inside the trigger? Simpler: update directly as service role.
  -- The protect trigger checks has_role(auth.uid(), 'super_admin') which
  -- is null during a service-role RPC, so we adjust the trigger to allow
  -- nulls (no auth context).
  UPDATE public.corporate_stores
  SET platform_fee_bps = p_bps
  WHERE user_id = p_user_id;
END;
$$;

-- Loosen the fee-protection trigger so service-role/SECURITY DEFINER calls
-- (which have no auth.uid()) are allowed through.
CREATE OR REPLACE FUNCTION public.protect_corporate_stores_platform_fee()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.platform_fee_bps IS DISTINCT FROM OLD.platform_fee_bps THEN
    IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'super_admin') THEN
      RAISE EXCEPTION 'Only Printonet super admins can change the platform fee.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  IF TG_OP = 'INSERT' AND NEW.platform_fee_bps IS DISTINCT FROM 250 THEN
    IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'super_admin') THEN
      NEW.platform_fee_bps := 250;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Pause / unpause all of a user's stores (used by webhook on cancel / restore)
CREATE OR REPLACE FUNCTION public.printonet_set_user_stores_status(
  p_user_id uuid, p_status text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_status NOT IN ('active','paused') THEN
    RAISE EXCEPTION 'invalid status %', p_status;
  END IF;
  UPDATE public.corporate_stores
  SET status = p_status
  WHERE user_id = p_user_id
    AND status IN ('active','paused');
END;
$$;

-- Enforce store-count limit on insert
CREATE OR REPLACE FUNCTION public.enforce_corporate_store_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_limit integer;
  v_count integer;
BEGIN
  -- Super admins bypass.
  IF auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'super_admin') THEN
    RETURN NEW;
  END IF;
  v_limit := public.printonet_user_store_limit(NEW.user_id);
  SELECT count(*) INTO v_count FROM public.corporate_stores WHERE user_id = NEW.user_id;
  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Store limit reached for current plan (% of %). Upgrade or add a store seat.', v_count, v_limit
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_corporate_store_limit_trg
  BEFORE INSERT ON public.corporate_stores
  FOR EACH ROW EXECUTE FUNCTION public.enforce_corporate_store_limit();
