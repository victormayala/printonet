
-- Switch corporate_stores from InstaWP to WordPress Multisite.
-- Rename the InstaWP-specific columns to generic wp_* equivalents so existing
-- rows are preserved. Drop the InstaWP-only task id (no analog in multisite).

ALTER TABLE public.corporate_stores DROP COLUMN IF EXISTS instawp_task_id;
ALTER TABLE public.corporate_stores RENAME COLUMN instawp_site_id  TO wp_site_id;
ALTER TABLE public.corporate_stores RENAME COLUMN instawp_site_url TO wp_site_url;
ALTER TABLE public.corporate_stores RENAME COLUMN instawp_admin_url TO wp_admin_url;
