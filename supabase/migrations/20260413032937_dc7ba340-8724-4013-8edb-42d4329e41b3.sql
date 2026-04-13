
-- Fix design-exports: remove anonymous INSERT
DROP POLICY IF EXISTS "design_exports_anon_insert" ON storage.objects;

-- Fix template-thumbnails: add ownership to INSERT
DROP POLICY IF EXISTS "Authenticated users can upload template thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload template thumbnails" ON storage.objects;

CREATE POLICY "template_thumbnails_auth_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'template-thumbnails' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Fix design-exports: scoped authenticated INSERT
DROP POLICY IF EXISTS "design_exports_auth_insert" ON storage.objects;
CREATE POLICY "design_exports_auth_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'design-exports');
