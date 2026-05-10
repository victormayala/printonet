## Goal

Enable each shop owner's provisioned store to accept payments that flow **directly into their own Stripe Connect Express account** (created during onboarding). Printonet never touches the funds.

## Where we are today

- Onboarding step 3 creates a Stripe Express account per store and stores `stripe_account_id` + capability flags on `corporate_stores`.
- `stripe-connect-onboard` and `stripe-connect-status` edge functions exist.
- Customizer sessions, design output, and Woo order files already exist — but checkout currently has no path that charges the merchant's Stripe account.

## What "connecting payments" means

For a customer buying on a shop owner's store, we need a checkout that:
1. Knows which `corporate_stores.stripe_account_id` to charge.
2. Creates a Stripe Checkout Session **on behalf of that connected account** (`stripeAccount` header / `on_behalf_of`).
3. Optionally takes an `application_fee_amount` for Printonet (platform fee).
4. Returns success → writes an `orders` row + marks the customizer session complete.

## Plan

### 1. Gate the storefront on Stripe readiness
- In `corporate_stores`, treat a store as "payments-ready" only when `stripe_charges_enabled = true`.
- Surface state in the dashboard: Connected ✅ / Pending ⏳ / Action required ⚠ with a "Resume Stripe onboarding" button (re-uses `stripe-connect-onboard` to mint a fresh Account Link).
- Block "Publish store" / hide checkout button on the storefront until `charges_enabled`.

### 2. New edge function: `create-store-checkout`
Replaces/augments today's checkout creation. Inputs: `storeId`, `sessionId` (customizer session), `lineItems`, `returnUrl`.

Logic:
- Load `corporate_stores` by `storeId`; require `stripe_charges_enabled`.
- Build a Stripe Checkout Session with:
  - `ui_mode: "embedded_page"` (per our standard)
  - `payment_intent_data: { application_fee_amount, on_behalf_of: acct }` — or pass `{ stripeAccount: acct }` as request option for a **direct charge** model.
  - `metadata: { customizer_session_id, store_id, user_id }`
- Return `clientSecret`.

Decision needed: **Direct charges** (recommended for Express — funds settle on merchant, simpler liability) vs **Destination charges** (Printonet is merchant of record). See "Open questions".

### 3. Platform fee model
Add a `platform_fee_bps` (or fixed) column on `corporate_stores` (default e.g. 500 = 5%). `create-store-checkout` computes `application_fee_amount = round(total * bps / 10000)`. Printonet receives this on its platform Stripe account automatically.

### 4. Webhook: `stripe-connect-webhook`
New endpoint subscribed to **Connect** events (`account.updated`, `checkout.session.completed`, `payment_intent.succeeded/failed`):
- `account.updated` → sync `charges_enabled` / `payouts_enabled` / `details_submitted`.
- `checkout.session.completed` → upsert `orders` row, mark `customizer_sessions.status = 'completed'`, attach to Woo/Shopify line item if applicable.
- Use `PAYMENTS_SANDBOX_WEBHOOK_SECRET` for sig verification; `verify_jwt = false`.

### 5. Storefront wiring (Customizer Studio + Woo/Shopify SDKs)
- Floating cart "Checkout" button calls `create-store-checkout` with the active `storeId` (already known via tenant slug → store lookup).
- Mount `EmbeddedCheckout` on `/checkout` of the tenant store.
- `/checkout/return?session_id=…` reads order, shows confirmation.

### 6. Dashboard: Payments tab on each store
- Show connection status, last payout, link to Stripe Express dashboard via `stripe.accounts.createLoginLink(acct)` (new tiny edge function `stripe-connect-login-link`).
- Show recent orders for that store (filtered by `metadata.store_id`).

### 7. Test → Live cutover
No code change required when you swap `STRIPE_CONNECT_SECRET_KEY` from `sk_test_…` to `sk_live_…`. Existing test Express accounts won't carry over — owners reconnect once in live mode.

## Technical details

```text
Customer → Tenant storefront
   │  POST /functions/v1/create-store-checkout
   ▼
Edge fn ── reads corporate_stores.stripe_account_id
        ── stripe.checkout.sessions.create({...},
              { stripeAccount: acct })   ← direct charge
        ── application_fee_amount = platform fee
   │
   ▼
Stripe Embedded Checkout (clientSecret)
   │
   ▼ webhook (Connect)
stripe-connect-webhook → orders + customizer_sessions update
```

DB additions (migration):
- `corporate_stores.platform_fee_bps int not null default 500`
- `orders.store_id uuid`, `orders.stripe_account_id text`, `orders.application_fee_amount int`

## Open questions

1. **Charge model**: Direct charges (merchant of record = shop owner, lowest liability for Printonet — recommended) or Destination charges (Printonet is MoR, more control)?
2. **Platform fee**: Flat % per store, per-plan tier, or none for now?
3. **Refunds/disputes**: Should shop owners handle directly via their Express dashboard (recommended) or proxy through Printonet UI?
4. Which storefront(s) should we wire first — the hosted Customizer Studio checkout, the WooCommerce plugin path, or both?

Answer 1–4 and I'll implement.