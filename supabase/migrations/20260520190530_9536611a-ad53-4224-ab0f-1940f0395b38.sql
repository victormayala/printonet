
-- Platform settings (singleton)
CREATE TABLE public.platform_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  invite_only_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

INSERT INTO public.platform_settings (id, invite_only_enabled) VALUES (true, true);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read platform settings"
  ON public.platform_settings FOR SELECT
  USING (true);

CREATE POLICY "Super admins update platform settings"
  ON public.platform_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Invites
CREATE TABLE public.invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  token text NOT NULL UNIQUE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  used_at timestamptz,
  used_by uuid,
  note text
);

CREATE INDEX idx_invites_email ON public.invites (lower(email));
CREATE INDEX idx_invites_token ON public.invites (token);

ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- Super admins full control
CREATE POLICY "Super admins view invites"
  ON public.invites FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins insert invites"
  ON public.invites FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins delete invites"
  ON public.invites FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Public can lookup by token (to validate before signup)
CREATE POLICY "Public can read invite by token"
  ON public.invites FOR SELECT
  TO anon, authenticated
  USING (true);

-- Trigger function: enforce invite-only at signup
CREATE OR REPLACE FUNCTION public.enforce_invite_only_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled boolean;
  v_token text;
  v_invite_id uuid;
  v_invite_email text;
  v_used_at timestamptz;
  v_expires_at timestamptz;
BEGIN
  SELECT invite_only_enabled INTO v_enabled FROM public.platform_settings WHERE id = true;
  IF NOT COALESCE(v_enabled, false) THEN
    RETURN NEW;
  END IF;

  v_token := NULLIF(NEW.raw_user_meta_data ->> 'invite_token', '');
  IF v_token IS NULL THEN
    RAISE EXCEPTION 'Signups are invite-only. A valid invite token is required.'
      USING ERRCODE = '42501';
  END IF;

  SELECT id, email, used_at, expires_at
    INTO v_invite_id, v_invite_email, v_used_at, v_expires_at
  FROM public.invites
  WHERE token = v_token;

  IF v_invite_id IS NULL THEN
    RAISE EXCEPTION 'Invite token is invalid.' USING ERRCODE = '42501';
  END IF;
  IF v_used_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invite token has already been used.' USING ERRCODE = '42501';
  END IF;
  IF v_expires_at < now() THEN
    RAISE EXCEPTION 'Invite token has expired.' USING ERRCODE = '42501';
  END IF;
  IF lower(v_invite_email) <> lower(NEW.email) THEN
    RAISE EXCEPTION 'Invite token does not match this email address.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.invites
  SET used_at = now(), used_by = NEW.id
  WHERE id = v_invite_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_invite_only_on_signup
BEFORE INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.enforce_invite_only_signup();

-- Admin RPC to create invite (returns token)
CREATE OR REPLACE FUNCTION public.admin_create_invite(p_email text, p_note text DEFAULT NULL, p_expires_in_days integer DEFAULT 30)
RETURNS TABLE(id uuid, token text, email text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
  v_id uuid;
  v_exp timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_token := encode(gen_random_bytes(24), 'hex');
  v_exp := now() + make_interval(days => COALESCE(p_expires_in_days, 30));

  INSERT INTO public.invites (email, token, created_by, note, expires_at)
  VALUES (lower(p_email), v_token, auth.uid(), p_note, v_exp)
  RETURNING invites.id INTO v_id;

  RETURN QUERY SELECT v_id, v_token, lower(p_email), v_exp;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_invite_only(p_enabled boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  UPDATE public.platform_settings
  SET invite_only_enabled = p_enabled, updated_at = now(), updated_by = auth.uid()
  WHERE id = true;
  RETURN p_enabled;
END;
$$;
