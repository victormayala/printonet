// Creates an order_approvals row with a unique token, then sends the
// approval email DIRECTLY via Resend (through the Lovable connector gateway).
// We bypass the Lovable email queue because branded subdomains delegated to
// Lovable's nameservers have been unreliable for this project.
import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from "npm:@supabase/supabase-js@2"
import { template as orderApprovalTemplate } from '../_shared/transactional-email-templates/order-approval-request.tsx'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const RESEND_GATEWAY_URL = 'https://connector-gateway.lovable.dev/resend';
// FROM address used when the store does not have its own configured.
// Defaults to Resend's shared sandbox sender, which works without a
// verified domain. Override by setting RESEND_FROM_EMAIL to e.g.
// "Printonet <noreply@yourdomain.com>" once that domain is verified
// inside the Resend dashboard.
const DEFAULT_FROM = Deno.env.get('RESEND_FROM_EMAIL') || 'Printonet <onboarding@resend.dev>';

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const orderId = String(body.orderId || "");
    const recipientOverride = body.recipientEmail ? String(body.recipientEmail) : null;
    const proofImageUrl = body.proofImageUrl ? String(body.proofImageUrl) : null;
    const customMessage = body.customMessage ? String(body.customMessage).slice(0, 1000) : null;
    if (!orderId) {
      return new Response(JSON.stringify({ error: "orderId is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, store_id, customer_email")
      .eq("id", orderId)
      .maybeSingle();
    if (orderErr || !order || !order.store_id) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: store, error: storeErr } = await supabase
      .from("corporate_stores")
      .select("id, user_id, name, custom_domain, contact_email")
      .eq("id", order.store_id)
      .maybeSingle();
    if (storeErr || !store || store.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const recipient = recipientOverride || order.customer_email;
    if (!recipient || !/^\S+@\S+\.\S+$/.test(recipient)) {
      return new Response(JSON.stringify({ error: "A valid recipient email is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const senderDomain = store.custom_domain || "resend";

    const token = randomToken();
    const { data: approval, error: insertErr } = await supabase
      .from("order_approvals")
      .insert({
        order_id: orderId,
        store_id: store.id,
        customer_email: recipient,
        token,
        sender_domain: senderDomain,
        sent_by: userId,
        proof_image_url: proofImageUrl,
      })
      .select("id, token")
      .single();
    if (insertErr || !approval) {
      return new Response(JSON.stringify({ error: insertErr?.message || "Insert failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const origin =
      req.headers.get("origin") ||
      Deno.env.get("PRINTONET_STOREFRONT_PUBLIC_URL") ||
      "https://printonet.lovable.app";
    const approvalUrl = `${origin.replace(/\/$/, "")}/approval/${approval.token}`;
    const orderShortCode = orderId.slice(0, 8).toUpperCase();
    const storeName = store.name || 'Printonet';

    // Render the same React Email template used previously
    const html = await renderAsync(
      React.createElement(orderApprovalTemplate.component, {
        storeName,
        approvalUrl,
        orderShortCode,
        proofImageUrl,
        customMessage,
      }),
    );
    const text = await renderAsync(
      React.createElement(orderApprovalTemplate.component, {
        storeName,
        approvalUrl,
        orderShortCode,
        proofImageUrl,
        customMessage,
      }),
      { plainText: true },
    );

    const subject =
      typeof orderApprovalTemplate.subject === 'function'
        ? orderApprovalTemplate.subject({ orderShortCode })
        : orderApprovalTemplate.subject;

    // Send via Resend through Lovable connector gateway
    let emailDispatched = false;
    let emailError: string | null = null;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

    if (!LOVABLE_API_KEY || !RESEND_API_KEY) {
      emailError = 'Resend connector is not configured (missing keys).';
    } else {
      try {
        const resp = await fetch(`${RESEND_GATEWAY_URL}/emails`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'X-Connection-Api-Key': RESEND_API_KEY,
          },
          body: JSON.stringify({
            from: DEFAULT_FROM,
            to: [recipient],
            subject,
            html,
            text,
            reply_to: store.contact_email || undefined,
            headers: {
              'X-Entity-Ref-ID': `order-approval-${approval.id}`,
            },
          }),
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          emailError = `Resend ${resp.status}: ${JSON.stringify(data)}`;
          console.error('[send-order-approval] Resend error', emailError);
        } else {
          emailDispatched = true;
          console.log('[send-order-approval] Resend dispatched', { id: (data as any)?.id, recipient });
        }
      } catch (e) {
        emailError = (e as Error).message;
        console.error('[send-order-approval] Resend exception', emailError);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        approvalUrl,
        emailDispatched,
        emailError,
        senderDomain,
        recipient,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[send-order-approval]", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
