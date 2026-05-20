
-- Super admin SELECT policies across tenant-scoped tables
CREATE POLICY "Super admins view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins view all orders"
ON public.orders FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins view all order items"
ON public.order_items FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins view all subscriptions"
ON public.subscriptions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins view all user roles"
ON public.user_roles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins manage user roles insert"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins manage user roles delete"
ON public.user_roles FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins view all customer profiles"
ON public.customer_profiles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

-- Admin list users (joins auth.users + profiles + roles)
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id uuid,
  email text,
  store_name text,
  created_at timestamptz,
  is_super_admin boolean,
  store_count integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.id,
    u.email::text,
    p.store_name,
    u.created_at,
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id AND ur.role = 'super_admin') AS is_super_admin,
    (SELECT COUNT(*)::int FROM public.corporate_stores cs WHERE cs.user_id = u.id) AS store_count
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE public.has_role(auth.uid(), 'super_admin')
  ORDER BY u.created_at DESC;
$$;

-- Platform KPIs
CREATE OR REPLACE FUNCTION public.admin_platform_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
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
          WHEN 'starter_monthly' THEN 2900
          WHEN 'growth_monthly' THEN 9900
          WHEN 'pro_monthly' THEN 29900
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
$$;
