import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Package, Search } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { CorporateStore, resolveTenantSlug } from "@/types/corporateStore";

type InventoryProductRow = {
  id: string;
  name: string;
  base_price: number;
  sale_price: number | null;
  image_front: string | null;
  is_active: boolean;
  category_id: string | null;
  subcategory_id: string | null;
};

type CategoryRow = { id: string; name: string };

export function PushProductsDialog({
  store,
  open,
  onOpenChange,
}: {
  store: CorporateStore;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { user } = useAuth();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [pushing, setPushing] = useState(false);

  const { data: products, isLoading } = useQuery({
    queryKey: ["inventory_products_for_push", user?.id],
    enabled: !!user?.id && open,
    queryFn: async (): Promise<InventoryProductRow[]> => {
      const { data, error } = await supabase
        .from("inventory_products")
        .select("id,name,base_price,sale_price,image_front,is_active,category_id,subcategory_id")
        .eq("user_id", user!.id)
        .eq("is_active", true)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as InventoryProductRow[];
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["product_categories_for_push", user?.id],
    enabled: !!user?.id && open,
    queryFn: async (): Promise<CategoryRow[]> => {
      const { data, error } = await supabase
        .from("product_categories")
        .select("id,name")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []) as CategoryRow[];
    },
  });

  const filtered = (products ?? []).filter((p) =>
    p.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id));
  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) filtered.forEach((p) => next.delete(p.id));
      else filtered.forEach((p) => next.add(p.id));
      return next;
    });
  };

  const handlePush = async () => {
    const tenantSlug = resolveTenantSlug(store);
    if (!tenantSlug) {
      toast({
        title: "Missing tenant slug",
        description: "This store has no tenant_slug or site URL configured.",
        variant: "destructive",
      });
      return;
    }
    if (selected.size === 0) {
      toast({ title: "Select at least one product", variant: "destructive" });
      return;
    }

    const catById = new Map((categories ?? []).map((c) => [c.id, c]));
    const chosen = (products ?? []).filter((p) => selected.has(p.id));
    const payloadProducts = chosen.map((p) => {
      const price = Number(p.sale_price ?? p.base_price ?? 0);
      const root = p.category_id ? catById.get(p.category_id) : null;
      const sub = p.subcategory_id ? catById.get(p.subcategory_id) : null;
      return {
        id: p.id,
        name: p.name,
        price_cents: Math.max(0, Math.round(price * 100)),
        currency_code: "usd",
        ...(root ? { category: root.name, category_name: root.name } : {}),
        ...(sub ? { subcategory: sub.name, subcategory_name: sub.name } : {}),
        ...(root
          ? {
              categories: [
                sub
                  ? { name: root.name, children: [{ name: sub.name }] }
                  : { name: root.name },
              ],
            }
          : {}),
      };
    });

    setPushing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-catalog-to-tenant", {
        body: {
          tenant_slug: tenantSlug,
          wp_site_url: store.wp_site_url ?? undefined,
          products: payloadProducts,
        },
      });
      const errMsg =
        (error as Error | null)?.message ||
        (data as { error?: string } | null)?.error;
      if (errMsg) throw new Error(errMsg);
      toast({
        title: "Catalog pushed",
        description: `${chosen.length} product${chosen.length === 1 ? "" : "s"} sent to ${store.name}.`,
      });
      setSelected(new Set());
      onOpenChange(false);
    } catch (e) {
      toast({
        title: "Push failed",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setPushing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Push products to {store.name}</DialogTitle>
          <DialogDescription>
            Select the products to publish on this corporate store. Existing items with the same id are updated.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={toggleAll}
              className="text-primary hover:underline"
              disabled={filtered.length === 0}
            >
              {allSelected ? "Deselect all" : "Select all"}
            </button>
            <span className="text-muted-foreground">{selected.size} selected</span>
          </div>

          <ScrollArea className="h-[340px] rounded border">
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading products...
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                No active products found.
              </div>
            ) : (
              <div className="divide-y">
                {filtered.map((p) => {
                  const checked = selected.has(p.id);
                  const price = Number(p.sale_price ?? p.base_price ?? 0);
                  return (
                    <label
                      key={p.id}
                      className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/40"
                    >
                      <Checkbox checked={checked} onCheckedChange={() => toggle(p.id)} />
                      {p.image_front ? (
                        <img
                          src={p.image_front}
                          alt=""
                          className="h-10 w-10 object-cover rounded bg-muted"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                          <Package className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground">${price.toFixed(2)}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pushing}>
            Cancel
          </Button>
          <Button onClick={handlePush} disabled={pushing || selected.size === 0}>
            {pushing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Push {selected.size > 0 ? `${selected.size} ` : ""}product{selected.size === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
