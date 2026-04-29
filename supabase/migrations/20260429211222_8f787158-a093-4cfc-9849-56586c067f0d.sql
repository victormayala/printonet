ALTER TABLE public.corporate_stores
  ADD COLUMN IF NOT EXISTS tenant_slug text,
  ADD COLUMN IF NOT EXISTS provision_request_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS corporate_stores_tenant_slug_uidx
  ON public.corporate_stores (tenant_slug)
  WHERE tenant_slug IS NOT NULL;