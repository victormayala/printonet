
CREATE OR REPLACE FUNCTION public.printonet_plan_included_stores(p_price_id text)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE p_price_id
    WHEN 'customizer_monthly' THEN 0
    WHEN 'starter_monthly'    THEN 1
    WHEN 'growth_monthly'     THEN 3
    WHEN 'pro_monthly'        THEN 10
    ELSE 0
  END;
$function$;

CREATE OR REPLACE FUNCTION public.printonet_plan_fee_bps(p_price_id text)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE p_price_id
    WHEN 'customizer_monthly' THEN 0
    WHEN 'starter_monthly'    THEN 250
    WHEN 'growth_monthly'     THEN 150
    WHEN 'pro_monthly'        THEN 50
    ELSE 250
  END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_platform_stats()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'total_users', (SELECT COUNT(*) FROM auth.users),
    'total_stores', (SELECT COUNT(*) FROM public.corporate_stores),
    'active_stores', (SELECT COUNT(*) FROM public.corporate_stores WHERE status = 'active'),
    'total_orders', (SELECT COUNT(*) FROM public.orders WHERE status = 'paid'),
    'gmv_cents', COALESCE((SELECT SUM(amount_total) FROM public.orders WHERE status = 'paid'), 0),
    'platform_fees_cents', COALESCE((SELECT SUM(application_fee_amount) FROM public.orders WHERE status = 'paid'), 0),
    'active_subscriptions', (SELECT COUNT(*) FROM public.subscriptions WHERE status IN ('active','trialing','past_due') AND (current_period_end IS NULL OR current_period_end > now())),
    'mrr_cents', COALESCE((
      SELECT SUM(
        CASE price_id
          WHEN 'customizer_monthly' THEN 2900
          WHEN 'starter_monthly'    THEN 3900
          WHEN 'growth_monthly'     THEN 9900
          WHEN 'pro_monthly'        THEN 29900
          ELSE 0
        END
      )
      FROM public.subscriptions
      WHERE status IN ('active','trialing') AND (current_period_end IS NULL OR current_period_end > now())
    ), 0),
    'new_users_30d', (SELECT COUNT(*) FROM auth.users WHERE created_at > now() - interval '30 days'),
    'new_orders_30d', (SELECT COUNT(*) FROM public.orders WHERE status = 'paid' AND created_at > now() - interval '30 days'),
    'gmv_30d_cents', COALESCE((SELECT SUM(amount_total) FROM public.orders WHERE status = 'paid' AND created_at > now() - interval '30 days'), 0)
  ) INTO result;

  RETURN result;
END;
$function$;
