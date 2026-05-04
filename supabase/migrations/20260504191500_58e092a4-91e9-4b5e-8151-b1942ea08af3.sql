-- Allow subcategories to be reused across multiple categories.
-- Strategy:
--  * Add `kind` column to product_categories ('category' | 'subcategory').
--  * Introduce product_category_links join table (M:N between categories and subcategories) with its own sort_order.
--  * Migrate existing parent_id relationships into the join table.
--  * Drop parent_id afterwards.

ALTER TABLE public.product_categories
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'category';

-- Mark rows that currently have a parent as subcategories
UPDATE public.product_categories
   SET kind = 'subcategory'
 WHERE parent_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.product_category_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category_id uuid NOT NULL REFERENCES public.product_categories(id) ON DELETE CASCADE,
  subcategory_id uuid NOT NULL REFERENCES public.product_categories(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (category_id, subcategory_id)
);

ALTER TABLE public.product_category_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own category links"
  ON public.product_category_links FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own category links"
  ON public.product_category_links FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own category links"
  ON public.product_category_links FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own category links"
  ON public.product_category_links FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_pcl_category ON public.product_category_links(category_id);
CREATE INDEX IF NOT EXISTS idx_pcl_subcategory ON public.product_category_links(subcategory_id);

-- Backfill from existing parent_id relations
INSERT INTO public.product_category_links (user_id, category_id, subcategory_id, sort_order)
SELECT user_id, parent_id, id, COALESCE(sort_order, 0)
  FROM public.product_categories
 WHERE parent_id IS NOT NULL
ON CONFLICT (category_id, subcategory_id) DO NOTHING;

ALTER TABLE public.product_categories DROP COLUMN IF EXISTS parent_id;
