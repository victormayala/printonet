# Printonet main platform (SPA)

React + Vite + Supabase. Production traffic is served as **static files** from **`/srv/printonet-main-platform/dist/`** behind Nginx at **`https://platform.printonet.com`**.

## Documentation

- **Server layout, TLS, deploy, Woo integration:** workspace copy  
  **`printonet-multitenant/SERVER-GUIDE.md`** (sections **§12–§14**: SPA layout + operator summary + theme changelog).
- **This repo’s checklist & integration detail:** same workspace  
  **`printonet-multitenant/docs/main-platform-spa-inventory.md`**  
  (if you only have this clone, ask ops for that file or open the **printonet-multitenant** repo).

## Quick commands

```bash
cd /srv/printonet-main-platform/app
npm ci          # or npm install if lockfile drift
npm run build   # output: ./dist/
npm run test    # Vitest
```

Publish build (typical server):

```bash
sudo rsync -a --delete /srv/printonet-main-platform/app/dist/ /srv/printonet-main-platform/dist/
sudo nginx -t && sudo systemctl reload nginx
```

Or use **`sudo bash scripts/deploy-main-platform.sh`** from the **printonet-multitenant** workspace (sets **`APP_SRC`**, runs **`npm ci`**, rsync, reload).

## Env

Place **`/.env.production`** or **`.env.production.local`** next to this **`package.json`** (not committed). Client vars must be prefixed **`VITE_`**.

## Public integration files

Source lives in **`public/`** (copied into Vite **`dist/`** on build):

- **`customizer-sdk.js`** — storefront SDK (session, PDP attrs, review messaging).
- **`customizer-loader.js`** — lightweight loader for PDP buttons.
- **`customizer-studio-woocommerce.php`** — install on **tenant WordPress** as an MU-plugin; keeps **`wcAttributes`** / **`wcVariationId`** on customizer URLs.

## Important app paths

| Path | Role |
|------|------|
| `src/pages/EmbedCustomizer.tsx` | Session fetch, brand resolution, PDP merge |
| `src/pages/DesignStudio.tsx` | Fabric editor, export, variant/gallery images |
| `src/pages/ReviewDesign.tsx` | Complete screen, **`transferHostedCartToWoo`** |
| `src/lib/wooCart.ts` | Staged cart POST + redirect |
| `src/lib/variant-gallery.ts` | Per-side images from **`variant.gallery`** |
| `src/lib/woo-variant-match.ts` | PDP color string → inventory variant |

Legacy hostname **`app.printonet.com`** should **301** to **`platform.printonet.com`**; configure integrations with the **`platform`** URL only.
