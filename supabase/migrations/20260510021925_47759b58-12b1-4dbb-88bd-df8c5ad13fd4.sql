DELETE FROM public.customizer_sessions cs
WHERE cs.created_at < now() - interval '30 days'
  AND NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.session_id = cs.id);