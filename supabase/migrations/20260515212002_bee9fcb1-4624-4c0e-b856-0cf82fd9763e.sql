
-- Drop WP/Woo legacy columns from corporate_stores
ALTER TABLE public.corporate_stores
  DROP COLUMN IF EXISTS wp_site_url,
  DROP COLUMN IF EXISTS wp_admin_url,
  DROP COLUMN IF EXISTS wp_site_id,
  DROP COLUMN IF EXISTS store_admin_url,
  DROP COLUMN IF EXISTS store_login_url,
  DROP COLUMN IF EXISTS admin_username,
  DROP COLUMN IF EXISTS admin_password,
  DROP COLUMN IF EXISTS admin_user_id,
  DROP COLUMN IF EXISTS provision_request_id,
  DROP COLUMN IF EXISTS dns_verified,
  DROP COLUMN IF EXISTS dns_checked_at;

-- Drop the WooCommerce order files mirror table (no longer used)
DROP TABLE IF EXISTS public.printonet_woo_order_files CASCADE;

-- Drop the dependent purge function (it references the table)
DROP FUNCTION IF EXISTS public.printonet_purge_unlinked_customizer_sessions(integer);
