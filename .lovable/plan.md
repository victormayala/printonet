## Goal
Charge a 2.5% platform fee to Printonet on every transaction processed through a corporate store's connected Stripe account.

## Why it's not working today
Both checkout-creation edge functions create the Stripe Checkout Session as a **direct charge** on the merchant's account (via the `Stripe-Account` header), but neither passes `application_fee_amount`. Without that parameter, 100% of the funds settle on the merchant and Printonet collects nothing — that's the symptom you're seeing.

The fix is to add `application_fee_amount` (in cents) to the session params. For direct charges, this is the supported way to route a cut to the platform automatically on every successful payment.

## Plan

### 1. Add a configurable fee rate (default 2.5%)
- Add column `corporate_stores.platform_fee_bps integer not null default 250` (250 basis points = 2.5%). Per-store override later if needed.
- Migration only; no UI change required now.

### 2. Patch `supabase/functions/stripe-connect-checkout/index.ts` (hosted Customizer Studio checkout)
- Select `platform_fee_bps` from `corporate_stores`.
- Compute `feeCents = Math.floor((amountInCents * quantity) * bps / 10000)`.
- Add to params:
  - `payment_intent_data[application_fee_amount] = feeCents`
- Stamp `metadata[platform_fee_bps]` for reporting.

### 3. Patch `supabase/functions/woo-checkout-init/index.ts` (WooCommerce plugin checkout)
- Same selection + computation against `order.total_in_cents`.
- Add `payment_intent_data[application_fee_amount]`.
- Stamp metadata.

### 4. Persist the fee on completion
- In `woo-checkout-complete` and the existing `payments-webhook` / `stripe-connect-webhook` paths, write `orders.application_fee_amount` from the PaymentIntent. (The `orders` table already has the column — currently always null.)

### 5. Sanity checks
- Minimum: skip fee if `amountInCents < ~50¢` worth of fee (Stripe rejects fees larger than the charge minus Stripe processing).
- Test mode: confirm with a $10 sandbox checkout that:
  - Merchant Express account receives net amount
  - Platform account sees a `application_fee` of $0.25
  - `orders.application_fee_amount = 25`

## Technical notes
Direct charge + application fee shape:
```text
POST /v1/checkout/sessions
  Header: Stripe-Account: acct_xxx       (merchant)
  Body:   payment_intent_data[application_fee_amount]=250    (cents, to platform)
```
No change to charge model, return URLs, or webhook subscriptions.

## Out of scope
- Per-store custom fee rates UI (column supports it; defer until needed).
- Subscription-style fees (we only do one-off payments today).
- Refund/dispute fee reversal logic (Stripe handles application fee refund pro-rata automatically when the charge is refunded).

Confirm and I'll implement.