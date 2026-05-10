-- WooCommerce sends tenant_slug via WordPress sanitize_key() (lowercase). corporate_stores
-- may contain mixed-case legacy values. RLS and app filters used exact text match, so rows
-- existed in printonet_woo_order_files but owners could not SELECT them.

DROP POLICY IF EXISTS "Owners can view their tenant order files" ON public.printonet_woo_order_files;

CREATE POLICY "Owners can view their tenant order files"
  ON public.printonet_woo_order_files
  FOR SELECT
  TO authenticated
  USING (
    lower(btrim(tenant_slug)) IN (
      SELECT lower(btrim(cs.tenant_slug))
      FROM public.corporate_stores cs
      WHERE cs.user_id = auth.uid()
        AND cs.tenant_slug IS NOT NULL
        AND btrim(cs.tenant_slug::text) <> ''
    )
  );

UPDATE public.printonet_woo_order_files
SET tenant_slug = lower(btrim(tenant_slug))
WHERE tenant_slug IS DISTINCT FROM lower(btrim(tenant_slug));

UPDATE public.corporate_stores
SET tenant_slug = lower(btrim(tenant_slug))
WHERE tenant_slug IS NOT NULL
  AND tenant_slug IS DISTINCT FROM lower(btrim(tenant_slug));
