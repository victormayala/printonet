ALTER TABLE public.product_categories
  ADD COLUMN sort_order integer NOT NULL DEFAULT 0;

CREATE INDEX idx_product_categories_sort
  ON public.product_categories(user_id, parent_id, sort_order);

-- Seed initial sort_order based on alphabetical name within each parent
WITH ranked AS (
  SELECT id,
    (row_number() OVER (PARTITION BY user_id, parent_id ORDER BY name) - 1) AS rn
  FROM public.product_categories
)
UPDATE public.product_categories pc
SET sort_order = ranked.rn
FROM ranked
WHERE pc.id = ranked.id;