
-- customer_profiles: storefront end-users, scoped per store
CREATE TABLE public.customer_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  auth_user_id uuid NOT NULL,
  email text NOT NULL,
  full_name text,
  phone text,
  disabled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, auth_user_id)
);
CREATE INDEX idx_customer_profiles_store ON public.customer_profiles(store_id);
CREATE INDEX idx_customer_profiles_email ON public.customer_profiles(store_id, lower(email));

ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers view own profile"
  ON public.customer_profiles FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

CREATE POLICY "Customers insert own profile"
  ON public.customer_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Customers update own profile"
  ON public.customer_profiles FOR UPDATE
  TO authenticated
  USING (auth_user_id = auth.uid());

CREATE POLICY "Store owners view their customers"
  ON public.customer_profiles FOR SELECT
  TO authenticated
  USING (store_id IN (SELECT id FROM public.corporate_stores WHERE user_id = auth.uid()));

CREATE TRIGGER trg_customer_profiles_updated_at
  BEFORE UPDATE ON public.customer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- customer_addresses
CREATE TABLE public.customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customer_profiles(id) ON DELETE CASCADE,
  store_id uuid NOT NULL,
  label text,
  full_name text,
  line1 text NOT NULL,
  line2 text,
  city text,
  region text,
  postal_code text,
  country text,
  phone text,
  is_default_shipping boolean NOT NULL DEFAULT false,
  is_default_billing boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_customer_addresses_customer ON public.customer_addresses(customer_id);
CREATE INDEX idx_customer_addresses_store ON public.customer_addresses(store_id);

ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers manage own addresses select"
  ON public.customer_addresses FOR SELECT
  TO authenticated
  USING (customer_id IN (SELECT id FROM public.customer_profiles WHERE auth_user_id = auth.uid()));

CREATE POLICY "Customers manage own addresses insert"
  ON public.customer_addresses FOR INSERT
  TO authenticated
  WITH CHECK (customer_id IN (SELECT id FROM public.customer_profiles WHERE auth_user_id = auth.uid()));

CREATE POLICY "Customers manage own addresses update"
  ON public.customer_addresses FOR UPDATE
  TO authenticated
  USING (customer_id IN (SELECT id FROM public.customer_profiles WHERE auth_user_id = auth.uid()));

CREATE POLICY "Customers manage own addresses delete"
  ON public.customer_addresses FOR DELETE
  TO authenticated
  USING (customer_id IN (SELECT id FROM public.customer_profiles WHERE auth_user_id = auth.uid()));

CREATE POLICY "Store owners view customer addresses"
  ON public.customer_addresses FOR SELECT
  TO authenticated
  USING (store_id IN (SELECT id FROM public.corporate_stores WHERE user_id = auth.uid()));

CREATE TRIGGER trg_customer_addresses_updated_at
  BEFORE UPDATE ON public.customer_addresses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
