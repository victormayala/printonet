// Public endpoint used by the customer-facing approval page.
//   GET  ?token=...           -> { status, store, order_short, customer_email, comment, decided_at }
//   POST { token, decision, comment } -> records decision (idempotent)
// No JWT required — token gates access.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function loadByToken(token: string) {
  const { data: approval, error } = await supabase
    .from("order_approvals")
    .select(
      "id, order_id, store_id, customer_email, status, customer_comment, decided_at, expires_at, sent_at, proof_image_url",
    )
    .eq("token", token)
    .maybeSingle();
  if (error || !approval) return null;
  return approval;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const token = url.searchParams.get("token") || "";
      if (!token) {
        return new Response(JSON.stringify({ error: "token required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const approval = await loadByToken(token);
      if (!approval) {
        return new Response(JSON.stringify({ error: "not_found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const [{ data: store }, { data: order }] = await Promise.all([
        supabase
          .from("corporate_stores")
          .select("name, logo_url, primary_color, accent_color, tenant_slug")
          .eq("id", approval.store_id)
          .maybeSingle(),
        supabase
          .from("orders")
          .select("id, created_at, session_id")
          .eq("id", approval.order_id)
          .maybeSingle(),
      ]);

      let designImages: string[] = [];
      if (order?.session_id) {
        const { data: sess } = await supabase
          .from("customizer_sessions")
          .select("design_output")
          .eq("id", order.session_id)
          .maybeSingle();
        const output = sess?.design_output as Record<string, unknown> | null;
        if (output && typeof output === "object") {
          const sides = Array.isArray((output as { sides?: unknown }).sides)
            ? ((output as { sides: Record<string, unknown>[] }).sides)
            : [];
          designImages = sides
            .map((s) => {
              const v = (s.previewPNG || s.designPNG) as unknown;
              return typeof v === "string" && v.startsWith("http") ? v : null;
            })
            .filter((v): v is string => !!v);
        }
      }
      if (approval.proof_image_url) {
        // Show the uploaded proof first; it's the explicit thing the
        // store owner wants the customer to approve.
        designImages = [approval.proof_image_url, ...designImages];
      }

      const isExpired =
        approval.status === "pending" && new Date(approval.expires_at).getTime() < Date.now();

      return new Response(
        JSON.stringify({
          status: isExpired ? "expired" : approval.status,
          customer_email: approval.customer_email,
          comment: approval.customer_comment,
          decided_at: approval.decided_at,
          sent_at: approval.sent_at,
          store,
          order: {
            short_code: approval.order_id.slice(0, 8).toUpperCase(),
            created_at: order?.created_at,
          },
          design_images: designImages,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const token = String(body.token || "");
      const decision = String(body.decision || "");
      const comment = body.comment ? String(body.comment).slice(0, 2000) : null;
      if (!token || !["approved", "rejected"].includes(decision)) {
        return new Response(JSON.stringify({ error: "Invalid request" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const approval = await loadByToken(token);
      if (!approval) {
        return new Response(JSON.stringify({ error: "not_found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (approval.status !== "pending") {
        return new Response(
          JSON.stringify({ error: "already_decided", status: approval.status }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (new Date(approval.expires_at).getTime() < Date.now()) {
        return new Response(JSON.stringify({ error: "expired" }), {
          status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error: updErr } = await supabase
        .from("order_approvals")
        .update({
          status: decision,
          customer_comment: comment,
          decided_at: new Date().toISOString(),
        })
        .eq("id", approval.id);
      if (updErr) {
        return new Response(JSON.stringify({ error: updErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true, status: decision }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  } catch (e) {
    console.error("[order-approval]", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
