-- =========================================================================
-- 1) corporate_stores: keep anon SELECT but only on non-sensitive columns
-- =========================================================================
-- Revoke broad table SELECT from anon, then re-grant only safe columns.
REVOKE SELECT ON public.corporate_stores FROM anon;

GRANT SELECT (
  id, user_id, name, tenant_slug, custom_domain, status,
  primary_color, accent_color, font_family,
  logo_url, secondary_logo_url, favicon_url,
  customizer_logo_dark_url, customizer_theme, customizer_border_radius,
  store_type,
  shipping_label, shipping_flat_amount, free_shipping_threshold,
  tax_label, tax_inclusive, tax_rate_bps, tax_enabled,
  created_at, updated_at
) ON public.corporate_stores TO anon;

-- Authenticated users keep full table access (RLS still scopes rows).
GRANT SELECT ON public.corporate_stores TO authenticated;

-- =========================================================================
-- 2) customizer_sessions: replace blanket public read with scoped policies
--    + SECURITY DEFINER RPCs for anonymous lookup by id.
-- =========================================================================
DROP POLICY IF EXISTS "Anyone can view sessions by id" ON public.customizer_sessions;

-- Authenticated session owner (user_id stored on the session)
CREATE POLICY "Owners view own sessions"
ON public.customizer_sessions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Store owners see every session attributed to one of their stores
CREATE POLICY "Store owners view their store sessions"
ON public.customizer_sessions
FOR SELECT
TO authenticated
USING (
  store_id IN (SELECT id FROM public.corporate_stores WHERE user_id = auth.uid())
);

-- Super admins can already see everything via has_role checks elsewhere;
-- add an explicit SELECT for the admin views.
CREATE POLICY "Super admins view all sessions"
ON public.customizer_sessions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

-- Anonymous lookup by id (used by EmbedCustomizer, ReviewDesign, PrintView,
-- Checkout). Returns at most the rows whose ids the caller already knows.
CREATE OR REPLACE FUNCTION public.get_customizer_session(p_id uuid)
RETURNS SETOF public.customizer_sessions
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.customizer_sessions WHERE id = p_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_customizer_sessions(p_ids uuid[])
RETURNS SETOF public.customizer_sessions
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.customizer_sessions WHERE id = ANY(p_ids);
$$;

GRANT EXECUTE ON FUNCTION public.get_customizer_session(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_customizer_sessions(uuid[]) TO anon, authenticated;

-- =========================================================================
-- 3) orders + order_items: remove blanket "anyone can read" policies.
--    Owner, session-owner, and super_admin policies remain.
-- =========================================================================
DROP POLICY IF EXISTS "Public can view order by session" ON public.orders;
DROP POLICY IF EXISTS "anon can read order by id"      ON public.orders;
DROP POLICY IF EXISTS "anon can read order items"      ON public.order_items;

-- Add owner SELECT on order_items via parent order's store_id, matching
-- the existing pattern for orders.
CREATE POLICY "Owners view order items for their stores"
ON public.order_items
FOR SELECT
TO authenticated
USING (
  order_id IN (
    SELECT o.id FROM public.orders o
    WHERE o.store_id IN (SELECT id FROM public.corporate_stores WHERE user_id = auth.uid())
  )
);

-- =========================================================================
-- 4) invites: drop public read, expose lookup by token via RPC only
-- =========================================================================
DROP POLICY IF EXISTS "Public can read invite by token" ON public.invites;

CREATE OR REPLACE FUNCTION public.get_invite_by_token(p_token text)
RETURNS TABLE (email text, used_at timestamptz, expires_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email, used_at, expires_at
  FROM public.invites
  WHERE token = p_token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_invite_by_token(text) TO anon, authenticated;

-- =========================================================================
-- 5) design-exports storage: require auth.uid() folder prefix
-- =========================================================================
DROP POLICY IF EXISTS "design_exports_auth_insert" ON storage.objects;

CREATE POLICY "design_exports_owner_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'design-exports'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "design_exports_owner_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'design-exports'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'design-exports'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "design_exports_owner_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'design-exports'
  AND (storage.foldername(name))[1] = auth.uid()::text
);