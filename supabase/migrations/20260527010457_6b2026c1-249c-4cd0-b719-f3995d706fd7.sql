
CREATE TABLE public.order_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  store_id uuid NOT NULL,
  customer_email text NOT NULL,
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  customer_comment text,
  sender_domain text,
  sent_by uuid,
  sent_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_approvals_status_check CHECK (status IN ('pending','approved','rejected','expired'))
);

CREATE INDEX idx_order_approvals_order_id ON public.order_approvals(order_id);
CREATE INDEX idx_order_approvals_store_id ON public.order_approvals(store_id);
CREATE INDEX idx_order_approvals_token ON public.order_approvals(token);

GRANT SELECT, INSERT, UPDATE ON public.order_approvals TO authenticated;
GRANT ALL ON public.order_approvals TO service_role;

ALTER TABLE public.order_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view approvals for their stores"
ON public.order_approvals FOR SELECT TO authenticated
USING (store_id IN (SELECT id FROM public.corporate_stores WHERE user_id = auth.uid()));

CREATE POLICY "Owners insert approvals for their orders"
ON public.order_approvals FOR INSERT TO authenticated
WITH CHECK (
  store_id IN (SELECT id FROM public.corporate_stores WHERE user_id = auth.uid())
  AND order_id IN (
    SELECT o.id FROM public.orders o
    WHERE o.store_id IN (SELECT id FROM public.corporate_stores WHERE user_id = auth.uid())
  )
);

CREATE POLICY "Super admins view all approvals"
ON public.order_approvals FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_order_approvals_updated_at
BEFORE UPDATE ON public.order_approvals
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
