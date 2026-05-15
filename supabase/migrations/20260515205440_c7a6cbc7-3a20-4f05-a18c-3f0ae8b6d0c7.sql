ALTER TABLE public.corporate_stores
  ADD COLUMN IF NOT EXISTS customizer_logo_dark_url text;

ALTER TABLE public.brand_configs
  ADD COLUMN IF NOT EXISTS logo_dark_url text;