import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  store_id: z.string().uuid(),
  action: z.enum(["pause", "resume", "delete"]),
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
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
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const userId = userData.user.id;

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return jsonResponse(
        { error: parsed.error.flatten().fieldErrors },
        400,
      );
    }
    const { store_id, action } = parsed.data;

    const INSTAWP_API_KEY = Deno.env.get("INSTAWP_API_KEY");
    if (!INSTAWP_API_KEY) {
      return jsonResponse({ error: "InstaWP not configured" }, 500);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: store, error: fetchErr } = await admin
      .from("corporate_stores")
      .select("*")
      .eq("id", store_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (fetchErr || !store) {
      return jsonResponse({ error: "Store not found" }, 404);
    }

    const siteId = store.instawp_site_id;

    // Helper: call InstaWP and tolerate already-deleted/missing sites
    const callInstaWP = async (
      method: "GET" | "DELETE",
      path: string,
    ): Promise<{ ok: boolean; status: number; message?: string }> => {
      if (!siteId) return { ok: true, status: 200 };
      const res = await fetch(`https://app.instawp.io/api/v2/${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${INSTAWP_API_KEY}`,
          Accept: "application/json",
        },
      });
      const json = await res.json().catch(() => ({}));
      console.log(`InstaWP ${method} ${path}`, res.status, json);
      // Treat 404 as benign for delete operations
      if (res.status === 404 && method === "DELETE") {
        return { ok: true, status: 404 };
      }
      return {
        ok: res.ok && json?.status !== false,
        status: res.status,
        message: json?.message || json?.error,
      };
    };

    if (action === "delete") {
      const result = await callInstaWP("DELETE", `sites/${siteId}`);
      if (!result.ok) {
        return jsonResponse(
          { error: result.message || `InstaWP error (${result.status})` },
          502,
        );
      }
      const { error: delErr } = await admin
        .from("corporate_stores")
        .delete()
        .eq("id", store_id);
      if (delErr) {
        return jsonResponse({ error: delErr.message }, 500);
      }
      return jsonResponse({ ok: true });
    }

    if (action === "pause") {
      const result = await callInstaWP("GET", `sites/${siteId}/sleep`);
      if (!result.ok) {
        return jsonResponse(
          { error: result.message || `InstaWP error (${result.status})` },
          502,
        );
      }
      await admin
        .from("corporate_stores")
        .update({ status: "paused", error_message: null })
        .eq("id", store_id);
      return jsonResponse({ ok: true });
    }

    if (action === "resume") {
      const result = await callInstaWP("GET", `sites/${siteId}/wake`);
      if (!result.ok) {
        return jsonResponse(
          { error: result.message || `InstaWP error (${result.status})` },
          502,
        );
      }
      await admin
        .from("corporate_stores")
        .update({ status: "active", error_message: null })
        .eq("id", store_id);
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("manage-corporate-store error", e);
    return jsonResponse(
      { error: e instanceof Error ? e.message : "Unknown" },
      500,
    );
  }
});
