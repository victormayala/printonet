ALTER TABLE public.corporate_stores
ADD COLUMN IF NOT EXISTS dns_verified boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS dns_checked_at timestamptz;