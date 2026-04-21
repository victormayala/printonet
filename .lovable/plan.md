
## Goal
Add a "Corporate Stores" feature to Printonet that lets any authenticated user provision a fully-branded WooCommerce store on InstaWP from a single form, by cloning a pre-built InstaWP template site and applying the client's branding pack.

## Architecture overview

```
User → /corporate-stores  (UI form)
        │ uploads logos to Supabase Storage
        ▼
Edge Function: provision-corporate-store  (auth required)
        │ 1. inserts corporate_stores row (status=provisioning)
        │ 2. calls InstaWP API → clone template
        │ 3. saves task_id + returns store_id
        ▼
Edge Function: instawp-webhook  (public, HMAC-verified)
        │ on site.ready:  fills site URLs + calls apply-store-branding
        │ on site.failed: marks row failed
        ▼
Edge Function: apply-store-branding  (internal helper)
        │ POSTs branding pack to the new WP site's REST API
        │ flips status → active
```

## Database (one new table)

`corporate_stores`
- `id`, `user_id`, `name`, `contact_email`, `custom_domain`
- `primary_color`, `accent_color`, `font_family`
- `logo_url`, `secondary_logo_url`, `favicon_url`
- `instawp_task_id`, `instawp_site_id`, `instawp_site_url`, `instawp_admin_url`
- `status` ('provisioning' | 'active' | 'failed'), `error_message`
- `created_at`, `updated_at`

**RLS**: users can only see/insert/update their own rows.

**New storage bucket**: `corporate-store-assets` (public-read), partitioned by `user_id/store_id/`.

## Secrets I'll request via add_secret
- `INSTAWP_API_KEY` — InstaWP → Settings → API
- `INSTAWP_TEMPLATE_ID` — ID of your pre-built WooCommerce template site
- `INSTAWP_WEBHOOK_SECRET` — for HMAC verification on the webhook

## Edge functions

1. **`provision-corporate-store`** (verify_jwt = on)
   - Zod-validates the branding payload.
   - Inserts row → calls InstaWP `POST /api/v2/sites` with `template_id`.
   - Saves `instawp_task_id`. Returns `{ store_id }` immediately so the UI can show progress.

2. **`instawp-webhook`** (verify_jwt = off, signature verified in code)
   - Verifies `X-InstaWP-Signature` against `INSTAWP_WEBHOOK_SECRET`.
   - On `site.ready` → fills site URLs and triggers `apply-store-branding`.
   - On `site.failed` → marks row failed with the error message.

3. **`apply-store-branding`** (internal helper)
   - POSTs branding pack to `{site_url}/wp-json/customizer-studio/v1/branding` using the one-time admin token returned by InstaWP's clone response.
   - Marks store `active` on success.
   - Note: a small WP-plugin REST route to receive this payload is a follow-up update to `customizer-studio-woocommerce.php`. The function and infrastructure will be ready; the plugin endpoint can ship next.

## UI (new route `/corporate-stores`)

Sidebar entry under "Storefront", protected for authenticated users.

- **List view** — table of the user's corporate stores: status badge (Provisioning ⏳ / Active ✅ / Failed ❌), site URL, "Open WP Admin" link, "Re-apply branding" action.
- **"+ New corporate store" button** opens a multi-section dialog form:
  - **Identity** — store name, contact email, optional custom domain
  - **Visual** — primary color picker, accent color picker, font family dropdown (reuses our 47 Google Fonts list)
  - **Assets** — main logo, secondary/dark-mode logo, favicon (drag-and-drop, preview, mime/size validation — same pattern as BrandSettings)
- On submit → uploads assets to storage → calls `provision-corporate-store` → polls the row every 3s until status ≠ provisioning.

All inputs use Zod client-side AND server-side.

## What you'll need to do (one-time)
1. Build a WooCommerce template site on InstaWP and install `customizer-studio-woocommerce.php` on it. Copy the **template ID** into `INSTAWP_TEMPLATE_ID`.
2. In InstaWP → Webhooks add `https://qumrnazgdrijdcihtkah.supabase.co/functions/v1/instawp-webhook` and copy the signing secret into `INSTAWP_WEBHOOK_SECRET`.
3. Generate an InstaWP API key → paste into `INSTAWP_API_KEY`.

I'll print the exact webhook URL again after the secrets are configured.

## Files
- `supabase/migrations/<new>` — table + RLS + storage bucket
- `supabase/functions/provision-corporate-store/index.ts` (new)
- `supabase/functions/apply-store-branding/index.ts` (new)
- `supabase/functions/instawp-webhook/index.ts` (new)
- `src/pages/CorporateStores.tsx` (new — list + form dialog)
- `src/components/DashboardSidebar.tsx` — add nav link
- `src/App.tsx` — add route

## Out of scope (this round)
- Product/catalog seeding (empty stores per your answer)
- Per-employee permission system inside WooCommerce
- DNS automation for the custom domain (we store the value; user wires DNS themselves)
- The new WP-plugin branding REST route — small follow-up update
