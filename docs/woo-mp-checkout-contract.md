# Woo → Main Platform Stripe checkout — WordPress contract

This document specifies the two HMAC-signed REST endpoints the Printonet
WordPress MU plugin must expose so the Main Platform (MP) can fetch the Woo
order total and mark the order paid after Stripe Connect checkout succeeds.

The MP redirects shoppers from Woo's "Place order" to:

```
https://platform.printonet.com/pay/woo
  ?tenant_slug=<slug>
  &order_id=<int>
  &order_key=<wc_order_key>
  &store_origin=<https://tenant.example.com>
  &success_url=<woo thank-you URL>
  &cancel_url=<woo checkout URL>
```

The MP page invokes `woo-checkout-init`, which calls **endpoint 1** below to
get the order total, creates a Stripe Checkout Session on the tenant's
connected Express account, and renders an embedded checkout. After a paid
session, the MP calls **endpoint 2** to flip the Woo order to `processing`,
then redirects the buyer to `success_url`.

A Stripe Connect webhook (`woo-connect-webhook`) calls endpoint 2 as well so
the order is still completed if the buyer closes the tab.

## Authentication

Same scheme as `printonet-woo-order-files`:

```
X-Printonet-Timestamp: <unix_seconds>
X-Printonet-Signature: hex(HMAC_SHA256(`${timestamp}.${rawBody}`, PRINTONET_PLATFORM_HMAC_SECRET))
```

For `GET` requests, sign an empty string body. Reject requests where the
timestamp is more than 300s old.

## Endpoint 1 — fetch order summary

**`GET /wp-json/printonet/v1/order/{order_id}?order_key=<key>`**

Reject if the order's `wc_order_key` does not match the query string (404).

Response (200):

```json
{
  "order_id": 1234,
  "order_key": "wc_order_abc",
  "status": "pending",
  "currency": "usd",
  "total_in_cents": 4599,
  "customer_email": "buyer@example.com",
  "line_items": [
    { "name": "Custom Tee – Black / L", "quantity": 1, "price_in_cents": 4500 },
    { "name": "Shipping",                "quantity": 1, "price_in_cents": 99   }
  ]
}
```

- `total_in_cents` is the source of truth — Stripe will charge this exact
  amount in the given `currency`.
- `line_items` is optional; when omitted MP falls back to a single line item
  named `Order #<order_id>` for the full total.
- Statuses already considered paid (`processing`, `completed`, `on-hold`)
  cause MP to skip Stripe and redirect straight to the thank-you URL.

## Endpoint 2 — mark order paid

**`POST /wp-json/printonet/v1/order/{order_id}/complete`**

Body:

```json
{
  "order_key": "wc_order_abc",
  "transaction_id": "pi_3NXXXXX",
  "amount_in_cents": 4599,
  "currency": "usd",
  "stripe_checkout_session_id": "cs_test_…",
  "stripe_account_id": "acct_1XXX"
}
```

Behaviour:

1. Reject if `order_key` does not match the order (404).
2. Idempotent: if the order is already `processing`/`completed`, return 200.
3. Otherwise call `$order->payment_complete( $transaction_id )` so Woo
   transitions to `processing`, decrements stock, and fires the standard
   `woocommerce_payment_complete` hook (which the existing Printonet plugin
   uses to push the paid payload to `printonet-woo-order-files`).
4. Optionally store `stripe_account_id` and `stripe_checkout_session_id`
   as order meta (`_printonet_mp_stripe_account`, `_printonet_mp_stripe_session`)
   for support/audit.

Response (200):

```json
{ "ok": true, "status": "processing" }
```

## Edge functions on the MP side

| Function                  | Trigger                                | Calls               |
| ------------------------- | -------------------------------------- | ------------------- |
| `woo-checkout-init`       | `/pay/woo` page load                   | endpoint 1          |
| `woo-checkout-complete`   | `/pay/woo/return` page (synchronous)   | endpoint 2          |
| `woo-connect-webhook`     | Stripe Connect `checkout.session.completed` | endpoint 2     |

The webhook needs `STRIPE_CONNECT_WEBHOOK_SECRET` configured and the URL
`https://qumrnazgdrijdcihtkah.supabase.co/functions/v1/woo-connect-webhook`
registered under **Developers → Webhooks → Connect** in the Stripe dashboard
listening to `checkout.session.completed`.
