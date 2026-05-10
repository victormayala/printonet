export type CorporateStore = {
  id: string;
  user_id: string;
  name: string;
  contact_email: string;
  custom_domain: string | null;
  primary_color: string;
  accent_color: string;
  font_family: string;
  logo_url: string | null;
  secondary_logo_url: string | null;
  favicon_url: string | null;
  wp_site_url: string | null;
  wp_admin_url: string | null;
  wp_site_id: string | null;
  store_admin_url: string | null;
  store_login_url: string | null;
  admin_username: string | null;
  admin_password: string | null;
  admin_user_id: string | null;
  tenant_slug: string | null;
  store_type: "corporate" | "retail";
  status: "provisioning" | "active" | "failed" | "paused";
  error_message: string | null;
  stripe_account_id: string | null;
  stripe_charges_enabled: boolean;
  stripe_payouts_enabled: boolean;
  stripe_details_submitted: boolean;
  created_at: string;
};

export function resolveTenantSlug(store: CorporateStore): string | null {
  if (store.tenant_slug) return store.tenant_slug;
  const url = store.wp_site_url;
  if (!url) return null;
  try {
    return new URL(url).host.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}
