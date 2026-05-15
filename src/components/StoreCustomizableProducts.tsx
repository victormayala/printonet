import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Package, Search, ExternalLink, Copy, Check, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { CorporateStore, resolveTenantSlug } from "@/types/corporateStore";

type InventoryProduct = {
  id: string;
  name: string;
  category: string | null;
  base_price: number;
  image_front: string | null;
  is_active: boolean;
};

export function StoreCustomizableProducts({ store }: { store: CorporateStore }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const { data: products, isLoading: loadingProducts } = useQuery({
    queryKey: ["inventory_products", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_products")
        .select("id,name,category,base_price,image_front,is_active")
        .eq("user_id", user!.id)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as InventoryProduct[];
    },
  });

  const { data: links, isLoading: loadingLinks } = useQuery({
    queryKey: ["corporate_store_products", store.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("corporate_store_products")
        .select("id,product_id,is_active")
        .eq("store_id", store.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const enabledMap = useMemo(() => {
    const m = new Map<string, { id: string; is_active: boolean }>();
    (links ?? []).forEach((l) => m.set(l.product_id, { id: l.id, is_active: l.is_active }));
    return m;
  }, [links]);

  const toggle = async (productId: string, on: boolean) => {
    if (!user?.id) return;
    setSavingId(productId);
    try {
      const existing = enabledMap.get(productId);
      if (on) {
        if (existing) {
          const { error } = await supabase
            .from("corporate_store_products")
            .update({ is_active: true })
            .eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("corporate_store_products").insert({
            store_id: store.id,
            product_id: productId,
            user_id: user.id,
            is_active: true,
          });
          if (error) throw error;
        }
      } else if (existing) {
        const { error } = await supabase
          .from("corporate_store_products")
          .delete()
          .eq("id", existing.id);
        if (error) throw error;
      }
      qc.invalidateQueries({ queryKey: ["corporate_store_products", store.id] });
    } catch (e) {
      toast({
        title: "Could not update",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSavingId(null);
    }
  };

  const filtered = useMemo(() => {
    if (!products) return [];
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.category ?? "").toLowerCase().includes(q),
    );
  }, [products, search]);

  const enabledCount = Array.from(enabledMap.values()).filter((l) => l.is_active).length;

  const storefrontUrl = store.tenant_slug
    ? `${window.location.origin}/s/${store.tenant_slug}`
    : null;

  const copyUrl = async () => {
    if (!storefrontUrl) return;
    await navigator.clipboard.writeText(storefrontUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const syncToStore = async () => {
    const tenantSlug = resolveTenantSlug(store);
    if (!tenantSlug) {
      toast({
        title: "Missing tenant slug",
        description: "This store has no tenant_slug or site URL configured.",
        variant: "destructive",
      });
      return;
    }
    const allIds = (products ?? []).map((p) => p.id);
    const customizableIds = Array.from(enabledMap.entries())
      .filter(([, v]) => v.is_active)
      .map(([pid]) => pid);
    if (allIds.length === 0) {
      toast({ title: "No products to sync", description: "Add products first.", variant: "destructive" });
      return;
    }
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-catalog-to-tenant", {
        body: {
          tenant_slug: tenantSlug,
          custom_domain: store.custom_domain ?? undefined,
          product_ids: allIds,
          mode: "incremental",
          customizable_product_ids: customizableIds,
          customizer_base_url: window.location.origin,
        },
      });
      if (error) throw new Error(error.message);
      const res = (data ?? {}) as { ok?: boolean; error?: string; detail?: string };
      if (res.ok === false || res.error) {
        throw new Error([res.error, res.detail].filter(Boolean).join(" — ") || "Sync failed");
      }
      toast({
        title: "Synced to store",
        description: `${allIds.length} product${allIds.length === 1 ? "" : "s"} pushed (${customizableIds.length} customizable).`,
      });
    } catch (e) {
      toast({
        title: "Sync failed",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const allEnabled =
    (filtered?.length ?? 0) > 0 &&
    filtered.every((p) => enabledMap.get(p.id)?.is_active);
  const someEnabled =
    (filtered?.length ?? 0) > 0 &&
    filtered.some((p) => enabledMap.get(p.id)?.is_active) &&
    !allEnabled;

  const toggleAll = async (on: boolean) => {
    for (const p of filtered) {
      const isOn = !!enabledMap.get(p.id)?.is_active;
      if (isOn !== on) {
        // eslint-disable-next-line no-await-in-loop
        await toggle(p.id, on);
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" /> Customizable products
            </CardTitle>
            <CardDescription>
              Toggle which of this store's products can be personalized in the customizer.
              All products in your catalog show in the storefront — this only controls the
              "Customize" button.
            </CardDescription>
          </div>
          <Badge variant="secondary">
            {enabledCount} enabled
          </Badge>
        </div>

        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <Button size="sm" onClick={syncToStore} disabled={syncing || (products?.length ?? 0) === 0}>
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Sync to store
          </Button>
          <span className="text-xs text-muted-foreground">
            Pushes all your products to {store.name}; only the checked ones get the customizer.
          </span>
        </div>

        {storefrontUrl && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <code className="text-xs bg-muted px-2 py-1 rounded truncate max-w-xs">
              {storefrontUrl}
            </code>
            <Button size="sm" variant="outline" onClick={copyUrl}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy link"}
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href={storefrontUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" /> Preview
              </a>
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="relative mb-3">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products…"
            className="pl-8"
          />
        </div>

        {loadingProducts || loadingLinks ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No products found. Add products in the Products tab first.
          </div>
        ) : (
          <>
            <label className="flex items-center gap-3 p-2 mb-2 rounded-md border bg-muted/30 cursor-pointer">
              <Checkbox
                checked={allEnabled ? true : someEnabled ? "indeterminate" : false}
                onCheckedChange={(v) => toggleAll(!!v)}
              />
              <span className="text-sm font-medium">
                Select all {search ? "(filtered)" : ""} ({filtered.length})
              </span>
            </label>
          <div className="grid gap-2 sm:grid-cols-2">
            {filtered.map((p) => {
              const link = enabledMap.get(p.id);
              const enabled = !!link?.is_active;
              return (
                <label
                  key={p.id}
                  className="flex items-center gap-3 p-2 rounded-md border hover:bg-muted/40 cursor-pointer"
                >
                  <Checkbox
                    checked={enabled}
                    disabled={savingId === p.id}
                    onCheckedChange={(v) => toggle(p.id, !!v)}
                  />
                  <div className="h-10 w-10 rounded bg-muted overflow-hidden shrink-0 flex items-center justify-center">
                    {p.image_front ? (
                      <img src={p.image_front} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Package className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {p.category ?? "—"} · ${Number(p.base_price ?? 0).toFixed(2)}
                    </p>
                  </div>
                  {savingId === p.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                </label>
              );
            })}
          </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
