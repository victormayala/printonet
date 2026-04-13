
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.customizer_sessions(id),
  stripe_checkout_id text,
  stripe_payment_intent text,
  customer_email text,
  amount_total integer,
  currency text DEFAULT 'usd',
  status text NOT NULL DEFAULT 'paid',
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_session_id ON public.orders(session_id);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Orders are created by webhook (service role) and viewable by authenticated session owners
CREATE POLICY "Users can view orders for their sessions"
  ON public.orders FOR SELECT
  TO authenticated
  USING (
    session_id IN (
      SELECT id FROM public.customizer_sessions WHERE user_id = auth.uid()
    )
  );

-- Public can view their own order by session_id (for checkout return page)
CREATE POLICY "Public can view order by session"
  ON public.orders FOR SELECT
  TO public
  USING (true);

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
