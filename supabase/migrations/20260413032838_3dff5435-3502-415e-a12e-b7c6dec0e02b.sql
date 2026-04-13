
-- =============================================
-- 1. FIX customizer_sessions RLS policies
-- =============================================

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Anyone can create sessions" ON public.customizer_sessions;
DROP POLICY IF EXISTS "Anyone can view sessions" ON public.customizer_sessions;
DROP POLICY IF EXISTS "Anyone can update sessions" ON public.customizer_sessions;
DROP POLICY IF EXISTS "Authenticated users can view own sessions" ON public.customizer_sessions;

-- New policies: public can create (needed for SDK embed flow)
CREATE POLICY "Public can create sessions"
  ON public.customizer_sessions FOR INSERT
  TO public
  WITH CHECK (true);

-- Anyone can SELECT a specific session (needed for embed/review page by session ID)
-- But this is scoped — the app only queries by session ID, not bulk
CREATE POLICY "Anyone can view sessions by id"
  ON public.customizer_sessions FOR SELECT
  TO public
  USING (true);

-- Only service role or session creator can update (edge function uses service role)
-- For client-side: only authenticated owner can update
CREATE POLICY "Authenticated users can update own sessions"
  ON public.customizer_sessions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Service role bypass is implicit, so edge functions (complete-session) still work

-- =============================================
-- 2. FIX storage bucket policies
-- =============================================

-- product-images: remove permissive anonymous write policies
DROP POLICY IF EXISTS "Anyone can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete product images" ON storage.objects;
DROP POLICY IF EXISTS "Public read product images" ON storage.objects;
DROP POLICY IF EXISTS "Product images are publicly accessible" ON storage.objects;

-- product-images: new ownership-scoped policies
CREATE POLICY "product_images_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

CREATE POLICY "product_images_auth_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "product_images_auth_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "product_images_auth_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- design-exports: remove permissive policies
DROP POLICY IF EXISTS "Anyone can upload design exports" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view design exports" ON storage.objects;
DROP POLICY IF EXISTS "Design exports are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Public read design exports" ON storage.objects;

-- design-exports: public read (needed for preview URLs), scoped write
CREATE POLICY "design_exports_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'design-exports');

CREATE POLICY "design_exports_auth_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'design-exports');

CREATE POLICY "design_exports_anon_insert"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'design-exports');

-- brand-assets: remove permissive anonymous write
DROP POLICY IF EXISTS "Anyone can upload brand assets" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view brand assets" ON storage.objects;
DROP POLICY IF EXISTS "Brand assets are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Public read brand assets" ON storage.objects;

CREATE POLICY "brand_assets_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'brand-assets');

CREATE POLICY "brand_assets_auth_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'brand-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "brand_assets_auth_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'brand-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "brand_assets_auth_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'brand-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

-- template-thumbnails: fix update/delete ownership
DROP POLICY IF EXISTS "Anyone can update template thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete template thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update template thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete template thumbnails" ON storage.objects;

CREATE POLICY "template_thumbnails_auth_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'template-thumbnails' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "template_thumbnails_auth_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'template-thumbnails' AND (storage.foldername(name))[1] = auth.uid()::text);
