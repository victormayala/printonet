import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Package, Search, ExternalLink, Copy, Check, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  product: {
    id: string;
    name: string;
    category: string | null;
    base_price: number;
    image_front: string | null;
  };
};

export function StoreCustomizableProducts({ store }: { store: CorporateStore }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const queryKey = ["store_customizer_flags", store.id];

  const { data: rows = [], isLoading, refetch, isFetching } = useQuery<Row[]>({
    queryKey,
    enabled: !!user?.id,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    staleTime: 0,
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
        .select("id,name,category,base_price,image_front")
        .in("id", ids);
      if (pErr) throw pErr;
      const pMap = new Map((prods ?? []).map((p) => [p.id, p]));
      return (links ?? [])
        .map((l) => {
          const product = pMap.get(l.product_id);
          if (!product) return null;
          return {
            id: l.id,
            product_id: l.product_id,
            customizable: !!l.customizable,
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
  const [syncing, setSyncing] = useState(false);

  /**
   * Push the current set of enabled product ids to the tenant storefront so the
   * `Customize` button shows up there. The storefront `/customizer-flags`
   * endpoint is upsert+prune — whatever we send becomes the full set — so we
   * always send EVERY currently-enabled product id, not just the one that was
   * just toggled.
   */
  const syncFlagsToStorefront = async (enabledIds: string[]) => {
    const slug =
      store.tenant_slug ||
      (store.wp_site_url
        ? (() => {
            try {
              return new URL(store.wp_site_url).host.toLowerCase().replace(/^www\./, "");
            } catch {
              return null;
            }
          })()
        : null);
    if (!slug) {
      toast({
        title: "Storefront not synced",
        description: "Store has no tenant slug yet.",
        variant: "destructive",
      });
      return;
    }
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-catalog-to-tenant", {
        body: {
          tenant_slug: slug,
          custom_domain: store.custom_domain || undefined,
          mode: "incremental",
          // Push every active store product so the storefront has full catalog
          // info, but flag only the enabled ones as customizable.
          product_ids: rows.map((r) => r.product_id),
          customizable_product_ids: enabledIds,
          customizer_base_url: window.location.origin,
        },
      });
      if (error) throw error;
      const flagsRes = (data as any)?.flags_result;
      const flagsErr = flagsRes && "error" in flagsRes ? flagsRes.error : null;
      if (flagsErr) {
        toast({
          title: "Storefront flag sync failed",
          description: String(flagsErr),
          variant: "destructive",
        });
      } else {
        toast({
          title: "Storefront updated",
          description: `${enabledIds.length} customizable product${enabledIds.length === 1 ? "" : "s"} pushed to ${slug}.`,
        });
      }
    } catch (e) {
      toast({
        title: "Storefront sync failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

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

      // Push the new full enabled set to the storefront so the Customize
      // button actually appears / disappears there. Without this the DB row
      // changes but the tenant storefront keeps its old flag set.
      const nextEnabledIds = rows
        .map((r) => (r.id === row.id ? { ...r, customizable: !!updated.customizable } : r))
        .filter((r) => r.customizable)
        .map((r) => r.product_id);
      void syncFlagsToStorefront(nextEnabledIds);
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
              Flip a switch to enable the "Customize" button on the storefront.
              Changes save instantly and the live storefront picks them up on next load.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{enabledCount} of {rows.length} enabled</Badge>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => refetch()}
              disabled={isFetching}
              title="Refresh from database"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
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
            {rows.length === 0
              ? "No products in this store yet. Use \"Push products\" to add some."
              : "No products match your search."}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 p-2 mb-2 rounded-md border bg-muted/30">
              <span className="text-sm font-medium">
                {search ? `${filtered.length} match${filtered.length === 1 ? "" : "es"}` : `${filtered.length} product${filtered.length === 1 ? "" : "s"}`}
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
                    <div className="flex items-center gap-2 shrink-0">
                      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                      <Switch
                        checked={r.customizable}
                        disabled={busy || bulkBusy}
                        onCheckedChange={(v) => toggleOne(r, v)}
                        aria-label={`Toggle customizer for ${p.name}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
