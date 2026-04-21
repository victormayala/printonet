import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  store_id: z.string().uuid(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub as string;

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.flatten().fieldErrors }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: store } = await admin
      .from("corporate_stores")
      .select("*")
      .eq("id", parsed.data.store_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!store) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Already finished — just return current state
    if (store.status !== "provisioning") {
      return new Response(JSON.stringify({ store }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const INSTAWP_API_KEY = Deno.env.get("INSTAWP_API_KEY");
    if (!INSTAWP_API_KEY || !store.instawp_task_id) {
      return new Response(JSON.stringify({ store }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check InstaWP task status
    const taskRes = await fetch(
      `https://app.instawp.io/api/v2/tasks/${store.instawp_task_id}/status`,
      {
        headers: {
          Authorization: `Bearer ${INSTAWP_API_KEY}`,
          Accept: "application/json",
        },
      },
    );
    const taskJson = await taskRes.json().catch(() => ({}));
    console.log("InstaWP task status", store.instawp_task_id, taskJson);

    const data = taskJson?.data ?? taskJson;
    const taskStatus = (data?.status ?? "").toString().toLowerCase();
    const progress = data?.percentage ?? data?.progress ?? null;

    if (taskStatus === "completed" || data?.is_done === true) {
      const siteUrl = data?.wp_url ?? store.instawp_site_url;
      const adminUrl = data?.wp_admin_url ?? store.instawp_admin_url;

      await admin
        .from("corporate_stores")
        .update({
          status: "active",
          instawp_site_url: siteUrl,
          instawp_admin_url: adminUrl,
        })
        .eq("id", store.id);

      // Fire-and-forget branding push
      try {
        await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/apply-store-branding`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ store_id: store.id }),
          },
        );
      } catch (e) {
        console.error("branding trigger failed", e);
      }

      const { data: refreshed } = await admin
        .from("corporate_stores")
        .select("*")
        .eq("id", store.id)
        .single();

      return new Response(JSON.stringify({ store: refreshed, progress: 100 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (taskStatus === "failed" || taskStatus === "error") {
      const msg = data?.message || "InstaWP provisioning failed";
      await admin
        .from("corporate_stores")
        .update({ status: "failed", error_message: msg })
        .eq("id", store.id);
      const { data: refreshed } = await admin
        .from("corporate_stores")
        .select("*")
        .eq("id", store.id)
        .single();
      return new Response(JSON.stringify({ store: refreshed }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ store, progress, task_status: taskStatus }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    console.error("check-corporate-store-status error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
