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
      .maybeSingle();

    if (!store || !store.wp_site_url) {
      return new Response(JSON.stringify({ error: "Store not ready" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const brandingToken = Deno.env.get("PRINTONET_BRANDING_TOKEN");
    if (!brandingToken) {
      const msg = "PRINTONET_BRANDING_TOKEN is not configured";
      console.error(msg);
      await admin
        .from("corporate_stores")
        .update({ status: "active", error_message: msg })
        .eq("id", store.id);
      return new Response(
        JSON.stringify({ ok: false, branding_error: msg }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const payload = {
      store_name: store.name,
      contact_email: store.contact_email,
      custom_domain: store.custom_domain,
      primary_color: store.primary_color,
      font_family: store.font_family,
      logo_url: store.logo_url,
      favicon_url: store.favicon_url,
    };

    const url = `${store.wp_site_url.replace(/\/$/, "")}/wp-json/printonet/v1/branding`;
    let brandingError: string | null = null;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Printonet-Token": brandingToken,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const txt = await res.text();
        brandingError = `Branding endpoint returned ${res.status}`;
        console.warn("Branding push failed", res.status, txt);
      }
    } catch (e) {
      brandingError = e instanceof Error ? e.message : "Branding push failed";
      console.warn("Branding push exception", e);
    }

    // Mark active regardless — store is usable; branding can be re-applied later
    await admin
      .from("corporate_stores")
      .update({
        status: "active",
        error_message: brandingError,
      })
      .eq("id", store.id);

    return new Response(
      JSON.stringify({ ok: true, branding_error: brandingError }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    console.error("apply-store-branding error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
