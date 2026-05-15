import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Package, Search, ExternalLink, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { CorporateStore } from "@/types/corporateStore";

type Row = {
  id: string; // corporate_store_products.id
  product_id: string;
  customizable: boolean;
  product: {
    id: string;
    name: string;
    category: string | null;
    base_price: number;
    image_front: string | null;
  } | null;
};

export function StoreCustomizableProducts({ store }: { store: CorporateStore }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["corporate_store_products_customizable", store.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<Row[]> => {
      const { data: links, error } = await supabase
        .from("corporate_store_products")
        .select("id,product_id,customizable")
        .eq("store_id", store.id)
        .eq("is_active", true);
      if (error) throw error;
      const ids = (links ?? []).map((l) => l.product_id);
      if (ids.length === 0) return [];
      const { data: prods, error: pErr } = await supabase
        .from("inventory_products")
        .select("id,name,category,base_price,image_front")
        .in("id", ids);
      if (pErr) throw pErr;
      const pMap = new Map((prods ?? []).map((p) => [p.id, p]));
      return (links ?? []).map((l) => ({
        id: l.id,
        product_id: l.product_id,
        customizable: !!l.customizable,
        product: pMap.get(l.product_id) ?? null,
      })) as Row[];
    },
  });

  const filtered = useMemo(() => {
    const list = (rows ?? []).filter((r) => !!r.product);
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (r) =>
        r.product!.name.toLowerCase().includes(q) ||
        (r.product!.category ?? "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  const toggle = async (linkId: string, on: boolean) => {
    setSavingId(linkId);
    try {
      const { error } = await supabase
        .from("corporate_store_products")
        .update({ customizable: on })
        .eq("id", linkId);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["corporate_store_products_customizable", store.id] });
      toast({ title: on ? "Customizer enabled" : "Customizer disabled" });
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

  const allEnabled = filtered.length > 0 && filtered.every((r) => r.customizable);
  const someEnabled =
    filtered.length > 0 && filtered.some((r) => r.customizable) && !allEnabled;

  const toggleAll = async (on: boolean) => {
    const targets = filtered.filter((r) => r.customizable !== on);
    if (targets.length === 0) return;
    setSavingId("__bulk__");
    try {
      const { error } = await supabase
        .from("corporate_store_products")
        .update({ customizable: on })
        .in(
          "id",
          targets.map((r) => r.id),
        );
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["corporate_store_products_customizable", store.id] });
      toast({ title: on ? `Enabled customizer on ${targets.length} products` : `Disabled customizer on ${targets.length} products` });
      toast({
        title: "Could not update",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSavingId(null);
    }
  };

  const enabledCount = (rows ?? []).filter((r) => r.customizable).length;

  const storefrontUrl = store.tenant_slug
    ? `${window.location.origin}/s/${store.tenant_slug}`
    : null;

  const copyUrl = async () => {
    if (!storefrontUrl) return;
    await navigator.clipboard.writeText(storefrontUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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
              Of the products already pushed to this store, choose which ones get a
              "Customize" button. Use "Push products" to add or remove products from
              the store itself.
            </CardDescription>
          </div>
          <Badge variant="secondary">{enabledCount} customizable</Badge>
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

        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No products in this store yet. Use "Push products" to add some.
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
              {filtered.map((r) => {
                const p = r.product!;
                return (
                  <label
                    key={r.id}
                    className="flex items-center gap-3 p-2 rounded-md border hover:bg-muted/40 cursor-pointer"
                  >
                    <Checkbox
                      checked={r.customizable}
                      disabled={savingId === r.id || savingId === "__bulk__"}
                      onCheckedChange={(v) => toggle(r.id, !!v)}
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
                    {savingId === r.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
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
