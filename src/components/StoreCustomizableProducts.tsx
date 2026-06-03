import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Package, Search, RefreshCw, Plus, Trash2, CloudUpload, ImagePlus, RotateCw } from "lucide-react";
import { PushProductsDialog } from "@/components/PushProductsDialog";
import { ProductLogoThumbnail, type LogoOverlay } from "@/components/ProductLogoThumbnail";
import { EditProductLogoDialog, type EditableProduct } from "@/components/EditProductLogoDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { toast } from "@/hooks/use-toast";
import { CorporateStore } from "@/types/corporateStore";

/**
 * Customizer selector — rebuilt from scratch.
 *
 * Goals:
 *  - One source of truth: the database. We always render exactly what the DB says.
 *  - Per-row immediate save. No drafts, no batched UI, no "did it actually save?".
 *  - After every save we re-read THAT row's value back from the DB and toast it,
 *    so the user can see in the UI that what they tapped is what got persisted.
 *  - Bulk enable / disable hits the DB then re-fetches.
 */

type Row = {
  id: string; // corporate_store_products.id
  product_id: string;
  customizable: boolean;
  front_logo: LogoOverlay | null;
  logo_view_count: number;
  product: {
    id: string;
    name: string;
    category: string | null;
    base_price: number;
    image_front: string | null;
    image_back: string | null;
    image_side1: string | null;
    image_side2: string | null;
  };
};

export function StoreCustomizableProducts({ store }: { store: CorporateStore }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pushOpen, setPushOpen] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [editingProduct, setEditingProduct] = useState<EditableProduct | null>(null);

  const isCorporate = store.store_type === "corporate";
  const queryKey = ["store_customizer_flags", store.id];

  /**
   * Push the full customizer-flag snapshot for this store to the hosted
   * storefront. The edge function signs the payload with the platform HMAC
   * secret and POSTs to `/api/public/{tenant_slug}/customizer-flags`.
   * Fire-and-log: UI toggles still save to the DB regardless of push result.
   */
  const pushSnapshot = async (opts?: { silent?: boolean }) => {
    // Dashboard-only stores (Shopify/WooCommerce sync containers) have no
    // tenant_slug and no hosted storefront. Their injected store plugin/loader
    // reads these DB flags live, so there is no hosted storefront snapshot to push.
    if (!store.tenant_slug) {
      if (store.store_type === "shopify") {
        try {
          const { error } = await supabase.functions.invoke("sync-shopify-customizer", {
            body: { storeId: store.id },
          });
          if (error) {
            const ctx = (error as { context?: { text?: () => Promise<string> } }).context;
            let friendly: string | null = null;
            try {
              const txt = ctx && typeof ctx.text === "function" ? await ctx.text() : null;
              if (txt) {
                const parsed = JSON.parse(txt);
                friendly = parsed?.message || parsed?.error || null;
              }
            } catch {/* ignore */}
            throw new Error(friendly || error.message || "Shopify sync failed");
          }
        } catch (e) {
          toast({
            title: "Shopify resync failed",
            description: e instanceof Error ? e.message : String(e),
            variant: "destructive",
          });
          return false;
        }
      }
      if (!opts?.silent) {
        const platform = store.store_type === "shopify" ? "Shopify" : store.store_type === "woocommerce" ? "WooCommerce" : "this store";
        toast({
          title: "Customizer settings are live",
          description: `${platform} reads enabled products directly from Printonet. Refresh the storefront product page to see changes.`,
        });
      }
      return true;
    }
    try {
      const { data, error } = await supabase.functions.invoke("sync-customizer-flags", {
        body: { storeId: store.id },
      });
      if (error) throw error;
      if (!opts?.silent) {
        toast({
          title: "Storefront synced",
          description: `${data?.sent_items ?? 0} customizable product${(data?.sent_items ?? 0) === 1 ? "" : "s"} sent to ${store.tenant_slug}.`,
        });
      }
      return true;
    } catch (e) {
      toast({
        title: "Storefront sync failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
      return false;
    }
  };

  const { data: rows = [], isLoading, refetch, isFetching } = useQuery<Row[]>({
    queryKey,
    enabled: !!user?.id,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
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
        .select("id,name,category,base_price,image_front,image_back,image_side1,image_side2")
        .in("id", ids);
      if (pErr) throw pErr;
      const pMap = new Map((prods ?? []).map((p) => [p.id, p]));

      // Pull all logo overlay rows so we can show the front thumbnail AND
      // know how many views each product has logos on.
      const { data: logoRows } = await supabase
        .from("corporate_store_product_logos")
        .select("product_id,view,logo_url,position")
        .eq("store_id", store.id)
        .in("product_id", ids);
      const frontLogoMap = new Map<string, LogoOverlay>();
      const viewCountMap = new Map<string, number>();
      for (const r of logoRows ?? []) {
        viewCountMap.set(r.product_id, (viewCountMap.get(r.product_id) ?? 0) + 1);
        if (r.view === "front") {
          frontLogoMap.set(r.product_id, {
            logo_url: r.logo_url,
            position: r.position as LogoOverlay["position"],
          });
        }
      }

      return (links ?? [])
        .map((l) => {
          const product = pMap.get(l.product_id);
          if (!product) return null;
          return {
            id: l.id,
            product_id: l.product_id,
            customizable: !!l.customizable,
            front_logo: frontLogoMap.get(l.product_id) ?? null,
            logo_view_count: viewCountMap.get(l.product_id) ?? 0,
            product,
          } as Row;
        })
        .filter((r): r is Row => r !== null)
        .sort((a, b) => a.product.name.localeCompare(b.product.name));
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.product.name.toLowerCase().includes(q) ||
        (r.product.category ?? "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  const enabledCount = rows.filter((r) => r.customizable).length;

  // Every write that affects which products are customizable on the storefront
  // triggers a signed full-snapshot push via the sync-customizer-flags edge
  // function. The DB row remains the source of truth; the push keeps the
  // storefront's tenant_customizer_flags table in sync.


  /**
   * Toggle one row, then re-read it from the DB to prove it stuck.
   * Updates by primary key so there is no risk of touching a different row.
   */
  const toggleOne = async (row: Row, next: boolean) => {
    if (pendingId) return;
    setPendingId(row.id);

    // Optimistic UI
    qc.setQueryData<Row[]>(queryKey, (prev) =>
      (prev ?? []).map((r) => (r.id === row.id ? { ...r, customizable: next } : r)),
    );

    try {
      const { data: updated, error } = await supabase
        .from("corporate_store_products")
        .update({ customizable: next })
        .eq("id", row.id)
        .select("id,customizable")
        .single();

      if (error) throw error;
      if (!updated) throw new Error("Row not updated (RLS or row missing)");

      // Reconcile with what the DB actually now holds.
      qc.setQueryData<Row[]>(queryKey, (prev) =>
        (prev ?? []).map((r) =>
          r.id === updated.id ? { ...r, customizable: !!updated.customizable } : r,
        ),
      );

      toast({
        title: updated.customizable ? "Customizer enabled" : "Customizer disabled",
        description: row.product.name,
      });

      // Push fresh snapshot to the storefront. Silent unless it fails.
      void pushSnapshot({ silent: true });
    } catch (e) {
      // Revert and surface
      await refetch();
      toast({
        title: "Could not save",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setPendingId(null);
    }
  };

  const setAllVisible = async (next: boolean) => {
    if (bulkBusy || !user?.id) return;
    const targets = filtered.filter((r) => r.customizable !== next);
    if (targets.length === 0) return;
    setBulkBusy(true);

    try {
      const ids = targets.map((r) => r.id);
      const { error } = await supabase
        .from("corporate_store_products")
        .update({ customizable: next })
        .in("id", ids);
      if (error) throw error;

      await qc.invalidateQueries({ queryKey });
      toast({
        title: next
          ? `Enabled customizer on ${targets.length} product${targets.length === 1 ? "" : "s"}`
          : `Disabled customizer on ${targets.length} product${targets.length === 1 ? "" : "s"}`,
      });

      void pushSnapshot({ silent: true });
    } catch (e) {
      toast({
        title: "Bulk update failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setBulkBusy(false);
    }
  };

  const removeOne = async (row: Row) => {
    if (pendingId) return;
    if (!confirm(`Remove "${row.product.name}" from this store? Customers will no longer see it.`)) return;
    setPendingId(row.id);
    try {
      // Clean up corporate logo overrides for this product (if any).
      await supabase
        .from("corporate_store_product_logos")
        .delete()
        .eq("store_id", store.id)
        .eq("product_id", row.product_id);

      const { error } = await supabase
        .from("corporate_store_products")
        .delete()
        .eq("id", row.id);
      if (error) throw error;

      qc.setQueryData<Row[]>(queryKey, (prev) => (prev ?? []).filter((r) => r.id !== row.id));
      toast({ title: "Product removed", description: row.product.name });
      // If the removed row was customizable it must drop off the storefront snapshot.
      if (row.customizable) void pushSnapshot({ silent: true });
    } catch (e) {
      await refetch();
      toast({
        title: "Could not remove",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setPendingId(null);
    }
  };

  const storefrontUrl = store.tenant_slug
    ? `${window.location.origin}/s/${store.tenant_slug}`
    : null;

  const copyUrl = async () => {
    if (!storefrontUrl) return;
    await navigator.clipboard.writeText(storefrontUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleImportProducts = async () => {
    if (importBusy) return;
    if (store.store_type !== "shopify" && store.store_type !== "woocommerce") return;
    setImportBusy(true);
    try {
      const fn = store.store_type === "shopify" ? "import-shopify-products" : "import-woocommerce-products";
      const { data, error } = await supabase.functions.invoke(fn, {
        body: { user_id: user?.id, is_sync: true },
      });
      if (error) throw error;
      toast({
        title: "Products synced",
        description: `Imported ${data?.imported_count ?? 0}${typeof data?.total === "number" ? ` of ${data.total}` : ""} products.`,
      });
      await qc.invalidateQueries({ queryKey });
    } catch (e) {
      toast({
        title: "Sync failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setImportBusy(false);
    }
  };




  return (
    <div className="space-y-6">
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" /> Store products
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setPushOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Add products
            </Button>
            {(store.store_type === "shopify" || store.store_type === "woocommerce") && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleImportProducts}
                disabled={importBusy}
                title={`Re-import products from ${store.store_type === "shopify" ? "Shopify" : "WooCommerce"}`}
              >
                <RotateCw className={`h-3.5 w-3.5 ${importBusy ? "animate-spin" : ""}`} />
                {importBusy ? "Syncing…" : "Sync Products"}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                if (syncBusy) return;
                setSyncBusy(true);
                await pushSnapshot();
                setSyncBusy(false);
              }}
              disabled={syncBusy}
              title="Send a fresh full snapshot of customizable products to the storefront"
            >
              <CloudUpload className={`h-3.5 w-3.5 ${syncBusy ? "animate-pulse" : ""}`} />
              {syncBusy ? "Syncing…" : "Resync to storefront"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => refetch()}
              disabled={isFetching}
              title="Refresh from database"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
        <CardDescription>
          Products listed below have been pushed to this store. Use <span className="font-medium text-foreground">Add products</span> to send more from your inventory.
          Flip a switch to enable the "Customize" button on the storefront — changes save instantly.
        </CardDescription>
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
          <div className="py-10 text-center text-sm text-muted-foreground space-y-3">
            {rows.length === 0 ? (
              <>
                <p>No products in this store yet.</p>
                <Button size="sm" onClick={() => setPushOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> Add products
                </Button>
              </>
            ) : (
              <p>No products match your search.</p>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 p-2 mb-2 rounded-md border bg-muted/30">
              <span className="text-sm font-medium">
                {rows.length} in store · {enabledCount} customizable
                {search && (
                  <span className="ml-2 text-muted-foreground font-normal">
                    · {filtered.length} match{filtered.length === 1 ? "" : "es"}
                  </span>
                )}
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={bulkBusy || filtered.every((r) => r.customizable)}
                  onClick={() => setAllVisible(true)}
                >
                  Enable all{search ? " (filtered)" : ""}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={bulkBusy || filtered.every((r) => !r.customizable)}
                  onClick={() => setAllVisible(false)}
                >
                  Disable all{search ? " (filtered)" : ""}
                </Button>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {filtered.map((r) => {
                const p = r.product;
                const busy = pendingId === r.id;
                return (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 p-2 rounded-md border hover:bg-muted/40"
                  >
                    <ProductLogoThumbnail
                      mockupUrl={p.image_front}
                      overlay={r.front_logo}
                      alt={p.name}
                      className="h-10 w-10 rounded overflow-hidden shrink-0"
                      iconClassName="h-4 w-4 text-muted-foreground"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {p.category ?? "—"} · ${Number(p.base_price ?? 0).toFixed(2)}
                        {isCorporate && r.logo_view_count > 0 && (
                          <span className="ml-1">· logo on {r.logo_view_count} view{r.logo_view_count === 1 ? "" : "s"}</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                      <TooltipProvider delayDuration={200}>
                        {isCorporate && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                disabled={busy || bulkBusy}
                                onClick={() => setEditingProduct(p)}
                                aria-label={`Edit logo placement for ${p.name}`}
                              >
                                <ImagePlus className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              {r.logo_view_count > 0 ? "Edit logo placement" : "Add corporate logo"}
                            </TooltipContent>
                          </Tooltip>
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-muted/60">
                              <span className="text-xs text-muted-foreground hidden sm:inline">
                                {r.customizable ? "Customizable" : "Not customizable"}
                              </span>
                              <Switch
                                checked={r.customizable}
                                disabled={busy || bulkBusy}
                                onCheckedChange={(v) => toggleOne(r, v)}
                                aria-label={`Toggle customizer for ${p.name}`}
                              />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            {r.customizable ? "Disable customizer for this product" : "Enable customizer for this product"}
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              disabled={busy || bulkBusy}
                              onClick={() => removeOne(r)}
                              aria-label={`Remove ${p.name} from store`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">Remove from store</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
      <PushProductsDialog
        store={store}
        open={pushOpen}
        onOpenChange={(v) => {
          setPushOpen(v);
          if (!v) qc.invalidateQueries({ queryKey });
        }}
      />
      <EditProductLogoDialog
        store={store}
        product={editingProduct}
        open={!!editingProduct}
        onOpenChange={(v) => {
          if (!v) setEditingProduct(null);
        }}
        onSaved={() => qc.invalidateQueries({ queryKey })}
      />
    </Card>
    </div>
  );
}
