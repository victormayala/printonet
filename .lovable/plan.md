## Goal

Replace the current rich `tenant-catalog-payload.json` with an example that matches the **`@printonet/medusa-backend`** webhook contract you uploaded. The receiving Medusa app only accepts a small, flat shape — anything richer gets ignored.

## What the contract actually requires

**Transport**
- `POST {baseUrl}/admin/printonet/events`
- `Content-Type: application/json`
- Header `x-printonet-signature: <hex HMAC-SHA256 of raw body using PRINTONET_WEBHOOK_SECRET>`

**Envelope (camelCase, top-level)**
- `id` — event id (idempotency key)
- `type` — `catalog.sync` (NOT `tenant.catalog.sync`)
- `tenantId`
- `occurredAt` — ISO-8601
- `payload` — `{ products: [...] }`, max 200 items per event

**Each product (flat — nested fields are ignored by the parser)**
- `id` *(required, string)*
- `name` *(required, string)*
- `description` *(optional, string)*
- `priceCents` *(required, integer ≥ 0 — cents, not dollars)*
- `currencyCode` *(optional, 3-letter ISO, e.g. `usd`)*

## Plan

1. **Overwrite `tenant-catalog-payload.json`** with a single example event matching the contract:
   - Real envelope fields (`id`, `type: "catalog.sync"`, `tenantId`, `occurredAt`, `payload.products[]`)
   - 3–4 representative products derived from `inventory_products` (Bella+Canvas tee, hoodie, mug, etc.) using:
     - `id` = inventory product UUID
     - `name` = product name
     - `description` = trimmed product description
     - `priceCents` = `Math.round(min(variant.price) * 100)` (lowest variant price → cents)
     - `currencyCode` = `"usd"`
   - Keep it under 200 products (we'll show ~4).

2. **Add a small companion file `tenant-catalog-payload.README.md`** in `/mnt/documents/` documenting:
   - The endpoint + headers
   - Exact HMAC pseudocode (Node `createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")`)
   - The mapping from our internal `inventory_products` row → flat `CatalogSyncProduct` (especially the `priceCents` derivation rule, since that's the one judgment call the bridge has to make)
   - A note that nested `variants` / `media` / `print_areas` from our DB are dropped at the bridge — if we want them on the Medusa side later, the contract has to be extended on their end first.

3. **Deliver both files** as `<lov-artifact>` tags.

## What I will NOT include

- The previous rich `pricing` / `variants` / `media` / `taxonomy` / `deletions` / `print_areas` / `sync.mode` blocks — the Medusa parser ignores them. Including them in the example would mislead whoever wires this up.
- A second "extended platform" example — your contract is explicit that the bridge must flatten before signing, so the example should already be flattened.

## Open question (only if you want a different choice)

Default `priceCents` rule: **lowest variant price × 100, rounded**. If you'd rather use `base_price` from `inventory_products` directly (even when variants override it), say so and I'll switch the rule in step 1 + the README.
