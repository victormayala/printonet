
## Plans

| Plan | Monthly | Included stores | Extra store | Transaction fee | Notable unlocks |
|---|---|---|---|---|---|
| **Starter** | $39 | 1 | $20/mo | 2.5% | Custom domain, Stripe Connect, hosted Customizer Studio checkout |
| **Growth** | $99 | 3 | $20/mo | 1.5% | Everything in Starter + remove Printonet badge, push-to-Shopify/Woo, AI design assistant, design template library |
| **Pro** | $249 | 10 | $20/mo | **0.5%** *(suggested — confirm)* | Everything in Growth + priority support, white-label SDK loader, higher AI quota, multi-seat (future) |

A user **must have an active subscription** to operate any corporate store. Without one, existing stores go into a `paused` state (read-only / checkout disabled) — they're never deleted.

> **Confirm before build:** Pro's transaction fee. The progression 2.5 → 1.5 → 0.5 makes the upgrade compelling. If you'd rather keep Pro at 1% (or 0%), say so and I'll adjust.

## What gets built

### 1. Stripe products (sandbox auto-syncs to live on publish)
Created via `payments--batch_create_product`:
- `printonet_starter` → `starter_monthly` $39/mo
- `printonet_growth` → `growth_monthly` $99/mo
- `printonet_pro` → `pro_monthly` $249/mo
- `printonet_extra_store` → `extra_store_monthly` $20/mo (quantity-based add-on, used as a second line item)

Tax codes: `txcd_10103001` (SaaS — electronic services).

### 2. Database (one migration)
- New table `subscriptions` (per the standard Stripe-on-Lovable schema): `user_id`, `stripe_subscription_id`, `stripe_customer_id`, `product_id`, `price_id`, `status`, `current_period_start/end`, `cancel_at_period_end`, `environment`, plus a new `extra_store_quantity int default 0` column for the seat add-on.
- `has_active_subscription(uuid, text)` security-definer helper.
- Trigger on `corporate_stores`: on INSERT, count the user's existing stores; if `count + 1 > tier_included_stores + extra_store_quantity`, raise. (Fee column already exists.)
- Function `apply_plan_fee_to_user_stores(user_id, bps)` to bulk-update `corporate_stores.platform_fee_bps` when the plan changes. Runs from the webhook.
- Allow super_admin override (existing `protect_corporate_stores_platform_fee` trigger already handles this).

### 3. Edge functions
- `create-checkout` — accepts `priceId` (`starter_monthly` | `growth_monthly` | `pro_monthly`) plus optional `extraStores` quantity. Resolves Customer via `resolveOrCreateCustomer`, creates an embedded subscription session with two line items (plan + extra-store seats), stamps `userId` on Customer + Subscription metadata.
- `create-portal-session` — Stripe Billing Portal (cancel / change card / change quantity).
- `payments-webhook` — handles `customer.subscription.created/updated/deleted`, upserts the row, then calls `apply_plan_fee_to_user_stores` with the bps for the new plan, and updates `extra_store_quantity` from the subscription item quantity. On `deleted`/`unpaid`, sets all the user's `corporate_stores.status = 'paused'`.
- All three need `verify_jwt = false` in `supabase/config.toml`.

### 4. Frontend
- **`src/pages/Pricing.tsx`** — new `/pricing` route. Three tier cards with the table above, "Choose plan" buttons that open embedded Stripe checkout via `useStripeCheckout`. Includes the `<PaymentTestModeBanner />`.
- **`src/pages/Billing.tsx`** — new `/billing` route. Shows current plan, included/used store count, extra-seat quantity stepper, "Manage billing" (portal), upgrade/downgrade.
- **`src/hooks/useSubscription.ts`** — reads `subscriptions` table filtered by `environment`, exposes `{ plan, isActive, includedStores, extraStores, totalStoreLimit, feeBps }`.
- **Sidebar** — add a "Billing" link; show plan badge under the user name.
- **Gating in `CorporateStores.tsx`**:
  - "New store" button: if `usedStores >= totalStoreLimit`, open a dialog offering "Upgrade plan" or "Add a store ($20/mo)" — the latter increments the seat quantity via a small `update-extra-stores` edge function.
  - If `!isActive`, replace the page with a "Reactivate your plan" empty state linking to `/pricing`.
- **Onboarding nudge** — after signup, if no subscription, redirect to `/pricing` (with skip → trial-less Starter is the only path; no free tier per your spec).

### 5. Stripe go-live
After implementation, surface `payments--get_go_live_status` so you can complete account verification before publishing.

## Technical notes
- Built-in Stripe payments (`enable_stripe_payments`), embedded checkout — not BYOK.
- Plan → fee mapping lives **server-side only** (in the webhook), so a tampered client can't change fees:
  ```
  starter_monthly → 250 bps
  growth_monthly  → 150 bps
  pro_monthly     →  50 bps   (or whatever you confirm)
  ```
- Extra-store add-on uses Stripe's metered quantity on a separate line item, not a separate subscription, so it renews/cancels with the parent plan.
- All reads from `subscriptions` filter by `environment = getStripeEnvironment()` to avoid sandbox/live bleed.
- The `corporate_stores.status = 'paused'` flow already exists; we just trigger it from the webhook on cancel/unpaid.

## Out of scope (for now)
- Annual pricing (easy follow-up — add `*_yearly` price IDs).
- Per-store plans (you chose per-user).
- Usage-based AI credit metering beyond a simple monthly cap.
- Tax handling (`managed_payments` / `automatic_tax`) — I'll ask which option you want before wiring checkout, per Stripe docs.

Confirm Pro's fee (0.5% suggested) and I'll implement.
