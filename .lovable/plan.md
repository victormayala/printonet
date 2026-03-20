

# Embeddable Product Customizer — Integration API

## What We're Building

Transform the existing Design Studio into a platform-agnostic, embeddable customizer that any e-commerce store can integrate. Store owners feed products in via an API, customers customize them, and the finished design data + rendered images are sent back to the store's cart.

## Architecture

```text
┌─────────────────────┐       ┌──────────────────────┐
│  External Store     │       │  Customizer Studio   │
│  (Shopify, Woo,     │──────▶│                      │
│   custom, etc.)     │       │  /embed/:token       │
│                     │◀──────│  (iframe or popup)   │
│  Receives design    │       │                      │
│  data + PNG back    │       └──────────────────────┘
└─────────────────────┘
```

The integration works via two mechanisms:
1. **JavaScript SDK** — a small `<script>` tag store owners embed; it opens the customizer in an iframe/popup and communicates via `postMessage`.
2. **API Endpoint** — an edge function that accepts product data (name, images, variants) and returns a session token/URL to launch the customizer.

## Plan

### Step 1: Create Embed/Session Edge Function
- `POST /create-session` — accepts product data (name, category, image URLs for each side, variants) and returns a unique session ID + customizer URL.
- Stores session data in a new `customizer_sessions` table (session_id, product_data JSON, status, created_at, expires_at).
- No auth required (public API with optional API key for rate limiting later).

### Step 2: Create Embeddable Customizer Route
- New route `/embed/:sessionId` that loads the Design Studio in a minimal chrome (no nav, no back button, streamlined top bar).
- Reads product data from the session, populates the customizer exactly like inventory products do today.
- Adds a "Done" / "Add to Cart" button that:
  - Exports the canvas as a high-res PNG (per side).
  - Collects the Fabric.js JSON for each side.
  - Posts the result back to the parent window via `postMessage`.

### Step 3: Build the JavaScript SDK
- Small JS file (`/customizer-sdk.js`) served as a static asset.
- API: `CustomizerStudio.open({ product, onComplete, onCancel })`.
- Opens an iframe overlay or popup pointing to `/embed/:sessionId`.
- Listens for `postMessage` events and calls `onComplete` with design data (PNG URLs, canvas JSON, selected variant).

### Step 4: Export Design as PNG
- Add a canvas export function using Fabric.js `toDataURL()` for each side.
- Upload the exported PNGs to storage and return public URLs.
- Include both the rendered composite (design on product) and the design-only layer (transparent background, print-ready).

### Step 5: Create "Return to Cart" Edge Function
- `POST /complete-session` — stores the final design output (PNG URLs, JSON) against the session.
- External stores can poll or webhook to retrieve completed designs.
- Returns a standardized payload: `{ sessionId, sides: [{ view, designPNG, printReadyPNG, canvasJSON }], variant }`.

### Step 6: Integration Documentation Page
- New `/developers` page with:
  - Quick-start code snippets (HTML embed, SDK usage).
  - API reference for the session endpoints.
  - Webhook/callback configuration.

## Database Changes

New table: `customizer_sessions`
- `id` (uuid, PK)
- `product_data` (jsonb) — product info from external store
- `design_output` (jsonb, nullable) — completed design data
- `status` (text: 'active', 'completed', 'expired')
- `external_ref` (text, nullable) — store's own product/cart reference
- `created_at`, `updated_at`
- RLS: public read/write (sessions are ephemeral, identified by UUID)

New storage bucket: `design-exports` (public) for exported PNGs.

## Technical Details

- The SDK communicates via `window.postMessage` with origin validation.
- The embed route reuses the existing `DesignStudio` component but with an `embedMode` prop that hides navigation and changes the "Add to Cart" button to "Done".
- Fabric.js `toDataURL('png')` at full resolution for print-ready exports.
- Sessions expire after 24 hours (cleanup via a scheduled function or TTL).

## File Changes Summary

| File | Action |
|------|--------|
| `supabase/functions/create-session/index.ts` | New edge function |
| `supabase/functions/complete-session/index.ts` | New edge function |
| `public/customizer-sdk.js` | New SDK file |
| `src/pages/EmbedCustomizer.tsx` | New embed wrapper page |
| `src/pages/DesignStudio.tsx` | Add `embedMode` prop, PNG export, postMessage |
| `src/pages/Developers.tsx` | New integration docs page |
| `src/App.tsx` | Add `/embed/:sessionId` and `/developers` routes |
| DB migration | Create `customizer_sessions` table + `design-exports` bucket |

