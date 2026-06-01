## Goal

Move the public website rendering from this Vite SPA to the SSR storefront app at `stores.printonet.com`, so sites get real SEO, working social previews, and AI search visibility. This Lovable project remains the **admin/CMS** for sites; the storefront becomes the public renderer.

## Split of responsibilities

```text
┌─────────────────────────────────────┐        ┌───────────────────────────────────────┐
│  platform.printonet.com (THIS app)  │        │  stores.printonet.com (storefront)    │
│  ────────────────────────────────   │        │  ──────────────────────────────────   │
│  • Dashboard: Websites list         │        │  • Public SSR renderer for sites      │
│  • Editors: pages / blog / nav /    │        │  • /sites/:slug, /sites/:slug/blog…   │
│    theme / SEO                      │  Supa  │  • <title>, meta, og:*, JSON-LD       │
│  • Media upload (cms_media)         │ ─────▶ │  • sitemap.xml, robots.txt            │
│  • Temporary /sites/:slug preview   │  RLS   │  • Theme application                  │
│  • Write data to Supabase           │  read  │  • Block renderer (parity w/ admin)   │
└─────────────────────────────────────┘        └───────────────────────────────────────┘
```

The storefront reads **directly from Supabase** with the anon key. Public-read RLS policies already exist on `corporate_stores`, `site_pages`, `site_navigation`, `blog_posts`, `blog_authors`, `blog_categories`. No proxy or HMAC needed for site reads.

## Changes I will make in this Lovable project

1. **Leave `src/pages/PublicWebsite.tsx` and its routes in place** — keeps the in-app `/sites/:slug` preview live so existing links don't break while the storefront-side renderer is being built.
2. **Update the "Public URL" shown in the dashboard** (`src/pages/Websites.tsx` and `src/pages/WebsiteDetails.tsx`) to point at the final URL `https://stores.printonet.com/sites/<slug>` instead of `https://platform.printonet.com/sites/<slug>`. Add a small "preview on platform" secondary link that opens the in-app renderer.
3. **Write the handoff spec** to `docs/websites-storefront-handoff.md`. This is the deliverable you'll hand to whoever builds the storefront side.

No DB migrations. No edge function changes. No removal of in-app renderer yet.

## What the handoff spec will contain

- **Routes to add on the storefront**
  - `GET /sites/:slug` — home (renders the page with slug `home`, or the first published page)
  - `GET /sites/:slug/:pageSlug` — content page
  - `GET /sites/:slug/blog` — blog index
  - `GET /sites/:slug/blog/:postSlug` — blog post
  - `GET /sites/:slug/sitemap.xml` — sitemap per site
  - `GET /sites/:slug/robots.txt` — per-site robots (mostly `Allow: /`)
- **Reserved slug list** — must not collide with `RESERVED_PAGE_SLUGS` in `src/lib/cms.types.ts` (admin, account, cart, checkout, etc.)
- **Data fetching contract** — exact Supabase queries to use, copied from `src/pages/PublicWebsite.tsx`:
  - Site: `corporate_stores` where `tenant_slug = :slug AND store_type = 'website' AND status = 'active'`
  - Pages: `site_pages` where `store_id = ... AND enabled = true AND published_at IS NOT NULL`
  - Navigation: `site_navigation` rows (header/footer)
  - Posts: `blog_posts` where `status='published' AND published_at <= now()`
- **Block renderer contract** — list of block types and data shapes from `src/lib/cms.types.ts` (`hero`, `value_props`, `featured_categories`, `featured_products`, `testimonials`, `cta_banner`, `rich_text`, `category_bento`, `two_column_banners`, `three_column_banners`, `benefits_grid`). The storefront must render each type. Initial visual parity reference: `src/components/cms/BlockPreview.tsx`.
- **Theme application** — apply `primary_color`, `accent_color`, `font_family` as CSS variables (`--site-primary`, `--site-accent`). Use `favicon_url`, `logo_url`, `secondary_logo_url`.
- **SEO requirements per route** (the whole point of the move)
  - Per-page `<title>` = `{page.seo_title || page.title} · {site.name}`
  - Per-page `<meta name="description">` from `seo_description`
  - `<link rel="canonical">` = `https://stores.printonet.com/sites/<slug>/<path>`
  - Open Graph: `og:title`, `og:description`, `og:url`, `og:image` (from `og_image_url`)
  - Twitter card tags
  - JSON-LD: `Article` on blog posts, `BreadcrumbList` on nested routes, `Organization` from site name/logo
  - 404s return real HTTP 404 status
- **sitemap.xml shape** — one entry per published page + blog post, with `lastmod` from `published_at`
- **Anon-key Supabase config** — env vars to add on the storefront (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` equivalents)
- **Caching guidance** — ISR/revalidate strategy; invalidate on publish via a webhook from this app (out of scope for v1, called out)
- **Open questions** flagged at the bottom for the storefront team
- **Reference implementation** — pointer to `src/pages/PublicWebsite.tsx` as the working v1 reference

## Out of scope (called out explicitly in the spec)

- Custom domains per site (e.g. `acme.com → /sites/acme`) — future
- Publish webhooks for cache invalidation — future
- Form submissions / contact forms — future
- Removing the in-app preview renderer — happens after storefront side ships

## Files touched in this project

- `src/pages/Websites.tsx` — update Public URL display
- `src/pages/WebsiteDetails.tsx` — update Public URL display
- `docs/websites-storefront-handoff.md` — new file (the spec)
