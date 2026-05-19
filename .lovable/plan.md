
# Plan: VPS-hosted DAM for `product-images`

## Goal

Stop new catalog mockup uploads from filling Lovable Cloud Storage. Route them to a self-hosted DAM on your VPS, served as public URLs (like today) so the Customizer/Fabric.js canvas keeps working with zero changes downstream. Existing Lovable URLs keep working — no migration.

## End-state architecture

```text
 Browser (Dashboard / Customizer)
        |
        | 1. ask for upload URL
        v
 Supabase Edge Function: dam-sign-upload
        | (HMAC-signs a short-lived PUT URL for MinIO)
        v
 VPS  ── Nginx (TLS) ──► MinIO  (bucket: product-images)
                            ▲
                            │ 2. PUT file directly from browser
                            │
 Browser ────────────────────┘
        |
        | 3. save returned public URL in DB
        v
 Supabase row (products.image_url = https://dam.printonet.com/product-images/<key>)
```

Reads stay identical to today: `<img src="https://dam.printonet.com/...">`. No proxying through edge functions.

## VPS setup (we'll script this for you, you run it)

What you need on the VPS:
1. A subdomain pointed at the VPS (e.g. `dam.printonet.com`).
2. Docker + docker-compose installed.
3. Ports 80/443 open.

We'll deliver a `docker-compose.yml` + Nginx config that provisions:
- **MinIO** — S3-compatible object store, single bucket `product-images` set to **public read**.
- **Nginx** — TLS termination via Let's Encrypt (Certbot), reverse-proxy to MinIO on `dam.printonet.com`, with required CORS headers so Fabric.js canvas reads don't taint:
  - `Access-Control-Allow-Origin: *` (or the list of tenant origins)
  - `Access-Control-Allow-Methods: GET, HEAD`
  - `Cross-Origin-Resource-Policy: cross-origin`
- **Cache headers** — `Cache-Control: public, max-age=31536000, immutable` for `/product-images/*` (keys are content-addressed so this is safe).
- Optional: Cloudflare in front of `dam.printonet.com` for free CDN + DDoS — recommended.

Credentials needed back from you to wire into Lovable:
- `DAM_S3_ENDPOINT` (e.g. `https://dam.printonet.com`)
- `DAM_S3_REGION` (any, e.g. `us-east-1` — MinIO ignores)
- `DAM_S3_ACCESS_KEY` + `DAM_S3_SECRET_KEY` (MinIO service account, scoped to `product-images` bucket, write-only)
- `DAM_PUBLIC_BASE_URL` (likely same as endpoint)

## Lovable-side changes

### New edge function: `dam-sign-upload`
- Auth: requires logged-in user, RLS-style ownership check (user owns the target product / store).
- Input: `{ filename, contentType, size, scope: "product-images", storeId?, productId? }`.
- Validates content-type (`image/*`), size (≤ ~25 MB), filename sanitization.
- Generates a content-addressed key: `tenants/<user_id>/<storeId>/<uuid>.<ext>`.
- Uses AWS SigV4 (via `npm:@aws-sdk/s3-request-presigner`) against MinIO endpoint to mint a 5-minute PUT URL.
- Returns `{ upload_url, public_url, key }`.

### Frontend
- A small `useDamUpload()` hook that: calls `dam-sign-upload` → `fetch(upload_url, { method: "PUT", body: file })` → returns `public_url`.
- Swap the existing `product-images` upload paths to use it:
  - `src/components/StoreCustomizableProducts.tsx`
  - `src/components/CategoriesManager.tsx`
  - any other place that currently calls `supabase.storage.from("product-images").upload(...)` (we'll audit before coding).
- All other buckets (`design-exports`, `brand-assets`, `template-thumbnails`, `corporate-store-assets`) keep using Lovable Cloud Storage — untouched.

### Database
- No schema changes required: `image_url` columns already store full URLs. Mix of `…supabase.co/storage/v1/…` and `https://dam.printonet.com/…` URLs is fine.
- Optional: add a `storage_provider` text column on the products table for future analytics. Not required for it to work.

### Customizer / SDK compatibility
- `proxy-image` edge function (Canvas CORS proxy) already handles cross-origin mockups by base64-encoding them. With proper CORS headers on Nginx it will rarely be needed for DAM URLs — but it's a free safety net.
- Print fulfillment public URLs, WooCommerce/Shopify exports, embed SDK all consume whatever URL is stored — no changes.

## Rollout

1. You stand up the VPS (we hand you compose file + Nginx config + a setup README).
2. You give us the 4 secrets above; we add them via the secrets tool.
3. We deploy `dam-sign-upload` and switch the product-image upload paths.
4. Smoke test: upload a mockup → confirm `dam.printonet.com` URL is saved → confirm it loads in the Customizer canvas without tainting.

## Risks & notes

- **CORS misconfiguration** is the most common failure mode — we'll include a verification curl in the README.
- **Bucket made private by accident** → images 403. Public read policy is part of the compose bootstrap.
- **No Cloudflare** → all bandwidth hits the VPS. Recommended but optional.
- **Backups** — MinIO data dir should be on a backed-up volume; out of scope for this plan but worth flagging.
- This plan **only covers `product-images`**. If you later want to move `design-exports` (the high-volume one), it's the same pattern but with signed-read URLs for print fulfillment privacy — happy to plan that separately.

Approve and I'll start with the edge function + compose bundle.
