CREATE TABLE IF NOT EXISTS public.printonet_woo_order_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug text NOT NULL,
  store_url text NOT NULL,
  order_id bigint NOT NULL,
  order_number text,
  order_status text,
  currency text,
  date_paid timestamptz,
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT printonet_woo_order_files_unique UNIQUE (tenant_slug, store_url, order_id)
);

CREATE INDEX IF NOT EXISTS idx_printonet_woo_order_files_tenant_updated
  ON public.printonet_woo_order_files (tenant_slug, updated_at DESC);

ALTER TABLE public.printonet_woo_order_files ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read order files for tenant stores they own.
CREATE POLICY "Owners can view their tenant order files"
  ON public.printonet_woo_order_files
  FOR SELECT
  TO authenticated
  USING (
    tenant_slug IN (
      SELECT cs.tenant_slug
      FROM public.corporate_stores cs
      WHERE cs.user_id = auth.uid()
        AND cs.tenant_slug IS NOT NULL
    )
  );

CREATE TRIGGER update_printonet_woo_order_files_updated_at
  BEFORE UPDATE ON public.printonet_woo_order_files
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();