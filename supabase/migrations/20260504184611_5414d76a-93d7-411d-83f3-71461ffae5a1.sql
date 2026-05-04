-- Categories table with self-referential parent for sub-categories
CREATE TABLE public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  parent_id uuid REFERENCES public.product_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, parent_id, name)
);

CREATE INDEX idx_product_categories_user ON public.product_categories(user_id);
CREATE INDEX idx_product_categories_parent ON public.product_categories(parent_id);

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own categories"
  ON public.product_categories FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own categories"
  ON public.product_categories FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories"
  ON public.product_categories FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories"
  ON public.product_categories FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_product_categories_updated_at
  BEFORE UPDATE ON public.product_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Link inventory_products to categories (preserving existing text 'category' for backward compat)
ALTER TABLE public.inventory_products
  ADD COLUMN category_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL,
  ADD COLUMN subcategory_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL;

CREATE INDEX idx_inventory_products_category_id ON public.inventory_products(category_id);
CREATE INDEX idx_inventory_products_subcategory_id ON public.inventory_products(subcategory_id);