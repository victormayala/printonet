import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2, Package, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CorporateStore } from "@/types/corporateStore";
import { applyBrandCSS, type BrandConfig, DEFAULT_BRAND_CONFIG } from "@/lib/brand-config";

type ProductLite = {
  id: string;
  name: string;
  category: string | null;
  base_price: number;
  image_front: string | null;
  customizable?: boolean;
};

export default function StoreShop({ customDomainHost }: { customDomainHost?: string }) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [store, setStore] = useState<CorporateStore | null>(null);
  const [products, setProducts] = useState<ProductLite[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantSlug && !customDomainHost) return;
    let cancelled = false;
    (async () => {
      let storeQuery = supabase
        .from("corporate_stores")
        .select("*")
        .eq("status", "active");
      storeQuery = customDomainHost
        ? storeQuery.eq("custom_domain", customDomainHost)
        : storeQuery.eq("tenant_slug", tenantSlug!);
      const { data: s, error: sErr } = await storeQuery.maybeSingle();
      if (cancelled) return;
      if (sErr || !s) {
        setError("Store not found.");
        return;
      }
      setStore(s as CorporateStore);

      // Only show products that have been pushed to this store. The
      // `customizable` flag on the link decides whether the Customize button shows.
      const { data: links } = await supabase
        .from("corporate_store_products")
        .select("product_id,customizable,sort_order")
        .eq("store_id", s.id)
        .eq("is_active", true)
        .order("sort_order");

      const productIds = (links ?? []).map((l) => l.product_id);
      const customizableMap = new Map<string, boolean>(
        (links ?? []).map((l) => [l.product_id, !!l.customizable]),
      );

      let prods: Array<{
        id: string;
        name: string;
        category: string | null;
        base_price: number;
        image_front: string | null;
      }> = [];
      if (productIds.length > 0) {
        const { data } = await supabase
          .from("inventory_products")
          .select("id,name,category,base_price,image_front")
          .in("id", productIds)
          .eq("is_active", true);
        prods = data ?? [];
      }

      if (cancelled) return;
      const orderIndex = new Map(productIds.map((id, i) => [id, i]));
      const productList: ProductLite[] = prods
        .map((p) => ({ ...p, customizable: customizableMap.get(p.id) ?? false }))
        .sort((a, b) => (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0));
      setProducts(productList);
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantSlug, customDomainHost]);

  const productBasePath = customDomainHost ? "" : `/s/${tenantSlug}`;

  // Apply store branding
  useEffect(() => {
    if (!store) return;
    const brand: BrandConfig = {
      ...DEFAULT_BRAND_CONFIG,
      name: store.name,
      logoUrl: store.logo_url,
      primaryColor: store.primary_color,
      accentColor: store.accent_color,
      fontFamily: store.font_family,
    };
    applyBrandCSS(document.documentElement, brand);
  }, [store]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground p-6">
        <p>{error}</p>
      </div>
    );
  }

  if (!store || !products) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-4 py-5 flex items-center gap-3">
          {store.logo_url ? (
            <img src={store.logo_url} alt={store.name} className="h-9 w-auto" />
          ) : (
            <div className="h-9 w-9 rounded" style={{ background: store.primary_color }} />
          )}
          <div>
            <h1 className="text-xl font-semibold leading-none">{store.name}</h1>
            <p className="text-xs text-muted-foreground mt-1">Customize & order</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold mb-6">Choose a product to customize</h2>
        {products.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <Package className="h-8 w-8 mx-auto mb-3 opacity-50" />
              <p>No customizable products yet.</p>
              <p className="text-xs mt-1">Check back soon.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <Card key={p.id} className="overflow-hidden flex flex-col">
                <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                  {p.image_front ? (
                    <img src={p.image_front} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <Package className="h-10 w-10 text-muted-foreground" />
                  )}
                </div>
                <CardContent className="p-3 flex-1 flex flex-col gap-2">
                  <div className="flex-1">
                    <p className="text-sm font-medium line-clamp-2">{p.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      ${Number(p.base_price ?? 0).toFixed(2)}
                    </p>
                  </div>
                  {p.customizable ? (
                    <Button asChild size="sm" className="w-full">
                      <Link to={`${productBasePath}/customize/${p.id}`}>
                        <Wand2 className="h-3.5 w-3.5" /> Customize
                      </Link>
                    </Button>
                  ) : (
                    <Button size="sm" variant="secondary" className="w-full" disabled>
                      Buy as-is
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
