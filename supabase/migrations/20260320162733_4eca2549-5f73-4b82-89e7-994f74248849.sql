
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, store_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'store_name');
  RETURN NEW;
END;
$$;
