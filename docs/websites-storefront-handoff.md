# Websites → Storefront Handoff Spec

Implementation contract for serving Printonet **websites** (CMS sites) from the SSR storefront app at `stores.printonet.com`. The platform app (`platform.printonet.com`) remains the admin/CMS; the storefront becomes the public renderer.

The goal is **real SEO** — server-rendered HTML, accurate per-page meta tags, valid social previews, sitemap/robots, and JSON-LD. The current Vite SPA renderer at `platform.printonet.com/sites/:slug` does not satisfy this and stays only as a temporary preview.

---

## 1. Architecture

```
platform.printonet.com (Vite SPA — admin)        stores.printonet.com (SSR — public)
─────────────────────────────────────────        ────────────────────────────────────
• Dashboard / editors                            • /sites/:slug, /sites/:slug/blog…
• Writes to Supabase                ── Supabase ▶ • Reads from Supabase (anon key)
• Temporary /sites/:slug preview      RLS read   • SEO, sitemap, robots, JSON-LD
```

The storefront talks directly to Supabase with the **anon publishable key**. Public-read RLS policies already exist on every table listed below — no proxy, no HMAC, no edge function needed for site reads.

Supabase project: same project that powers stores (`PRINTONET_STOREFRONT_URL` already points at the storefront app; reuse its existing Supabase client).

---

## 2. Routes to implement

All routes are SSR, return real HTTP status codes, and serve fully rendered HTML.

| Path | Purpose | 404 if |
|---|---|---|
| `GET /sites/:slug` | Site home — renders page with slug `home`, falls back to first published page | site missing/inactive |
| `GET /sites/:slug/:pageSlug` | Content page | page not published |
| `GET /sites/:slug/blog` | Blog index — list of published posts | site missing |
| `GET /sites/:slug/blog/:postSlug` | Blog post | post not published |
| `GET /sites/:slug/sitemap.xml` | Per-site sitemap | site missing |
| `GET /sites/:slug/robots.txt` | Per-site robots | — (always serve) |

### Reserved page slugs

The platform validates these as reserved in `src/lib/cms.types.ts`. The storefront must treat them as 404 (or as future native routes), never look them up as content pages:

```
admin, account, cart, checkout, contact, favorites, orders, p,
privacy, products, returns, shipping, sitemap.xml, terms, robots.txt
```

`blog` is also implicitly reserved (it's a built-in route).

---

## 3. Data fetching contract

Use the Supabase JS client with the anon key. These are the exact queries the working reference renderer (`src/pages/PublicWebsite.tsx`) uses today. RLS already restricts results to active website-type stores and published content; you don't need extra filtering for security, only for correctness.

### 3.1 Site lookup (every route)

```ts
supabase
  .from("corporate_stores")
  .select("id, name, tenant_slug, store_type, status, primary_color, accent_color, font_family, logo_url, secondary_logo_url, favicon_url, custom_domain")
  .eq("tenant_slug", slug)
  .eq("store_type", "website")
  .eq("status", "active")
  .maybeSingle();
```

If `null` → HTTP 404 with a generic "site not found" page (no leak).

### 3.2 Pages (home, content page)

```ts
supabase
  .from("site_pages")
  .select("id, slug, title, sort_order, enabled, published_data, published_at, seo_title, seo_description, og_image_url")
  .eq("store_id", site.id)
  .eq("enabled", true)
  .not("published_at", "is", null)
  .order("sort_order", { ascending: true });
```

- `published_data` is JSON. Extract blocks via:
  ```ts
  function extractBlocks(d: any): any[] {
    if (!d) return [];
    if (Array.isArray(d)) return d;
    if (Array.isArray(d.blocks)) return d.blocks;
    return [];
  }
  ```
- Each block has `{ id, block_type, enabled, data | published_data | draft_data }`. Render `data ?? published_data ?? draft_data`. Skip blocks where `enabled === false`.

### 3.3 Navigation

```ts
supabase
  .from("site_navigation")
  .select("location, items")
  .eq("store_id", site.id);
```

- Two rows max: `location ∈ {"header", "footer"}`.
- `items: { label: string; href: string; open_in_new_tab?: boolean }[]`.
- If `header` is empty, fall back to listing published pages in `sort_order`.

### 3.4 Blog posts

Index:

```ts
supabase
  .from("blog_posts")
  .select("id, slug, title, excerpt, hero_image_url, published_at, seo_title, seo_description, og_image_url, author_id")
  .eq("store_id", site.id)
  .eq("status", "published")
  .not("published_at", "is", null)
  .lte("published_at", new Date().toISOString())
  .order("published_at", { ascending: false });
```

Single post: same filter plus `.eq("slug", postSlug)` + select `body_md, tags`.

Optional joins (also RLS-public):
- `blog_authors` by `author_id` → `name, avatar_url, bio`
- `blog_post_categories` + `blog_categories` for tagging

`body_md` is Markdown — render with a safe Markdown library (e.g. `react-markdown` + `rehype-sanitize`).

---

## 4. Block renderer contract

Source of truth for block shapes: **`src/lib/cms.types.ts`** in the platform repo. The Zod schemas there are the canonical definitions — copy or import them into the storefront repo and keep in sync.

Block types to support (v1):

| `block_type` | Notes |
|---|---|
| `hero` | `headline`, `subhead`, `image_url`, primary + secondary CTA, `alignment` |
| `value_props` | Heading + 1–6 `{icon, title, body}` items |
| `featured_categories` | Heading + `category_slugs[]` — look up via `product_categories` |
| `featured_products` | Heading + `store_product_ids[]` — look up via `corporate_store_products` joined to `inventory_products` |
| `testimonials` | Heading + 1–8 `{quote, author, role, avatar_url}` |
| `cta_banner` | Headline, body, CTA, optional `background_image_url` |
| `rich_text` | Markdown (max 50k chars) |
| `category_bento` | 1–6 tiles, first spans 2×2 |
| `two_column_banners` | Exactly 1–2 promo banners |
| `three_column_banners` | Exactly 1–3 promo banners |
| `benefits_grid` | 1–4 cards with eyebrow/title/body/accent_color |

**Visual parity reference:** `src/components/cms/BlockPreview.tsx` is the working v1 renderer. Initial storefront version should match it visually so editor preview ≈ live site.

Unknown block types must be ignored (forward-compatible).

---

## 5. Theme application

Pulled from the `corporate_stores` row:

```ts
<div style={{
  ['--site-primary']: site.primary_color,   // hex
  ['--site-accent']:  site.accent_color,    // hex
  fontFamily:         site.font_family,     // Google Font name
}}>
```

- Convert primary/accent to HSL too if your storefront uses HSL tokens.
- Inject the Google Font (`site.font_family`) via `<link rel="stylesheet">` in `<head>` per request.
- Use `site.logo_url` in the header, `site.favicon_url` as `<link rel="icon">`, `site.secondary_logo_url` in the footer if present.

---

## 6. SEO requirements (the whole reason for this move)

Every public route must emit, server-side:

### 6.1 `<head>` per route

```html
<title>{seoTitle}</title>
<meta name="description" content="{seoDescription}">
<link rel="canonical" href="https://stores.printonet.com/sites/{slug}/{path}">
<link rel="icon" href="{site.favicon_url}">

<meta property="og:type"        content="website | article">
<meta property="og:title"       content="{seoTitle}">
<meta property="og:description" content="{seoDescription}">
<meta property="og:url"         content="{canonical}">
<meta property="og:image"       content="{ogImage}">   <!-- only if present -->
<meta property="og:site_name"   content="{site.name}">

<meta name="twitter:card"  content="summary_large_image">
<meta name="twitter:title" content="{seoTitle}">
<meta name="twitter:description" content="{seoDescription}">
<meta name="twitter:image" content="{ogImage}">         <!-- only if present -->
```

### 6.2 Title / description resolution

| Route | `seoTitle` | `seoDescription` |
|---|---|---|
| Home | `page.seo_title || site.name` | `page.seo_description` |
| Page | `(page.seo_title || page.title) + " · " + site.name` | `page.seo_description` |
| Blog index | `"Blog · " + site.name` | site-level fallback |
| Blog post | `(post.seo_title || post.title) + " · " + site.name` | `post.seo_description || post.excerpt` |

`ogImage` resolves in order: route-level `og_image_url` → site default → omit (do not emit a placeholder; missing previews better than broken).

### 6.3 JSON-LD

Emit appropriate schema.org JSON-LD per route:

- **Every route:** `Organization` for the site (`name`, `logo`, `url`).
- **Blog post:** `Article` (`headline`, `datePublished`, `image`, `author.name`).
- **Nested routes:** `BreadcrumbList` (Home → Section → Page).

### 6.4 Status codes

- Site not found → HTTP **404**
- Page/post not published → HTTP **404**
- Site exists but slug-level capture fails → HTTP **404** (never 200 with empty body)

### 6.5 `robots.txt`

```
User-agent: *
Allow: /sites/{slug}/
Sitemap: https://stores.printonet.com/sites/{slug}/sitemap.xml
```

Owners may want noindex per site in a future iteration; for v1 always allow.

### 6.6 `sitemap.xml`

One `<url>` entry per:
- `/sites/{slug}` (home)
- Each published `site_pages` row → `/sites/{slug}/{page.slug}`
- `/sites/{slug}/blog` (if any posts)
- Each published `blog_posts` row → `/sites/{slug}/blog/{post.slug}`

Each entry includes `<lastmod>` from `published_at` and `<changefreq>weekly</changefreq>`.

---

## 7. Storefront env vars

Reuse the storefront's existing Supabase client. If it isn't already wired:

```
SUPABASE_URL=https://qumrnazgdrijdcihtkah.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_-28LXo1HXj_t6An4cfWsow_ZTQghv_J
```

Anon key is safe to ship to the browser (already exposed by the platform). All site reads work under anon RLS — no service role needed.

---

## 8. Caching

Recommendation: ISR / `revalidate: 60–300s` per route, with a `revalidatePath`/purge call triggered by a webhook from the platform on publish (out of scope for v1; document as a follow-up).

For v1, plain CDN caching with a short TTL (60s) is acceptable.

---

## 9. Out of scope (explicitly)

- **Custom domains per site** (`acme.com → /sites/acme`) — DB column `corporate_stores.custom_domain` exists; routing layer can be added later.
- **Publish webhooks** from platform → storefront for cache invalidation.
- **Form submissions** (contact forms etc.).
- **Removing the in-app `/sites/:slug` preview renderer** — happens after storefront ships its version and we redirect.

---

## 10. Open questions for the storefront team

1. Which framework lifecycle handles SSR head meta in the storefront (Next.js `generateMetadata`, Remix `meta`, custom)? The spec assumes whichever it is can emit head tags before HTML is sent.
2. Where does the storefront's existing 404 page live, and should we reuse it for site-not-found and page-not-found, or render a site-themed 404?
3. Markdown renderer — does the storefront already include one for any existing content? If yes, reuse it.
4. Image hosts — `cms_media`, `corporate-store-assets`, and any external URLs need to be allow-listed if the storefront uses Next/Image or similar.

---

## 11. Reference

- Working v1 renderer (Vite SPA, no SEO): `src/pages/PublicWebsite.tsx`
- Block visual parity reference: `src/components/cms/BlockPreview.tsx`
- Block Zod schemas (single source of truth): `src/lib/cms.types.ts`
- Database tables + RLS policies: see Lovable project Supabase tables — `corporate_stores`, `site_pages`, `site_navigation`, `blog_posts`, `blog_authors`, `blog_categories`, `blog_post_categories`, `cms_media`.
