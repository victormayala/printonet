import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Palette } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StoreThemePicker, useStoreTemplates } from "@/components/StoreThemePicker";
import { cms } from "@/lib/cmsClient";
import { toast } from "@/hooks/use-toast";
import { CorporateStore } from "@/types/corporateStore";

export function StoreThemeTab({ store }: { store: CorporateStore }) {
  const qc = useQueryClient();
  const { data } = useStoreTemplates(store.id);

  const { data: currentSettings } = useQuery({
    queryKey: ["cms-site-settings", store.id],
    queryFn: async () => {
      return await cms<{ settings: { published_data?: any; draft_data?: any } }>(
        store.id,
        "get-site-settings",
      );
    },
  });

  const currentTemplateId =
    currentSettings?.settings?.published_data?.template_id ??
    currentSettings?.settings?.draft_data?.template_id ??
    null;

  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Initialize selection from the actual current template, falling back to the
  // storefront default only if no template has ever been applied.
  useEffect(() => {
    if (selected) return;
    if (currentTemplateId) {
      setSelected(currentTemplateId);
    } else if (data?.default_template_id) {
      setSelected(data.default_template_id);
    }
  }, [currentTemplateId, data?.default_template_id, selected]);

  const apply = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await cms(store.id, "set-template", { template_id: selected });
      toast({ title: "Theme applied", description: `Storefront now uses "${selected}".` });
      await qc.invalidateQueries({ queryKey: ["cms-site-settings", store.id] });
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
          <Button onClick={apply} disabled={!selected || saving || selected === currentTemplateId}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Apply theme
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
