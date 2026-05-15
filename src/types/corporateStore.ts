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
  tenant_slug: string | null;
  store_type: "corporate" | "retail";
  status: "provisioning" | "active" | "failed" | "paused";
  error_message: string | null;
  stripe_account_id: string | null;
  stripe_charges_enabled: boolean;
  stripe_payouts_enabled: boolean;
  stripe_details_submitted: boolean;
  platform_fee_bps: number;
  created_at: string;
};

/**
 * Tenant slug used to identify the store on the hosted Lovable storefront app
 * (and as the default subdomain). Falls back to null when missing.
 */
export function resolveTenantSlug(store: CorporateStore): string | null {
  return store.tenant_slug ?? null;
}
