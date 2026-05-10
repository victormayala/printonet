CREATE OR REPLACE FUNCTION public.printonet_purge_unlinked_customizer_sessions(p_days integer DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  IF p_days IS NULL OR p_days < 7 THEN
    RAISE EXCEPTION 'p_days must be >= 7 (got %)', p_days;
  END IF;

  WITH linked AS (
    SELECT DISTINCT (li->>'customizer_session_id')::uuid AS session_id
    FROM public.printonet_woo_order_files f,
         LATERAL jsonb_array_elements(COALESCE(f.line_items, '[]'::jsonb)) AS li
    WHERE li ? 'customizer_session_id'
      AND (li->>'customizer_session_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ),
  deleted AS (
    DELETE FROM public.customizer_sessions cs
    WHERE cs.created_at < now() - make_interval(days => p_days)
      AND NOT EXISTS (SELECT 1 FROM linked l WHERE l.session_id = cs.id)
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_deleted FROM deleted;

  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.printonet_purge_unlinked_customizer_sessions(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.printonet_purge_unlinked_customizer_sessions(integer) FROM anon;
REVOKE ALL ON FUNCTION public.printonet_purge_unlinked_customizer_sessions(integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.printonet_purge_unlinked_customizer_sessions(integer) TO service_role;