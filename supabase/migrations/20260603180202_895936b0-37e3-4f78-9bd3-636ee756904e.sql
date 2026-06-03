
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hosted_stores_enabled boolean NOT NULL DEFAULT false;

UPDATE public.profiles p
SET hosted_stores_enabled = true
WHERE EXISTS (SELECT 1 FROM public.corporate_stores cs WHERE cs.user_id = p.id);

CREATE OR REPLACE FUNCTION public.admin_set_hosted_stores_enabled(p_user_id uuid, p_enabled boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  UPDATE public.profiles SET hosted_stores_enabled = p_enabled WHERE id = p_user_id;
  RETURN p_enabled;
END;
$$;

DROP FUNCTION IF EXISTS public.admin_list_users();

CREATE OR REPLACE FUNCTION public.admin_list_users()
 RETURNS TABLE(id uuid, email text, store_name text, created_at timestamp with time zone, is_super_admin boolean, store_count integer, is_banned boolean, hosted_stores_enabled boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT
    u.id,
    u.email::text,
    p.store_name,
    u.created_at,
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id AND ur.role = 'super_admin') AS is_super_admin,
    (SELECT COUNT(*)::int FROM public.corporate_stores cs WHERE cs.user_id = u.id) AS store_count,
    (u.banned_until IS NOT NULL AND u.banned_until > now()) AS is_banned,
    COALESCE(p.hosted_stores_enabled, false) AS hosted_stores_enabled
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE public.has_role(auth.uid(), 'super_admin')
  ORDER BY u.created_at DESC;
$$;
