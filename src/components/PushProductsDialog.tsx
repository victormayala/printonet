import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Package, Search, Upload, X, Image as ImageIcon } from "lucide-react";

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "@/hooks/use-toast";
import { CorporateStore, resolveTenantSlug } from "@/types/corporateStore";

type ViewKey = "front" | "back" | "side1" | "side2";

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

type LogoState = {
  // Existing or freshly uploaded logo URL.
  logoUrl: string | null;
  // If user is uploading a new file we keep it here until push.
  logoFile: File | null;
  view: ViewKey;
  position: { x_pct: number; y_pct: number; width_pct: number; rotation_deg: number };
  // Whether this row already exists in DB (for upsert clarity).
  rowId: string | null;
};

const DEFAULT_LOGO: LogoState = {
  logoUrl: null,
  logoFile: null,
  view: "front",
  position: { x_pct: 0.5, y_pct: 0.5, width_pct: 0.25, rotation_deg: 0 },
  rowId: null,
};

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

/** Render the mockup with the logo composited at the saved percentage position
 *  to a PNG data URL. Used at push time to bake the logo into the image. */
async function compositeLogo(
  mockupUrl: string,
  logoUrl: string,
  pos: LogoState["position"],
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
        next[row.product_id] = {
          logoUrl: row.logo_url,
          logoFile: null,
          view: row.view as ViewKey,
          position: row.position as LogoState["position"],
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

  const updateLogo = (productId: string, patch: Partial<LogoState>) => {
    setLogos((prev) => ({
      ...prev,
      [productId]: { ...DEFAULT_LOGO, ...prev[productId], ...patch },
    }));
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
      // For corporate stores: persist logo metadata + composite mockup once per
      // (product, view) and upload the result, then send override URLs.
      if (isCorporate) {
        for (const p of chosen) {
          const state = logos[p.id];
          if (!state) continue;
          const mockup = getMockup(p, state.view);
          if (!mockup) continue;

          // 1) Upload the raw logo file if user picked a new one.
          let logoUrl = state.logoUrl;
          if (state.logoFile) {
            const ext = state.logoFile.name.split(".").pop() || "png";
            const path = `${user.id}/${store.id}/logos/${p.id}-${Date.now()}.${ext}`;
            const { error: upErr } = await supabase.storage
              .from("corporate-store-assets")
              .upload(path, state.logoFile, { upsert: true, contentType: state.logoFile.type });
            if (upErr) throw upErr;
            logoUrl = supabase.storage.from("corporate-store-assets").getPublicUrl(path).data.publicUrl;
          }
          if (!logoUrl) continue;

          // 2) Save / upsert metadata.
          await supabase.from("corporate_store_product_logos").upsert(
            {
              user_id: user.id,
              store_id: store.id,
              product_id: p.id,
              view: state.view,
              logo_url: logoUrl,
              position: state.position,
            },
            { onConflict: "store_id,product_id,view" },
          );

          // 3) Bake composite using a CORS-friendly URL for the mockup.
          //    proxy-image returns a base64 data URL we can draw on canvas.
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
          const blob = await compositeLogo(mockupForCanvas, logoUrl, state.position);

          // 4) Upload composite and use its public URL as the override for this view.
          const compositePath = `${user.id}/${store.id}/composites/${p.id}-${state.view}-${Date.now()}.png`;
          const { error: cErr } = await supabase.storage
            .from("corporate-store-assets")
            .upload(compositePath, blob, { upsert: true, contentType: "image/png" });
          if (cErr) throw cErr;
          const compUrl = supabase.storage
            .from("corporate-store-assets")
            .getPublicUrl(compositePath).data.publicUrl;

          imageOverrides[p.id] = { ...(imageOverrides[p.id] ?? {}), [state.view]: compUrl };
        }
      }

      const { data, error } = await supabase.functions.invoke("sync-catalog-to-tenant", {
        body: {
          tenant_slug: tenantSlug,
          wp_site_url: store.wp_site_url ?? undefined,
          product_ids: productIds,
          image_overrides: imageOverrides,
        },
      });
      if (error) throw new Error(error.message);
      const res = (data ?? {}) as {
        ok?: boolean;
        status?: number;
        error?: string;
        detail?: string;
        response?: { message?: string; code?: string } | string;
        target?: string;
      };
      if (res.ok === false || res.error) {
        const upstream =
          typeof res.response === "string"
            ? res.response
            : res.response?.message || res.response?.code;
        throw new Error(
          [res.error, res.detail, upstream, res.status ? `HTTP ${res.status}` : null, res.target]
            .filter(Boolean)
            .join(" — ") || "Sync failed",
        );
      }
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
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Push products to {store.name}</DialogTitle>
          <DialogDescription>
            {isCorporate
              ? "Select products and optionally place this corporation's logo on each. The logo is baked into the mockup before pushing — your main catalog stays untouched."
              : "Select the products to publish on this store. Existing items with the same id are updated."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 flex-1 min-h-0 flex flex-col">
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

          <ScrollArea className="flex-1 min-h-[300px] rounded border">
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
                  const state = logos[p.id] ?? DEFAULT_LOGO;
                  const mockup = getMockup(p, state.view);
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
                            Corporate logo {state.logoUrl ? "✓" : "(optional)"}
                          </CollapsibleTrigger>
                          <CollapsibleContent className="mt-2 space-y-3 rounded border bg-card p-3">
                            <div className="grid grid-cols-[160px_1fr] gap-3">
                              {/* Live preview */}
                              <div className="relative aspect-square rounded border bg-muted overflow-hidden">
                                {mockup ? (
                                  <img src={mockup} alt="" className="absolute inset-0 h-full w-full object-contain" />
                                ) : (
                                  <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
                                    No mockup
                                  </div>
                                )}
                                {state.logoUrl && mockup && (
                                  <img
                                    src={state.logoUrl}
                                    alt="logo"
                                    className="absolute pointer-events-none"
                                    style={{
                                      left: `${state.position.x_pct * 100}%`,
                                      top: `${state.position.y_pct * 100}%`,
                                      width: `${state.position.width_pct * 100}%`,
                                      transform: `translate(-50%, -50%) rotate(${state.position.rotation_deg}deg)`,
                                    }}
                                  />
                                )}
                              </div>

                              <div className="space-y-2">
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
                                      <span><Upload className="h-3 w-3" /> {state.logoUrl ? "Replace logo" : "Upload logo"}</span>
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

                                {/* View selector */}
                                <div className="space-y-1">
                                  <Label className="text-xs">View</Label>
                                  <Select
                                    value={state.view}
                                    onValueChange={(v) => updateLogo(p.id, { view: v as ViewKey })}
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {(["front", "back", "side1", "side2"] as ViewKey[])
                                        .filter((v) => !!getMockup(p, v))
                                        .map((v) => (
                                          <SelectItem key={v} value={v}>
                                            {VIEW_LABEL[v]}
                                          </SelectItem>
                                        ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                {/* Position controls */}
                                <PositionSlider
                                  label="Horizontal"
                                  value={state.position.x_pct}
                                  onChange={(x) =>
                                    updateLogo(p.id, {
                                      position: { ...state.position, x_pct: x },
                                    })
                                  }
                                />
                                <PositionSlider
                                  label="Vertical"
                                  value={state.position.y_pct}
                                  onChange={(y) =>
                                    updateLogo(p.id, {
                                      position: { ...state.position, y_pct: y },
                                    })
                                  }
                                />
                                <PositionSlider
                                  label="Size"
                                  value={state.position.width_pct}
                                  min={0.05}
                                  max={0.8}
                                  onChange={(w) =>
                                    updateLogo(p.id, {
                                      position: { ...state.position, width_pct: w },
                                    })
                                  }
                                />
                              </div>
                            </div>
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
