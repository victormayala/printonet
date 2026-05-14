import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Package, Search, Upload, X } from "lucide-react";

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
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "@/hooks/use-toast";
import { CorporateStore, resolveTenantSlug } from "@/types/corporateStore";

type ViewKey = "front" | "back" | "side1" | "side2";
const ALL_VIEWS: ViewKey[] = ["front", "back", "side1", "side2"];

type InventoryProductRow = {
  id: string;
  name: string;
  base_price: number;
  sale_price: number | null;
  image_front: string | null;
  image_back: string | null;
  image_side1: string | null;
  image_side2: string | null;
  is_active: boolean;
  category_id: string | null;
  subcategory_id: string | null;
};

type Position = { x_pct: number; y_pct: number; width_pct: number; rotation_deg: number };
type ViewState = { enabled: boolean; position: Position; rowId: string | null };

type LogoState = {
  logoUrl: string | null;
  logoFile: File | null;
  views: Record<ViewKey, ViewState>;
};

const DEFAULT_POS: Position = { x_pct: 0.5, y_pct: 0.5, width_pct: 0.25, rotation_deg: 0 };

function defaultLogoState(): LogoState {
  return {
    logoUrl: null,
    logoFile: null,
    views: {
      front: { enabled: false, position: { ...DEFAULT_POS }, rowId: null },
      back: { enabled: false, position: { ...DEFAULT_POS }, rowId: null },
      side1: { enabled: false, position: { ...DEFAULT_POS }, rowId: null },
      side2: { enabled: false, position: { ...DEFAULT_POS }, rowId: null },
    },
  };
}

const VIEW_LABEL: Record<ViewKey, string> = {
  front: "Front",
  back: "Back",
  side1: "Left",
  side2: "Right",
};

function getMockup(p: InventoryProductRow, v: ViewKey): string | null {
  if (v === "front") return p.image_front;
  if (v === "back") return p.image_back;
  if (v === "side1") return p.image_side1;
  return p.image_side2;
}

async function compositeLogo(
  mockupUrl: string,
  logoUrl: string,
  pos: Position,
): Promise<Blob> {
  const loadImg = (src: string) =>
    new Promise<HTMLImageElement>((res, rej) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = src;
    });
  const [mock, logo] = await Promise.all([loadImg(mockupUrl), loadImg(logoUrl)]);
  const canvas = document.createElement("canvas");
  canvas.width = mock.naturalWidth;
  canvas.height = mock.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(mock, 0, 0);
  const targetW = pos.width_pct * canvas.width;
  const ratio = logo.naturalHeight / Math.max(1, logo.naturalWidth);
  const targetH = targetW * ratio;
  const cx = pos.x_pct * canvas.width;
  const cy = pos.y_pct * canvas.height;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((pos.rotation_deg * Math.PI) / 180);
  ctx.drawImage(logo, -targetW / 2, -targetH / 2, targetW, targetH);
  ctx.restore();
  return await new Promise<Blob>((res) =>
    canvas.toBlob((b) => res(b!), "image/png"),
  );
}

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
  const isCorporate = store.store_type === "corporate";
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [pushing, setPushing] = useState(false);
  const [logos, setLogos] = useState<Record<string, LogoState>>({});

  const { data: products, isLoading } = useQuery({
    queryKey: ["inventory_products_for_push", user?.id],
    enabled: !!user?.id && open,
    queryFn: async (): Promise<InventoryProductRow[]> => {
      const { data, error } = await supabase
        .from("inventory_products")
        .select(
          "id,name,base_price,sale_price,image_front,image_back,image_side1,image_side2,is_active,category_id,subcategory_id",
        )
        .eq("user_id", user!.id)
        .eq("is_active", true)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as InventoryProductRow[];
    },
  });

  // Pre-load any saved corporate logos for this store when dialog opens.
  useEffect(() => {
    if (!open || !isCorporate || !user?.id) return;
    (async () => {
      const { data, error } = await supabase
        .from("corporate_store_product_logos")
        .select("id,product_id,view,logo_url,position")
        .eq("store_id", store.id);
      if (error || !data) return;
      const next: Record<string, LogoState> = {};
      for (const row of data) {
        const pid = row.product_id;
        if (!next[pid]) next[pid] = defaultLogoState();
        next[pid].logoUrl = row.logo_url;
        const v = row.view as ViewKey;
        next[pid].views[v] = {
          enabled: true,
          position: row.position as Position,
          rowId: row.id,
        };
      }
      setLogos(next);
    })();
  }, [open, isCorporate, user?.id, store.id]);

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

  const getLogo = (pid: string): LogoState => logos[pid] ?? defaultLogoState();

  const updateLogo = (productId: string, patch: Partial<LogoState>) => {
    setLogos((prev) => {
      const cur = prev[productId] ?? defaultLogoState();
      return { ...prev, [productId]: { ...cur, ...patch } };
    });
  };

  const updateView = (productId: string, view: ViewKey, patch: Partial<ViewState>) => {
    setLogos((prev) => {
      const cur = prev[productId] ?? defaultLogoState();
      return {
        ...prev,
        [productId]: {
          ...cur,
          views: { ...cur.views, [view]: { ...cur.views[view], ...patch } },
        },
      };
    });
  };

  const onPickLogoFile = (productId: string, file: File | null) => {
    if (!file) {
      updateLogo(productId, { logoFile: null });
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast({ title: "Logo too large (max 4 MB)", variant: "destructive" });
      return;
    }
    updateLogo(productId, {
      logoFile: file,
      logoUrl: URL.createObjectURL(file),
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
    if (!user?.id) return;

    const chosen = (products ?? []).filter((p) => selected.has(p.id));
    const productIds = chosen.map((p) => p.id);
    const imageOverrides: Record<string, Partial<Record<ViewKey, string>>> = {};

    setPushing(true);
    try {
      if (isCorporate) {
        for (const p of chosen) {
          const state = logos[p.id];
          if (!state) continue;
          const enabledViews = ALL_VIEWS.filter(
            (v) => state.views[v].enabled && !!getMockup(p, v),
          );
          if (enabledViews.length === 0) continue;

          // 1) Upload the raw logo file once if user picked a new one.
          let logoUrl = state.logoUrl;
          if (state.logoFile) {
            const ext = state.logoFile.name.split(".").pop() || "png";
            const path = `${user.id}/${store.id}/logos/${p.id}-${Date.now()}.${ext}`;
            const { error: upErr } = await supabase.storage
              .from("corporate-store-assets")
              .upload(path, state.logoFile, { upsert: true, contentType: state.logoFile.type });
            if (upErr) throw upErr;
            logoUrl = supabase.storage.from("corporate-store-assets").getPublicUrl(path).data.publicUrl;
            // Mark file as consumed so subsequent loops don't re-upload.
            state.logoFile = null;
            state.logoUrl = logoUrl;
          }
          if (!logoUrl) continue;

          for (const view of enabledViews) {
            const mockup = getMockup(p, view)!;
            const vs = state.views[view];

            // 2) Save / upsert metadata for this view.
            await supabase.from("corporate_store_product_logos").upsert(
              {
                user_id: user.id,
                store_id: store.id,
                product_id: p.id,
                view,
                logo_url: logoUrl,
                position: vs.position,
              },
              { onConflict: "store_id,product_id,view" },
            );

            // 3) Bake composite using a CORS-friendly URL for the mockup.
            let mockupForCanvas = mockup;
            try {
              const { data: proxied } = await supabase.functions.invoke("proxy-image", {
                body: { url: mockup },
              });
              const dataUrl = (proxied as { dataUrl?: string } | null)?.dataUrl;
              if (dataUrl) mockupForCanvas = dataUrl;
            } catch {
              /* fall back to direct URL */
            }
            const blob = await compositeLogo(mockupForCanvas, logoUrl, vs.position);

            const compositePath = `${user.id}/${store.id}/composites/${p.id}-${view}-${Date.now()}.png`;
            const { error: cErr } = await supabase.storage
              .from("corporate-store-assets")
              .upload(compositePath, blob, { upsert: true, contentType: "image/png" });
            if (cErr) throw cErr;
            const compUrl = supabase.storage
              .from("corporate-store-assets")
              .getPublicUrl(compositePath).data.publicUrl;

            imageOverrides[p.id] = { ...(imageOverrides[p.id] ?? {}), [view]: compUrl };
          }

          // Remove DB rows for views the user disabled.
          const disabled = ALL_VIEWS.filter((v) => !state.views[v].enabled);
          if (disabled.length > 0) {
            await supabase
              .from("corporate_store_product_logos")
              .delete()
              .eq("store_id", store.id)
              .eq("product_id", p.id)
              .in("view", disabled);
          }
        }
      }

      // Link products to the store so the hosted storefront can list them.
      const linkRows = productIds.map((pid, idx) => ({
        user_id: user.id,
        store_id: store.id,
        product_id: pid,
        is_active: true,
        sort_order: idx,
      }));
      const { error: linkErr } = await supabase
        .from("corporate_store_products")
        .upsert(linkRows, { onConflict: "store_id,product_id" });
      if (linkErr) throw linkErr;

      // Note: composite imageOverrides are baked into corporate-store-assets and
      // available to the hosted storefront via corporate_store_product_logos /
      // platform-rpc. We no longer push the catalog to an external WordPress
      // tenant — the linked Lovable storefront reads directly from this DB.
      void imageOverrides;
      void tenantSlug;
      toast({
        title: "Products published",
        description: `${chosen.length} product${chosen.length === 1 ? "" : "s"} added to ${store.name}.`,
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
      <DialogContent className="max-w-2xl h-[85vh] flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle>Push products to {store.name}</DialogTitle>
          <DialogDescription>
            {isCorporate
              ? "Select products and choose which mockup views (Front, Back, Left, Right) should carry the corporation's logo. Each enabled view gets its own position."
              : "Select the products to publish on this store. Existing items with the same id are updated."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-hidden">
          <div className="relative shrink-0">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          <div className="flex items-center justify-between text-sm shrink-0">
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

          <ScrollArea className="flex-1 min-h-0 rounded border">
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
                  const state = getLogo(p.id);
                  const enabledCount = ALL_VIEWS.filter((v) => state.views[v].enabled).length;
                  const availableViews = ALL_VIEWS.filter((v) => !!getMockup(p, v));
                  return (
                    <div key={p.id} className="p-3 hover:bg-muted/40">
                      <label className="flex items-center gap-3 cursor-pointer">
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

                      {isCorporate && checked && (
                        <Collapsible defaultOpen className="mt-3 pl-7">
                          <CollapsibleTrigger className="text-xs font-medium text-muted-foreground hover:text-foreground">
                            Corporate logo {state.logoUrl ? `✓ (${enabledCount} view${enabledCount === 1 ? "" : "s"})` : "(optional)"}
                          </CollapsibleTrigger>
                          <CollapsibleContent className="mt-2 space-y-3 rounded border bg-card p-3">
                            {/* Logo upload */}
                            <div className="flex items-center gap-2">
                              <label className="inline-flex">
                                <input
                                  type="file"
                                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                                  className="hidden"
                                  onChange={(e) => onPickLogoFile(p.id, e.target.files?.[0] ?? null)}
                                />
                                <Button asChild type="button" size="sm" variant="outline">
                                  <span>
                                    <Upload className="h-3 w-3 mr-1" />
                                    {state.logoUrl ? "Replace logo" : "Upload logo"}
                                  </span>
                                </Button>
                              </label>
                              {state.logoUrl && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => updateLogo(p.id, { logoUrl: null, logoFile: null })}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              )}
                            </div>

                            {/* Per-view image picker — shows all available mockups as thumbnails */}
                            {state.logoUrl && availableViews.length > 0 && (
                              <div className="space-y-3">
                                <p className="text-xs text-muted-foreground">
                                  Click an image to add the corporate logo to it. You can pick multiple.
                                </p>
                                <div className="grid grid-cols-4 gap-2">
                                  {availableViews.map((v) => {
                                    const vs = state.views[v];
                                    const mockup = getMockup(p, v)!;
                                    return (
                                      <button
                                        key={v}
                                        type="button"
                                        onClick={() =>
                                          updateView(p.id, v, { enabled: !vs.enabled })
                                        }
                                        className={`group relative aspect-square rounded border-2 overflow-hidden bg-muted transition-all ${
                                          vs.enabled
                                            ? "border-primary ring-2 ring-primary/30"
                                            : "border-border hover:border-muted-foreground"
                                        }`}
                                        title={`${vs.enabled ? "Remove logo from" : "Add logo to"} ${VIEW_LABEL[v]}`}
                                      >
                                        <img
                                          src={mockup}
                                          alt={VIEW_LABEL[v]}
                                          className="absolute inset-0 h-full w-full object-contain"
                                        />
                                        {vs.enabled && (
                                          <img
                                            src={state.logoUrl}
                                            alt=""
                                            className="absolute pointer-events-none"
                                            style={{
                                              left: `${vs.position.x_pct * 100}%`,
                                              top: `${vs.position.y_pct * 100}%`,
                                              width: `${vs.position.width_pct * 100}%`,
                                              transform: `translate(-50%, -50%) rotate(${vs.position.rotation_deg}deg)`,
                                            }}
                                          />
                                        )}
                                        <div className="absolute top-1 left-1">
                                          <Checkbox
                                            checked={vs.enabled}
                                            className="bg-background/90 pointer-events-none"
                                          />
                                        </div>
                                        <div className="absolute bottom-0 inset-x-0 bg-background/80 text-[10px] py-0.5 text-center font-medium">
                                          {VIEW_LABEL[v]}
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>

                                {/* Position controls per enabled view */}
                                {availableViews.filter((v) => state.views[v].enabled).length > 0 && (
                                  <div className="space-y-3 border-t pt-3">
                                    {availableViews
                                      .filter((v) => state.views[v].enabled)
                                      .map((v) => {
                                        const vs = state.views[v];
                                        return (
                                          <div key={v} className="space-y-2">
                                            <Label className="text-xs font-semibold">
                                              {VIEW_LABEL[v]} placement
                                            </Label>
                                            <div className="grid grid-cols-3 gap-2">
                                              <PositionSlider
                                                label="X"
                                                value={vs.position.x_pct}
                                                onChange={(x) =>
                                                  updateView(p.id, v, {
                                                    position: { ...vs.position, x_pct: x },
                                                  })
                                                }
                                              />
                                              <PositionSlider
                                                label="Y"
                                                value={vs.position.y_pct}
                                                onChange={(y) =>
                                                  updateView(p.id, v, {
                                                    position: { ...vs.position, y_pct: y },
                                                  })
                                                }
                                              />
                                              <PositionSlider
                                                label="Size"
                                                value={vs.position.width_pct}
                                                min={0.05}
                                                max={0.8}
                                                onChange={(w) =>
                                                  updateView(p.id, v, {
                                                    position: { ...vs.position, width_pct: w },
                                                  })
                                                }
                                              />
                                            </div>
                                          </div>
                                        );
                                      })}
                                  </div>
                                )}
                              </div>
                            )}
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                    </div>
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

function PositionSlider({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <span className="text-xs text-muted-foreground tabular-nums">
          {Math.round(value * 100)}%
        </span>
      </div>
      <Slider
        min={min * 100}
        max={max * 100}
        step={1}
        value={[value * 100]}
        onValueChange={([v]) => onChange(v / 100)}
      />
    </div>
  );
}
