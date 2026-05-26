import { useEffect, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { CorporateStore } from "@/types/corporateStore";

type ViewKey = "front" | "back" | "side1" | "side2";
const ALL_VIEWS: ViewKey[] = ["front", "back", "side1", "side2"];
const VIEW_LABEL: Record<ViewKey, string> = {
  front: "Front",
  back: "Back",
  side1: "Left",
  side2: "Right",
};

type Position = { x_pct: number; y_pct: number; width_pct: number; rotation_deg: number };
type ViewState = { enabled: boolean; position: Position };

const DEFAULT_POS: Position = { x_pct: 0.5, y_pct: 0.5, width_pct: 0.25, rotation_deg: 0 };

export type EditableProduct = {
  id: string;
  name: string;
  image_front: string | null;
  image_back: string | null;
  image_side1: string | null;
  image_side2: string | null;
};

function getMockup(p: EditableProduct, v: ViewKey): string | null {
  if (v === "front") return p.image_front;
  if (v === "back") return p.image_back;
  if (v === "side1") return p.image_side1;
  return p.image_side2;
}

function defaultViews(): Record<ViewKey, ViewState> {
  return {
    front: { enabled: false, position: { ...DEFAULT_POS } },
    back: { enabled: false, position: { ...DEFAULT_POS } },
    side1: { enabled: false, position: { ...DEFAULT_POS } },
    side2: { enabled: false, position: { ...DEFAULT_POS } },
  };
}

export function EditProductLogoDialog({
  store,
  product,
  open,
  onOpenChange,
  onSaved,
}: {
  store: CorporateStore;
  product: EditableProduct | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
}) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [views, setViews] = useState<Record<ViewKey, ViewState>>(defaultViews());

  useEffect(() => {
    if (!open || !product || !user?.id) return;
    let cancelled = false;
    setLoading(true);
    setLogoFile(null);
    (async () => {
      const { data } = await supabase
        .from("corporate_store_product_logos")
        .select("view,logo_url,position")
        .eq("store_id", store.id)
        .eq("product_id", product.id);
      if (cancelled) return;
      const next = defaultViews();
      let url: string | null = null;
      for (const row of data ?? []) {
        const v = row.view as ViewKey;
        next[v] = { enabled: true, position: row.position as Position };
        url = row.logo_url;
      }
      setViews(next);
      setLogoUrl(url);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, product, store.id, user?.id]);

  if (!product) return null;

  const availableViews = ALL_VIEWS.filter((v) => !!getMockup(product, v));
  const enabledCount = ALL_VIEWS.filter((v) => views[v].enabled).length;

  const updateView = (v: ViewKey, patch: Partial<ViewState>) => {
    setViews((prev) => ({ ...prev, [v]: { ...prev[v], ...patch } }));
  };

  const onPick = (file: File | null) => {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast({ title: "Logo too large (max 4 MB)", variant: "destructive" });
      return;
    }
    setLogoFile(file);
    setLogoUrl(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      let finalUrl = logoUrl;
      if (logoFile) {
        const ext = logoFile.name.split(".").pop() || "png";
        const path = `${user.id}/${store.id}/logos/${product.id}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("corporate-store-assets")
          .upload(path, logoFile, { upsert: true, contentType: logoFile.type });
        if (upErr) throw upErr;
        finalUrl = supabase.storage.from("corporate-store-assets").getPublicUrl(path).data.publicUrl;
      }

      const enabled = ALL_VIEWS.filter((v) => views[v].enabled && !!getMockup(product, v));
      const disabled = ALL_VIEWS.filter((v) => !enabled.includes(v));

      if (disabled.length > 0) {
        await supabase
          .from("corporate_store_product_logos")
          .delete()
          .eq("store_id", store.id)
          .eq("product_id", product.id)
          .in("view", disabled);
      }

      if (enabled.length > 0) {
        if (!finalUrl) throw new Error("Upload a logo first");
        const rows = enabled.map((v) => ({
          user_id: user.id,
          store_id: store.id,
          product_id: product.id,
          view: v,
          logo_url: finalUrl!,
          position: views[v].position,
        }));
        const { error } = await supabase
          .from("corporate_store_product_logos")
          .upsert(rows, { onConflict: "store_id,product_id,view" });
        if (error) throw error;
      }

      toast({ title: "Logo updated", description: product.name });
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast({
        title: "Could not save",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAll = async () => {
    if (!confirm(`Remove the corporate logo from all views of "${product.name}"?`)) return;
    setSaving(true);
    try {
      await supabase
        .from("corporate_store_product_logos")
        .delete()
        .eq("store_id", store.id)
        .eq("product_id", product.id);
      toast({ title: "Logo removed", description: product.name });
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast({
        title: "Could not remove",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85dvh] p-0 gap-0 overflow-hidden">
        <DialogHeader className="border-b px-6 py-5 pr-16">
          <DialogTitle>Edit logo placement</DialogTitle>
          <DialogDescription>
            {product.name} · {enabledCount} of {availableViews.length} view{availableViews.length === 1 ? "" : "s"} active
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {loading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Loading…
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <label className="inline-flex">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    className="hidden"
                    onChange={(e) => onPick(e.target.files?.[0] ?? null)}
                  />
                  <Button asChild type="button" size="sm" variant="outline">
                    <span>
                      <Upload className="h-3 w-3 mr-1" />
                      {logoUrl ? "Replace logo" : "Upload logo"}
                    </span>
                  </Button>
                </label>
                {logoUrl && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setLogoUrl(null);
                      setLogoFile(null);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>

              {logoUrl && availableViews.length > 0 && (
                <>
                  <p className="text-xs text-muted-foreground">
                    Click a view to toggle the logo on that mockup.
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {availableViews.map((v) => {
                      const vs = views[v];
                      const mockup = getMockup(product, v)!;
                      return (
                        <button
                          key={v}
                          type="button"
                          onClick={() => updateView(v, { enabled: !vs.enabled })}
                          className={`group relative aspect-square rounded border-2 overflow-hidden bg-muted transition-all ${
                            vs.enabled
                              ? "border-primary ring-2 ring-primary/30"
                              : "border-border hover:border-muted-foreground"
                          }`}
                        >
                          <img src={mockup} alt={VIEW_LABEL[v]} className="absolute inset-0 h-full w-full object-contain" />
                          {vs.enabled && (
                            <img
                              src={logoUrl}
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
                            <Checkbox checked={vs.enabled} className="bg-background/90 pointer-events-none" />
                          </div>
                          <div className="absolute bottom-0 inset-x-0 bg-background/80 text-[10px] py-0.5 text-center font-medium">
                            {VIEW_LABEL[v]}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {availableViews.filter((v) => views[v].enabled).length > 0 && (
                    <div className="space-y-3 border-t pt-3">
                      {availableViews
                        .filter((v) => views[v].enabled)
                        .map((v) => {
                          const vs = views[v];
                          return (
                            <div key={v} className="space-y-2">
                              <Label className="text-xs font-semibold">{VIEW_LABEL[v]} placement</Label>
                              <div className="grid grid-cols-3 gap-2">
                                <PositionSlider
                                  label="X"
                                  value={vs.position.x_pct}
                                  onChange={(x) => updateView(v, { position: { ...vs.position, x_pct: x } })}
                                />
                                <PositionSlider
                                  label="Y"
                                  value={vs.position.y_pct}
                                  onChange={(y) => updateView(v, { position: { ...vs.position, y_pct: y } })}
                                />
                                <PositionSlider
                                  label="Size"
                                  value={vs.position.width_pct}
                                  min={0.05}
                                  max={0.8}
                                  onChange={(w) => updateView(v, { position: { ...vs.position, width_pct: w } })}
                                />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        <DialogFooter className="border-t px-6 py-4 sm:justify-between">
          <Button
            variant="ghost"
            onClick={handleRemoveAll}
            disabled={saving || loading || !logoUrl}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            Remove logo
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || loading}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save changes
            </Button>
          </div>
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
        <span className="text-xs text-muted-foreground tabular-nums">{Math.round(value * 100)}%</span>
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
