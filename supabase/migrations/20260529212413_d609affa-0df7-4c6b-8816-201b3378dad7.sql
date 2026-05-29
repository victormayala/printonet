
CREATE TABLE public.cms_media (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid NOT NULL,
  user_id uuid NOT NULL,
  url text NOT NULL,
  filename text,
  content_type text,
  size_bytes bigint,
  width integer,
  height integer,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_cms_media_store ON public.cms_media (store_id, created_at DESC);
CREATE UNIQUE INDEX uq_cms_media_store_url ON public.cms_media (store_id, url);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cms_media TO authenticated;
GRANT ALL ON public.cms_media TO service_role;

ALTER TABLE public.cms_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view own media"
ON public.cms_media FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Owners insert own media"
ON public.cms_media FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND store_id IN (SELECT id FROM public.corporate_stores WHERE user_id = auth.uid()));

CREATE POLICY "Owners update own media"
ON public.cms_media FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Owners delete own media"
ON public.cms_media FOR DELETE TO authenticated
USING (auth.uid() = user_id);
