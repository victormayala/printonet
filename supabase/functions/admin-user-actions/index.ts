// Super-admin user management: ban, unban, delete.
// Verifies the caller is a super_admin via their JWT, then performs the
// requested action against auth.users using the service-role key.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Missing bearer token" }, 401);

    // Verify caller and their role using their JWT.
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Not authenticated" }, 401);

    const { data: isAdmin, error: roleErr } = await userClient.rpc("has_role", {
      _user_id: user.id,
      _role: "super_admin",
    });
    if (roleErr) return json({ error: roleErr.message }, 500);
    if (!isAdmin) return json({ error: "Forbidden: super_admin required" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");
    const targetUserId = String(body?.user_id ?? "");
    if (!targetUserId) return json({ error: "user_id is required" }, 400);
    if (targetUserId === user.id) {
      return json({ error: "You cannot perform this action on your own account." }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (action === "ban") {
      // 100 years effectively permanent until unbanned.
      const { error } = await admin.auth.admin.updateUserById(targetUserId, {
        ban_duration: `${100 * 365 * 24}h`,
      });
      if (error) return json({ error: error.message }, 400);
      // Also pause their stores so the storefront stops serving them.
      await admin.from("corporate_stores").update({ status: "paused" }).eq("user_id", targetUserId);
      return json({ ok: true });
    }

    if (action === "unban") {
      const { error } = await admin.auth.admin.updateUserById(targetUserId, {
        ban_duration: "none",
      });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === "delete") {
      // Cascade clean up tenant data owned by the user before removing the auth account.
      const tables = [
        "corporate_store_product_logos",
        "corporate_store_products",
        "design_templates",
        "store_integrations",
        "inventory_products",
        "product_category_links",
        "product_categories",
        "brand_configs",
        "corporate_stores",
        "user_roles",
        "profiles",
      ];
      for (const t of tables) {
        const col = t === "profiles" ? "id" : "user_id";
        await admin.from(t).delete().eq(col, targetUserId);
      }
      const { error } = await admin.auth.admin.deleteUser(targetUserId);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
