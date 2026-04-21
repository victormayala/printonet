-- Corporate Stores table
CREATE TABLE public.corporate_stores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  custom_domain TEXT,
  primary_color TEXT NOT NULL DEFAULT '#7c3aed',
  accent_color TEXT NOT NULL DEFAULT '#e0459b',
  font_family TEXT NOT NULL DEFAULT 'Inter',
  logo_url TEXT,
  secondary_logo_url TEXT,
  favicon_url TEXT,
  instawp_task_id TEXT,
  instawp_site_id TEXT,
  instawp_site_url TEXT,
  instawp_admin_url TEXT,
  status TEXT NOT NULL DEFAULT 'provisioning',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.corporate_stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own corporate stores"
ON public.corporate_stores
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own corporate stores"
ON public.corporate_stores
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own corporate stores"
ON public.corporate_stores
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER update_corporate_stores_updated_at
BEFORE UPDATE ON public.corporate_stores
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_corporate_stores_user_id ON public.corporate_stores(user_id);
CREATE INDEX idx_corporate_stores_task_id ON public.corporate_stores(instawp_task_id);

-- Storage bucket for corporate store branding assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('corporate-store-assets', 'corporate-store-assets', true);

CREATE POLICY "Corporate store assets are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'corporate-store-assets');

CREATE POLICY "Users can upload own corporate store assets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'corporate-store-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update own corporate store assets"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'corporate-store-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own corporate store assets"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'corporate-store-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);