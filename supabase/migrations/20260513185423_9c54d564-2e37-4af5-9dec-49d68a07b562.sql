CREATE TABLE IF NOT EXISTS public._one_shot_reveal (
  key_name text PRIMARY KEY,
  consumed_at timestamptz
);
ALTER TABLE public._one_shot_reveal ENABLE ROW LEVEL SECURITY;
-- No policies = no client access. Only service_role bypasses RLS.
INSERT INTO public._one_shot_reveal (key_name, consumed_at)
VALUES ('service_role_key', NULL)
ON CONFLICT (key_name) DO UPDATE SET consumed_at = NULL;