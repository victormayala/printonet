## Goal

Let users create **informational websites** (no products, cart, checkout, Stripe, shipping, tax) using the same dashboard/CMS authoring experience as storefronts. Add a **blog** on top, and serve sites from a **separate hosted target** (e.g. `sites.printonet.com`) instead of the storefront engine.

## High-level approach

1. Introduce `store_type = 'website'` on the existing `corporate_stores` table. Reuse stores, CMS proxy, themes, media library, custom domain, white-labeling — but hide every commerce surface when `store_type = 'website'`.
2. Add a **multi-page builder** plus a **navigation menu editor** so a website can have About / Services / Contact / custom pages with their own block lists and SEO.
3. Add a **blog**: posts, categories, authors, tags, per-post SEO, hero image, scheduled publish.
4. New top-level **"Websites"** section in the dashboard, parallel to **Corporate Stores**, backed by the same `corporate_stores` row filtered by `store_type='website'`.
5. New hosted target on the upstream service (`sites.printonet.com`) that renders websites without any commerce chrome. The dashboard publishes via the existing `cms-proxy` edge function with a new action namespace.

## Dashboard surface

### New routes
- `/websites` — list (mirrors `/corporate-stores`, queries `corporate_stores` where `store_type='website'`)
- `/websites/:id` — detail page with tabs:
  - **Overview** — domain, status, "View site" link
  - **Pages** — multi-page builder. Each page = block list reusing existing `BlockEditor`. Per-page SEO.
  - **Navigation** — header/footer menu editor (label + href + open-in-new-tab)
  - **Blog** — posts list, create/edit post (title, slug, excerpt, hero image, markdown body, categories, tags, author, status: draft/scheduled/published, publish_at, SEO)
  - **Branding** — reuse `StoreIdentityTab` + `StoreBrandingTab` + `StoreThemeTab` (no Customizer tab, no Developers tab)
  - **Settings** — contact info, social links, footer, announcement bar (reuse `SiteSettingsEditor`)
  - **Domain** — custom domain setup (reuse existing flow, pointed at the new hosted target)
- Hidden for websites: Customizable Products, Shipping & Tax, Customers, Orders, Stripe Connect, Push to Store.

### New "New Website" dialog
- Fork of `NewStoreDialog`: name, contact email, slug, primary color, font. Sets `store_type='website'`. No `default_price_source`, no Stripe onboarding. Status goes straight to `active`.

### Sidebar
- Add **"Websites"** entry in `DashboardSidebar` alongside "Corporate Stores" with `Globe` icon.

### Component reuse
- Reused unchanged: `BlockEditor`, `SiteSettingsEditor`, `MediaLibraryDialog`, `StoreThemePicker`, `StoreBrandingTab`, `StoreIdentityTab`, `StoreThemeTab`.
- New: `WebsitePagesPanel`, `WebsiteNavigationEditor`, `WebsiteBlogPanel`, `BlogPostEditor`, `NewWebsiteDialog`.

## Backend / data

### Migration
- Widen `corporate_stores.store_type` to allow `'website'` (currently `'corporate' | 'retail'`).
- New tables (all owner-scoped RLS via `auth.uid() = user_id`, public read for published rows for the renderer):
  - `site_pages` (store_id, slug, title, sort_order, enabled, draft_data, published_data, published_at, seo_title, seo_description, og_image_url)
  - `site_navigation` (store_id, location: 'header'|'footer', items jsonb)
  - `blog_posts` (store_id, slug, title, excerpt, body_md, hero_image_url, status, publish_at, seo_*, author_id, draft + published copies)
  - `blog_categories` (store_id, slug, name)
  - `blog_post_categories` (post_id, category_id)
  - `blog_authors` (store_id, name, avatar_url, bio)
- Each `CREATE TABLE` followed by GRANTs and RLS policies per project rules.

### Edge function
- Extend `cms-proxy` with new actions: `list-pages`, `upsert-page`, `publish-page`, `delete-page`, `reorder-pages`, `get-navigation`, `set-navigation`, `list-posts`, `upsert-post`, `publish-post`, `delete-post`, `list-blog-categories`, …
- Route to the new hosted target when the target store has `store_type='website'`. New env var `PRINTONET_SITES_URL` on the edge function. Existing storefront actions unchanged.

### Skipped for websites
- Stripe Connect, `corporate_store_shipping_zones`, `corporate_store_volume_discounts`, `corporate_store_products`, orders, checkout.

## Hosted renderer (sites.printonet.com)

Owned by the upstream service. This plan only covers what the Printonet dashboard sends. Contract:
- `GET /api/public/cms/:slug/site` → settings, theme, navigation
- `GET /api/public/cms/:slug/page/:pageSlug` → published page blocks
- `GET /api/public/cms/:slug/blog` → published posts (paginated)
- `GET /api/public/cms/:slug/blog/:postSlug` → single post

Follow-up task on the upstream repo. The dashboard surfaces the public URL once `PRINTONET_SITES_URL` is configured.

## Technical details

### Files added
- `src/pages/Websites.tsx`
- `src/pages/WebsiteDetails.tsx`
- `src/components/WebsitePagesPanel.tsx`
- `src/components/WebsiteNavigationEditor.tsx`
- `src/components/WebsiteBlogPanel.tsx`
- `src/components/BlogPostEditor.tsx`
- `src/components/NewWebsiteDialog.tsx`

### Files modified
- `src/App.tsx` — register `/websites`, `/websites/:id`
- `src/components/DashboardSidebar.tsx` — add nav entry
- `src/types/corporateStore.ts` — widen `store_type` union to include `'website'`
- `src/pages/CorporateStores.tsx` — exclude website rows from the store list
- `supabase/functions/cms-proxy/index.ts` — route by store_type, add page/nav/blog actions

### Migrations
- One migration: widen `store_type`, create the 5 new tables with GRANTs + RLS.

### Out of scope
- Upstream `sites.printonet.com` renderer (separate codebase/deploy)
- DNS automation for `sites.printonet.com` subdomains
- Migrating existing retail/corporate stores into website type

## Rollout order

1. Migration (new tables + `store_type` widen).
2. Sidebar entry + `/websites` list + `New Website` dialog.
3. `/websites/:id` shell with Branding / Settings / Domain tabs (reused).
4. Pages tab (multi-page block builder).
5. Navigation editor.
6. Blog (posts → categories → authors).
7. `cms-proxy` routing + new actions.
8. Document upstream API contract for the renderer team.
