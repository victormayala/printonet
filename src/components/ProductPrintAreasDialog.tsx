import { useEffect, useState } from "react";
import { Loader2, Crop } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import PrintAreaEditor, { type PrintArea } from "@/components/PrintAreaEditor";
import PrintAreaOverlay from "@/components/PrintAreaOverlay";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type ViewKey = "front" | "back" | "side1" | "side2";
const ALL_VIEWS: ViewKey[] = ["front", "back", "side1", "side2"];
const VIEW_LABEL: Record<ViewKey, string> = {
  front: "Front",
  back: "Back",
  side1: "Left",
  side2: "Right",
};

export type PrintAreasProduct = {
  id: string;
  name: string;
  image_front: string | null;
  image_back: string | null;
  image_side1: string | null;
  image_side2: string | null;
};

function getMockup(p: PrintAreasProduct, v: ViewKey): string | null {
  if (v === "front") return p.image_front;
  if (v === "back") return p.image_back;
  if (v === "side1") return p.image_side1;
  return p.image_side2;
}

export function ProductPrintAreasDialog({
  product,
  open,
  onOpenChange,
  onSaved,
}: {
  product: PrintAreasProduct | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [areas, setAreas] = useState<Record<string, PrintArea>>({});

  useEffect(() => {
    if (!open || !product) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("inventory_products")
        .select("print_areas")
        .eq("id", product.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        toast({
          title: "Could not load print areas",
          description: error.message,
          variant: "destructive",
        });
      }
      setAreas(((data?.print_areas as unknown as Record<string, PrintArea>) ?? {}) || {});
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, product]);

  if (!product) return null;
  const availableViews = ALL_VIEWS.filter((v) => !!getMockup(product, v));

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("inventory_products")
        .update({ print_areas: areas as unknown as Record<string, unknown> })
        .eq("id", product.id);
      if (error) throw error;
      toast({ title: "Print areas saved", description: product.name });
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85dvh] p-0 gap-0 overflow-hidden flex flex-col">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle className="flex items-center gap-2">
            <Crop className="h-4 w-4" /> Print areas
          </DialogTitle>
          <DialogDescription>
            {product.name} · Define where customers can place designs on each view.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Loading…
            </div>
          ) : availableViews.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              This product has no mockup images to define print areas on.
            </p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {availableViews.map((v) => {
                const url = getMockup(product, v)!;
                const area = areas[v] || null;
                return (
                  <div key={v} className="space-y-2">
                    <Label className="text-xs font-semibold">{VIEW_LABEL[v]}</Label>
                    <div className="relative aspect-square rounded-lg overflow-hidden border bg-muted">
                      <img src={url} alt={VIEW_LABEL[v]} className="w-full h-full object-contain" />
                      {area && <PrintAreaOverlay imageUrl={url} printArea={area} />}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <PrintAreaEditor
                        imageUrl={url}
                        sideLabel={VIEW_LABEL[v]}
                        value={area}
                        onChange={(next) => {
                          setAreas((prev) => {
                            const copy = { ...prev };
                            if (next) copy[v] = next;
                            else delete copy[v];
                            return copy;
                          });
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save print areas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
