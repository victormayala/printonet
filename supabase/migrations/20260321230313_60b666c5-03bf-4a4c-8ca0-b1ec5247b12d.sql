
-- Add user_id to brand_configs
ALTER TABLE public.brand_configs ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop old permissive policies
DROP POLICY IF EXISTS "Anyone can view brand configs" ON public.brand_configs;
DROP POLICY IF EXISTS "Anyone can create brand configs" ON public.brand_configs;
DROP POLICY IF EXISTS "Anyone can update brand configs" ON public.brand_configs;

-- Create user-scoped RLS policies
CREATE POLICY "Users can view own brand config"
  ON public.brand_configs FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own brand config"
  ON public.brand_configs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own brand config"
  ON public.brand_configs FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Also allow anon/public to read brand configs (needed for embed customizer sessions)
CREATE POLICY "Public can read brand configs"
  ON public.brand_configs FOR SELECT TO anon
  USING (true);
