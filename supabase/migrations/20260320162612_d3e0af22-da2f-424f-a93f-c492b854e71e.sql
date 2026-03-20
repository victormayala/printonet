
-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  store_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add user_id to inventory_products
ALTER TABLE public.inventory_products ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop old RLS policies
DROP POLICY IF EXISTS "Anyone can view active products" ON public.inventory_products;
DROP POLICY IF EXISTS "Anyone can insert products" ON public.inventory_products;
DROP POLICY IF EXISTS "Anyone can update products" ON public.inventory_products;
DROP POLICY IF EXISTS "Anyone can delete products" ON public.inventory_products;

-- New user-scoped RLS policies
CREATE POLICY "Users can view own products" ON public.inventory_products
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own products" ON public.inventory_products
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own products" ON public.inventory_products
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own products" ON public.inventory_products
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Public can still view active products (for the customizer embed)
CREATE POLICY "Public can view active products" ON public.inventory_products
  FOR SELECT TO anon USING (is_active = true);
