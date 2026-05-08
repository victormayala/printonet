import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves a tenant_slug + product_id, ensures the product is enabled for the
 * store, creates a customizer session attributed to the store, and redirects
 * to /embed/:sessionId where store branding will be applied.
 */
export default function StoreCustomize() {
  const { tenantSlug, productId } = useParams<{ tenantSlug: string; productId: string }>();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantSlug || !productId) return;
    let cancelled = false;

    (async () => {
      try {
        // 1. Resolve store
        const { data: store, error: sErr } = await supabase
          .from("corporate_stores")
          .select("id,user_id,status")
          .eq("tenant_slug", tenantSlug)
          .eq("status", "active")
          .maybeSingle();
        if (sErr || !store) throw new Error("Store not found");

        // 2. Verify product is enabled for this store
        const { data: link } = await supabase
          .from("corporate_store_products")
          .select("id")
          .eq("store_id", store.id)
          .eq("product_id", productId)
          .eq("is_active", true)
          .maybeSingle();
        if (!link) throw new Error("Product not available in this store");

        // 3. Load product (public read on active products)
        const { data: product, error: pErr } = await supabase
          .from("inventory_products")
          .select("*")
          .eq("id", productId)
          .eq("is_active", true)
          .maybeSingle();
        if (pErr || !product) throw new Error("Product not found");

        // 4. Build product_data shape expected by EmbedCustomizer
        const productData = {
          name: product.name,
          category: product.category,
          description: product.description ?? undefined,
          image_front: product.image_front ?? undefined,
          image_back: product.image_back ?? undefined,
          image_side1: product.image_side1 ?? undefined,
          image_side2: product.image_side2 ?? undefined,
          variants: Array.isArray(product.variants) ? product.variants : [],
          print_areas: product.print_areas ?? undefined,
          product_id: product.id,
        };

        // 5. Create session attributed to the store. Inherit owner user_id so
        // EmbedCustomizer can resolve store branding via the session.
        const { data: session, error: cErr } = await supabase
          .from("customizer_sessions")
          .insert({
            product_data: productData,
            user_id: store.user_id,
            store_id: store.id,
            status: "active",
          })
          .select("id")
          .single();
        if (cErr || !session) throw new Error(cErr?.message || "Could not start session");

        if (!cancelled) setSessionId(session.id);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Something went wrong");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tenantSlug, productId]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground p-6 text-center">
        <div>
          <p className="font-medium mb-1">{error}</p>
          <p className="text-sm">Please return to the store and try again.</p>
        </div>
      </div>
    );
  }

  if (!sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Preparing customizer…
      </div>
    );
  }

  return <Navigate to={`/embed/${sessionId}`} replace />;
}
