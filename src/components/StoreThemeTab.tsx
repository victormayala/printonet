import { useEffect, useState } from "react";
import { Loader2, Palette } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StoreThemePicker, useStoreTemplates } from "@/components/StoreThemePicker";
import { cms } from "@/lib/cmsClient";
import { toast } from "@/hooks/use-toast";
import { CorporateStore } from "@/types/corporateStore";

export function StoreThemeTab({ store }: { store: CorporateStore }) {
  const { data } = useStoreTemplates(store.id);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Default to the storefront's default once templates load.
  useEffect(() => {
    if (!selected && data?.default_template_id) setSelected(data.default_template_id);
  }, [data?.default_template_id, selected]);

  const apply = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await cms(store.id, "set-template", { template_id: selected });
      toast({ title: "Theme applied", description: `Storefront now uses "${selected}".` });
    } catch (e) {
      toast({
        title: "Couldn't apply theme",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" /> Storefront theme
        </CardTitle>
        <CardDescription>
          Switch your storefront design. Changes publish immediately to{" "}
          <span className="font-medium text-foreground">{store.name}</span>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <StoreThemePicker
          storeId={store.id}
          selectedId={selected}
          onSelect={setSelected}
        />
        <div className="flex justify-end">
          <Button onClick={apply} disabled={!selected || saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Apply theme
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
