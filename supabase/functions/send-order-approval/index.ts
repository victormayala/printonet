// Creates an order_approvals row with a unique token, then attempts to
// dispatch a transactional email. If transactional email isn't set up yet,
// returns the approval URL so the store owner can send it manually.
import { createClient } from "npm:@supabase/supabase-js@2";

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
    // Authenticate the caller (must be the order's store owner)
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

    // Load order + store, verify ownership
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

    // Sender: store's verified custom domain if present, else Printonet default
    const senderDomain = store.custom_domain || "notify.stores.printonet.com";

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

    // Try to dispatch via the transactional email function. If it isn't
    // deployed yet, we still succeed and return the link so the owner can
    // copy/paste it into their own email.
    let emailDispatched = false;
    let emailError: string | null = null;
    try {
      // Forward the caller's JWT so the protected send-transactional-email
      // function accepts the request (verify_jwt = true).
      const { error: sendErr } = await supabase.functions.invoke(
        "send-transactional-email",
        {
          headers: { Authorization: `Bearer ${jwt}` },
          body: {
            templateName: "order-approval-request",
            recipientEmail: recipient,
            idempotencyKey: `order-approval-${approval.id}`,
            templateData: {
              storeName: store.name,
              approvalUrl,
              orderShortCode: orderId.slice(0, 8).toUpperCase(),
              proofImageUrl,
              customMessage,
            },
            senderDomain,
          },
        },
      );
      if (sendErr) {
        emailError = sendErr.message || String(sendErr);
      } else {
        emailDispatched = true;
      }
    } catch (e) {
      emailError = (e as Error).message;
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
