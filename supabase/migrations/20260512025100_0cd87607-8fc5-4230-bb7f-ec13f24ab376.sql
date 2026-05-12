
-- 1. Role enum + user_roles table
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('super_admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 2. has_role security definer (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- 3. Trigger: prevent non-super-admins from changing platform_fee_bps
CREATE OR REPLACE FUNCTION public.protect_corporate_stores_platform_fee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.platform_fee_bps IS DISTINCT FROM OLD.platform_fee_bps THEN
    IF NOT public.has_role(auth.uid(), 'super_admin') THEN
      RAISE EXCEPTION 'Only Printonet super admins can change the platform fee.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  IF TG_OP = 'INSERT' AND NEW.platform_fee_bps IS DISTINCT FROM 250 THEN
    IF NOT public.has_role(auth.uid(), 'super_admin') THEN
      NEW.platform_fee_bps := 250;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_platform_fee_bps ON public.corporate_stores;
CREATE TRIGGER protect_platform_fee_bps
  BEFORE INSERT OR UPDATE ON public.corporate_stores
  FOR EACH ROW EXECUTE FUNCTION public.protect_corporate_stores_platform_fee();

-- 4. Let super admins view & update all stores (for fee management)
DROP POLICY IF EXISTS "Super admins can view all corporate stores" ON public.corporate_stores;
CREATE POLICY "Super admins can view all corporate stores"
  ON public.corporate_stores FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admins can update all corporate stores" ON public.corporate_stores;
CREATE POLICY "Super admins can update all corporate stores"
  ON public.corporate_stores FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));
