

## Ready to implement: Printonet branding receiver + secret wiring

You're ready to provide the `PRINTONET_BRANDING_TOKEN`. Here's exactly what I'll do once you approve and paste the secret.

### Step 1 — Request the secret
I'll trigger the secret-input prompt for `PRINTONET_BRANDING_TOKEN`. You paste your random string. This same string also goes into `wp-config.php` on your InstaWP template site (see Step 5 below).

### Step 2 — Update the WordPress plugin
**File:** `public/customizer-studio-woocommerce.php`

- Update plugin header: name → "Printonet for WooCommerce", author → "Printonet".
- Add `POST /wp-json/printonet/v1/branding` route:
  - Verifies `X-Printonet-Token` header against the `PRINTONET_BRANDING_TOKEN` constant defined in `wp-config.php`.
  - Saves payload to `wp_options['printonet_branding']` (single JSON blob).
  - Updates `blogname` from `store_name` and `admin_email` from `contact_email`.
  - Returns `{ ok: true }` on success, `401` on bad token, `400` on bad payload.
- Add `GET /wp-json/printonet/v1/health` route (public): returns `{ ok: true, plugin: "printonet", version: "..." }` so the edge function can confirm the cloned site is responsive.
- Add `wp_head` action that reads `printonet_branding` and emits:
  - `:root { --printonet-primary, --printonet-accent, --printonet-font }`
  - Google Fonts `<link>` for the selected font.
  - Favicon `<link rel="icon">` if `favicon_url` is set.
- Existing `customizer-studio/v1/add-to-cart` route and all `cs_*` symbols stay untouched (live customer carts depend on them).

### Step 3 — Update the edge functions
**File:** `supabase/functions/apply-store-branding/index.ts`
- Change target URL from `/wp-json/customizer-studio/v1/branding` to `/wp-json/printonet/v1/branding`.
- Add `X-Printonet-Token` header sourced from `Deno.env.get("PRINTONET_BRANDING_TOKEN")`.

**File:** `supabase/functions/check-corporate-store-status/index.ts`
- Before triggering branding push, hit `GET /wp-json/printonet/v1/health` with a couple of retries to confirm WordPress is fully booted on the cloned site.

### Step 4 — Replace stale "Customizer Studio" copy in the Corporate Stores UI
**File:** `src/pages/CorporateStores.tsx`
- Replace any lingering "Customizer Studio" mentions in dialog/empty-state copy with "Printonet".

### Step 5 — What you do after I ship the code
1. Download the updated `public/customizer-studio-woocommerce.php` from the Lovable file tree.
2. Upload it to your **InstaWP template site** (replace the existing plugin).
3. Add this line to that template site's `wp-config.php` (above `/* That's all, stop editing! */`):
   ```php
   define('PRINTONET_BRANDING_TOKEN', 'PASTE_YOUR_TOKEN_HERE');
   ```
   Use the **same string** you'll paste into Lovable in Step 1.
4. Verify by visiting `https://YOUR-TEMPLATE.instawp.xyz/wp-json/printonet/v1/health` — should return `{"ok":true,...}`.
5. Re-snapshot the template in InstaWP so all future clones inherit the updated plugin and the constant.
6. Test by provisioning a new corporate store from `/corporate-stores`.

### Out of scope this round
- Renaming legacy `customizer-studio/v1/add-to-cart` route or `cs_*` symbols (would break live customer carts).
- Renaming the plugin filename (would deactivate the plugin on every existing site).
- A WP Admin settings UI for editing branding (Printonet dashboard is the source of truth).

