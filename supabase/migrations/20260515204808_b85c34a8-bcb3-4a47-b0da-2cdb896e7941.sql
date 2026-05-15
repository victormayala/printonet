ALTER TABLE public.corporate_stores
  ADD COLUMN IF NOT EXISTS customizer_theme text NOT NULL DEFAULT 'dark',
  ADD COLUMN IF NOT EXISTS customizer_border_radius integer NOT NULL DEFAULT 12;