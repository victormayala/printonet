import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  name: z.string().trim().min(2).max(100),
  contact_email: z.string().trim().email().max(255),
  custom_domain: z.string().trim().max(255).optional().nullable(),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accent_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  font_family: z.string().min(1).max(80),
  logo_url: z.string().url().optional().nullable(),
  secondary_logo_url: z.string().url().optional().nullable(),
  favicon_url: z.string().url().optional().nullable(),
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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

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
    const body = parsed.data;

    const INSTAWP_API_KEY = Deno.env.get("INSTAWP_API_KEY");
    const INSTAWP_TEMPLATE_ID = Deno.env.get("INSTAWP_TEMPLATE_ID");
    if (!INSTAWP_API_KEY || !INSTAWP_TEMPLATE_ID) {
      return new Response(
        JSON.stringify({ error: "InstaWP not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Insert row first (status = provisioning)
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: store, error: insertErr } = await admin
      .from("corporate_stores")
      .insert({
        user_id: userId,
        name: body.name,
        contact_email: body.contact_email,
        custom_domain: body.custom_domain || null,
        primary_color: body.primary_color,
        accent_color: body.accent_color,
        font_family: body.font_family,
        logo_url: body.logo_url || null,
        secondary_logo_url: body.secondary_logo_url || null,
        favicon_url: body.favicon_url || null,
        status: "provisioning",
      })
      .select()
      .single();

    if (insertErr || !store) {
      console.error("DB insert failed", insertErr);
      return new Response(JSON.stringify({ error: "Failed to create store" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // InstaWP requires site_name to match /^[a-zA-Z0-9-]+$/
    // Sanitize: lowercase, replace any non-alphanumeric with '-', collapse repeats, trim '-'
    const baseSlug = body.name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "") // strip accents
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "store";
    // Append short random suffix to avoid collisions across tenants
    const suffix = store.id.replace(/-/g, "").slice(0, 8);
    const siteName = `${baseSlug}-${suffix}`;

    // Call InstaWP API to clone the template
    // Docs: https://docs.instawp.com/api-documentation
    const instaRes = await fetch(
      `https://app.instawp.io/api/v2/sites/template`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${INSTAWP_API_KEY}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          template_slug: INSTAWP_TEMPLATE_ID,
          site_name: siteName,
          is_reserved: false,
        }),
      },
    );

    const instaJson = await instaRes.json().catch(() => ({}));
    console.log("InstaWP response", instaRes.status, instaJson);

    if (!instaRes.ok || instaJson?.status === false) {
      const msg =
        instaJson?.message ||
        instaJson?.error ||
        `InstaWP API error (${instaRes.status})`;
      await admin
        .from("corporate_stores")
        .update({ status: "failed", error_message: msg })
        .eq("id", store.id);
      return new Response(JSON.stringify({ error: msg, store_id: store.id }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = instaJson?.data ?? instaJson;
    const taskId =
      data?.task_id ?? data?.id?.toString() ?? null;
    const siteUrl = data?.wp_url ?? data?.url ?? null;
    const adminUrl = data?.wp_admin_url ?? null;
    const siteId = data?.id?.toString() ?? null;

    await admin
      .from("corporate_stores")
      .update({
        instawp_task_id: taskId,
        instawp_site_id: siteId,
        instawp_site_url: siteUrl,
        instawp_admin_url: adminUrl,
      })
      .eq("id", store.id);

    return new Response(
      JSON.stringify({ store_id: store.id, task_id: taskId }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    console.error("provision-corporate-store error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
