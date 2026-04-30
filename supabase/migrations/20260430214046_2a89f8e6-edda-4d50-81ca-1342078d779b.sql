ALTER TABLE public.corporate_stores
  ADD COLUMN IF NOT EXISTS store_admin_url text,
  ADD COLUMN IF NOT EXISTS store_login_url text,
  ADD COLUMN IF NOT EXISTS admin_username text,
  ADD COLUMN IF NOT EXISTS admin_password text,
  ADD COLUMN IF NOT EXISTS admin_user_id text;