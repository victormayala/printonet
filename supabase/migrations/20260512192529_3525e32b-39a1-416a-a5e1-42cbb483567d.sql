ALTER FUNCTION public.printonet_plan_included_stores(text) SET search_path = public;
ALTER FUNCTION public.printonet_plan_fee_bps(text) SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.printonet_apply_plan_fee_to_user_stores(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.printonet_set_user_stores_status(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.printonet_user_store_limit(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) FROM anon;