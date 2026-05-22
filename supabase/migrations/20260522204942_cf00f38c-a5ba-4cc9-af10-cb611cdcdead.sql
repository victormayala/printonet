CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.admin_create_invite(p_email text, p_note text DEFAULT NULL::text, p_expires_in_days integer DEFAULT 30)
 RETURNS TABLE(id uuid, token text, email text, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_token text;
  v_id uuid;
  v_exp timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  v_exp := now() + make_interval(days => COALESCE(p_expires_in_days, 30));

  INSERT INTO public.invites (email, token, created_by, note, expires_at)
  VALUES (lower(p_email), v_token, auth.uid(), p_note, v_exp)
  RETURNING invites.id INTO v_id;

  RETURN QUERY SELECT v_id, v_token, lower(p_email), v_exp;
END;
$function$;