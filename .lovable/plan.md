
The user wants to eliminate the manual step of pasting the universal loader script into Shopify's `theme.liquid`. Instead, when a merchant connects via OAuth, the app itself should automatically inject the customizer script into their storefront.

Shopify provides exactly this mechanism: **ScriptTag API** (REST/GraphQL). When an OAuth app installs with `write_script_tags` scope, it can register a script that Shopify automatically loads on every storefront page — no theme edits needed.

Note: Shopify deprecated ScriptTag for **checkout** pages but it remains fully supported for storefront/online-store pages, which is exactly what we need (product pages). The modern alternative is **Theme App Extensions** (app blocks), but those still require the merchant to add the block in the theme editor — that's the same friction we're trying to avoid. ScriptTag is the truly zero-touch path.

## Plan: Auto-inject the customizer script via Shopify OAuth

### Goal
After a merchant clicks "Connect Shopify" and approves OAuth, the customizer script is automatically registered on their storefront. No theme edits, no copy-paste. Done.

### How it works

```text
Merchant clicks "Connect Shopify"
        │
        ▼
OAuth flow (existing) → adds write_script_tags scope
        │
        ▼
Callback exchanges code → access_token (existing)
        │
        ▼
NEW: POST /admin/api/2025-01/script_tags.json
     { src: "https://customizerstudio.com/customizer-loader.js?shop=xxx" }
        │
        ▼
Shopify auto-loads the script on every storefront page
        │
        ▼
Auto-inject logic in loader detects /products/* → button appears
```

### Changes required

**1. `supabase/functions/shopify-oauth-init/index.ts`**
- Add `write_script_tags` to the scopes string.

**2. `supabase/functions/shopify-oauth-callback/index.ts`**
- After the access token is stored, call Shopify's ScriptTag API to register `customizer-loader.js`.
- Include the merchant's `user_id` as a query param on the script URL so the loader knows which Printonet account to scope products to: `?uid=<user_id>`.
- Check for an existing ScriptTag with the same `src` first to avoid duplicates on reconnect.
- Store the returned `script_tag_id` in the `shopify_integrations` row for cleanup later.

**3. `public/customizer-loader.js`**
- Already reads `data-user-id` from its own `<script>` tag. Add fallback: if no data attribute, parse `?uid=` from the script's own `src` URL. This makes the ScriptTag-injected version self-configuring.
- Bake API URL, base URL, and anon key as defaults inside the file (no `data-*` needed) so the script works standalone when Shopify loads it.

**4. New edge function: `supabase/functions/shopify-disconnect/index.ts`** (small)
- When a merchant disconnects, DELETE the registered ScriptTag from Shopify so we don't leave orphan scripts on their store.

**5. DB migration**
- Add `script_tag_id BIGINT` column to `shopify_integrations` table.

**6. UI update — `src/components/UniversalSnippetDialog.tsx` / Shopify connect screen**
- Add a banner: "Connected via OAuth — no script tag needed. Customize buttons will appear automatically on your product pages."
- The manual snippet stays available as a fallback for non-Shopify stores (WooCommerce, custom sites).

### What the merchant experiences

Before: Connect Shopify → copy script → open theme editor → paste in `theme.liquid` → save → test.

After: Connect Shopify → done. Product pages immediately get a "🎨 Customize This Product" button.

### Edge cases handled
- **Reconnect**: check existing ScriptTags before creating a new one (idempotent).
- **Disconnect**: delete the ScriptTag via stored `script_tag_id`.
- **Theme without standard anchors**: existing `autoInjectButton()` retry logic + fallback selectors already cover this.
- **Checkout pages**: ScriptTag doesn't load there (Shopify restriction) — irrelevant since we only need product pages.

### Files touched
- `supabase/functions/shopify-oauth-init/index.ts` (scope change)
- `supabase/functions/shopify-oauth-callback/index.ts` (register ScriptTag)
- `supabase/functions/shopify-disconnect/index.ts` (new)
- `public/customizer-loader.js` (self-configuring defaults + `?uid=` parsing)
- `src/components/UniversalSnippetDialog.tsx` + Shopify connect UI (messaging)
- DB migration: add `script_tag_id` column

### Out of scope
- WooCommerce already has the WP plugin doing the equivalent — no changes there.
- Custom/non-Shopify sites still use the manual snippet — that's unavoidable without a platform-level install hook.
