
-- 1. Widen store_type to include 'website'
ALTER TABLE public.corporate_stores DROP CONSTRAINT IF EXISTS corporate_stores_store_type_check;
ALTER TABLE public.corporate_stores ADD CONSTRAINT corporate_stores_store_type_check
  CHECK (store_type = ANY (ARRAY['corporate'::text, 'retail'::text, 'website'::text]));

-- 2. site_pages: each page on an informational website is a list of blocks (reuses block JSON shape)
CREATE TABLE public.site_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  user_id uuid NOT NULL,
  slug text NOT NULL,
  title text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  draft_data jsonb NOT NULL DEFAULT '{"blocks": []}'::jsonb,
  published_data jsonb,
  published_at timestamptz,
  seo_title text,
  seo_description text,
  og_image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, slug)
);
CREATE INDEX idx_site_pages_store ON public.site_pages(store_id, sort_order);

GRANT SELECT ON public.site_pages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_pages TO authenticated;
GRANT ALL ON public.site_pages TO service_role;

ALTER TABLE public.site_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view published pages on active sites"
  ON public.site_pages FOR SELECT
  TO anon, authenticated
  USING (published_at IS NOT NULL AND enabled = true AND store_id IN (
    SELECT id FROM public.corporate_stores WHERE status = 'active' AND store_type = 'website'
  ));

CREATE POLICY "Owners view own pages"
  ON public.site_pages FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Owners insert own pages"
  ON public.site_pages FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id AND store_id IN (
    SELECT id FROM public.corporate_stores WHERE user_id = auth.uid()
  ));

CREATE POLICY "Owners update own pages"
  ON public.site_pages FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Owners delete own pages"
  ON public.site_pages FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER set_site_pages_updated_at BEFORE UPDATE ON public.site_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. site_navigation: header/footer menus per website
CREATE TABLE public.site_navigation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  user_id uuid NOT NULL,
  location text NOT NULL CHECK (location IN ('header', 'footer')),
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, location)
);

GRANT SELECT ON public.site_navigation TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_navigation TO authenticated;
GRANT ALL ON public.site_navigation TO service_role;

ALTER TABLE public.site_navigation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view navigation for active sites"
  ON public.site_navigation FOR SELECT
  TO anon, authenticated
  USING (store_id IN (
    SELECT id FROM public.corporate_stores WHERE status = 'active' AND store_type = 'website'
  ));

CREATE POLICY "Owners view own navigation"
  ON public.site_navigation FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Owners insert own navigation"
  ON public.site_navigation FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id AND store_id IN (
    SELECT id FROM public.corporate_stores WHERE user_id = auth.uid()
  ));

CREATE POLICY "Owners update own navigation"
  ON public.site_navigation FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Owners delete own navigation"
  ON public.site_navigation FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER set_site_navigation_updated_at BEFORE UPDATE ON public.site_navigation
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. blog_authors
CREATE TABLE public.blog_authors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  avatar_url text,
  bio text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_blog_authors_store ON public.blog_authors(store_id);

GRANT SELECT ON public.blog_authors TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_authors TO authenticated;
GRANT ALL ON public.blog_authors TO service_role;

ALTER TABLE public.blog_authors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view authors for active sites"
  ON public.blog_authors FOR SELECT
  TO anon, authenticated
  USING (store_id IN (
    SELECT id FROM public.corporate_stores WHERE status = 'active' AND store_type = 'website'
  ));

CREATE POLICY "Owners view own authors"
  ON public.blog_authors FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Owners insert own authors"
  ON public.blog_authors FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id AND store_id IN (
    SELECT id FROM public.corporate_stores WHERE user_id = auth.uid()
  ));

CREATE POLICY "Owners update own authors"
  ON public.blog_authors FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Owners delete own authors"
  ON public.blog_authors FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER set_blog_authors_updated_at BEFORE UPDATE ON public.blog_authors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. blog_categories
CREATE TABLE public.blog_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  user_id uuid NOT NULL,
  slug text NOT NULL,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, slug)
);

GRANT SELECT ON public.blog_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_categories TO authenticated;
GRANT ALL ON public.blog_categories TO service_role;

ALTER TABLE public.blog_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view categories for active sites"
  ON public.blog_categories FOR SELECT
  TO anon, authenticated
  USING (store_id IN (
    SELECT id FROM public.corporate_stores WHERE status = 'active' AND store_type = 'website'
  ));

CREATE POLICY "Owners view own categories"
  ON public.blog_categories FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Owners insert own categories"
  ON public.blog_categories FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id AND store_id IN (
    SELECT id FROM public.corporate_stores WHERE user_id = auth.uid()
  ));

CREATE POLICY "Owners update own categories"
  ON public.blog_categories FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Owners delete own categories"
  ON public.blog_categories FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER set_blog_categories_updated_at BEFORE UPDATE ON public.blog_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. blog_posts
CREATE TABLE public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  user_id uuid NOT NULL,
  author_id uuid,
  slug text NOT NULL,
  title text NOT NULL,
  excerpt text,
  body_md text NOT NULL DEFAULT '',
  hero_image_url text,
  tags text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published')),
  publish_at timestamptz,
  published_at timestamptz,
  seo_title text,
  seo_description text,
  og_image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, slug)
);
CREATE INDEX idx_blog_posts_store_status ON public.blog_posts(store_id, status, published_at DESC);

GRANT SELECT ON public.blog_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_posts TO authenticated;
GRANT ALL ON public.blog_posts TO service_role;

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view published posts on active sites"
  ON public.blog_posts FOR SELECT
  TO anon, authenticated
  USING (
    status = 'published'
    AND published_at IS NOT NULL
    AND published_at <= now()
    AND store_id IN (
      SELECT id FROM public.corporate_stores WHERE status = 'active' AND store_type = 'website'
    )
  );

CREATE POLICY "Owners view own posts"
  ON public.blog_posts FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Owners insert own posts"
  ON public.blog_posts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id AND store_id IN (
    SELECT id FROM public.corporate_stores WHERE user_id = auth.uid()
  ));

CREATE POLICY "Owners update own posts"
  ON public.blog_posts FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Owners delete own posts"
  ON public.blog_posts FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER set_blog_posts_updated_at BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. blog_post_categories join table
CREATE TABLE public.blog_post_categories (
  post_id uuid NOT NULL,
  category_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, category_id)
);
CREATE INDEX idx_blog_post_categories_category ON public.blog_post_categories(category_id);

GRANT SELECT ON public.blog_post_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_post_categories TO authenticated;
GRANT ALL ON public.blog_post_categories TO service_role;

ALTER TABLE public.blog_post_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view post categories for published posts"
  ON public.blog_post_categories FOR SELECT
  TO anon, authenticated
  USING (post_id IN (
    SELECT id FROM public.blog_posts
    WHERE status = 'published' AND published_at IS NOT NULL AND published_at <= now()
  ));

CREATE POLICY "Owners view own post categories"
  ON public.blog_post_categories FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Owners insert own post categories"
  ON public.blog_post_categories FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners delete own post categories"
  ON public.blog_post_categories FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
