# Wire `/sites/<slug>` data contract on the platform

The storefront's `/sites/<slug>` renderer is ready. The platform currently exposes **stores** end-to-end but exposes **websites** only partially: the tenant resolver doesn't surface them as `store_type=website`, the editor lacks upload UI, and the Pages/Nav/Blog editors write only to local platform tables — they never publish to the storefront's `tenant_*` tables through `cms-proxy`. This plan closes those gaps.

---

## 1. Tenant resolver (`resolve_tenant`)

Add a new op in `supabase/functions/platform-rpc/index.ts`:

- **Op:** `resolve_tenant`
- **Input:** `{ tenant_slug?: string, domain?: string }`
- **Looks up** `corporate_stores` by slug OR `custom_domain`, `status='active'`.
- **Returns** exactly the fields the renderer needs:
  `id, name, tenant_slug, store_type, status, logo_url, secondary_logo_url, favicon_url, primary_color, accent_color, font_family, custom_domain`.
- No filter on `store_type` — both `retail` and `website` resolve.

Also add `store_type` to the SELECT in the existing `get_store_by_slug` / `get_store_by_domain` / `get_store_with_products` ops so the storefront can route correctly (currently omitted).

No DB migration — `store_type` already exists on `corporate_stores` with values `retail` and `website`.

## 2. Branding uploads in the website editor

Today `WebsiteDetails.tsx` → `BrandingPanel` only accepts URL strings for `logo_url` and `favicon_url`, and is missing `secondary_logo_url` entirely.

Rebuild that panel using the same upload pattern as the store onboarding (`StoreBrandSettings.tsx` / `StoreBrandingTab.tsx`) — upload to the `corporate-store-assets` bucket, write the resulting URL onto the `corporate_stores` row:

- Logo (header) — required
- Secondary logo (footer) — optional, **new field**
- Favicon — recommended
- Primary color / accent color pickers — keep
- Font family picker (Google Fonts list) — upgrade from free-text Input to the same Combobox used in store branding

## 3. Publish website CMS to the storefront

Today `WebsitePagesPanel`, `WebsiteNavigationEditor`, and `WebsiteBlogPanel` write only to the platform's `site_pages` / `site_navigation` / `blog_posts` tables. The storefront expects content in its own `tenant_site_settings`, `tenant_homepage_blocks`, `tenant_content_pages`, `tenant_nav_items` tables, populated by the platform calling `cms-proxy` (which forwards to `${PRINTONET_SITES_URL}/api/public/cms/*`).

Bring websites onto the same publish path that stores already use via `StoreContentCMS.tsx`:

- **Site settings** (announcement bar, footer, social, contact, default OG image) — publish via `cms-proxy` action `site-settings-publish` using `siteSettingsSchema`.
- **Homepage blocks** — publish via `cms-proxy` action `homepage-blocks-publish`. **Filter out** `featured_products` and `featured_categories` when `store.store_type === 'website'` — both in the block-picker UI and in the publish payload.
- **Content pages** — publish via `cms-proxy` action `content-page-publish` (and `…-unpublish`/`…-delete`). Validate slugs against `RESERVED_PAGE_SLUGS`.
- **Navigation** — publish via `cms-proxy` action `nav-publish` for both `header` and `footer` rows.

The simplest path: in `WebsiteDetails.tsx` replace the current Pages/Navigation tabs with a single **Content** tab that renders `<StoreContentCMS storeId={site.id} variant="website" />`, and pass a `variant` prop so it:

- Hides the `featured_products` and `featured_categories` block options.
- Hides store-only sections (shipping/tax/products) that don't apply.
- Keeps the existing publish-version + schema-version checks (`PLATFORM_CMS_SCHEMA_VERSION = 8`).

Keep the existing Blog tab (`WebsiteBlogPanel`) but add a publish action that calls `cms-proxy` `blog-post-publish` so posts land in the storefront's `tenant_blog_posts` (if/when the storefront uses one — leave a TODO and surface a clear toast if the upstream action 404s).

## 4. Hide store-only blocks for websites

In `src/components/cms/blockMeta.ts` add a `contexts: ('store' | 'website')[]` field per block type. Default to both; mark `featured_products` and `featured_categories` as `['store']`. `BlockEditor` / block picker reads this when in the website variant.

## 5. Update the handoff spec

`docs/websites-storefront-handoff.md` currently describes a Supabase-anon-key direct-read approach. Replace that with the actual contract the storefront uses today:

- Resolver: `platform-rpc` `resolve_tenant` (auth header + HMAC as already used by the storefront for stores).
- CMS data: the storefront reads from its own `tenant_*` tables; the platform pushes via `cms-proxy` actions listed above.
- SEO / sitemap / robots requirements stay as-is.

---

## Technical details

**Files to change**

- `supabase/functions/platform-rpc/index.ts` — add `resolve_tenant` op; add `store_type` to existing store-lookup selects.
- `src/pages/WebsiteDetails.tsx` — replace Pages/Navigation tabs with `StoreContentCMS` (website variant); extend `BrandingPanel` (uploads + secondary logo + font combobox).
- `src/components/StoreContentCMS.tsx` — accept `variant?: 'store' | 'website'`; gate UI sections; filter block types; filter publish payload.
- `src/components/cms/blockMeta.ts` — add `contexts` to each block; mark `featured_products`/`featured_categories` as store-only.
- `src/components/cms/BlockEditor.tsx` — read `contexts` from blockMeta in the block picker.
- `src/components/WebsiteBlogPanel.tsx` — add publish-to-storefront call via `cms-proxy`.
- `docs/websites-storefront-handoff.md` — rewrite sections 1–3 to match the actual proxy-based contract.

**No DB migration required.** All needed columns (`store_type`, `secondary_logo_url`, `favicon_url`, `primary_color`, `accent_color`, `font_family`, `custom_domain`) already exist on `corporate_stores`.

**Open question (worth confirming before I build):** the existing `WebsitePagesPanel` / `WebsiteNavigationEditor` write to platform-local `site_pages` / `site_navigation` tables. If those tables are no longer used by anything (the renderer at `platform.printonet.com/sites/:slug` is the only consumer), we can remove them after the storefront cutover. For now I'll keep them as a local working-draft store and add the publish step on top — same dual-write pattern stores use.
