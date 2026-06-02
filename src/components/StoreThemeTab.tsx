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
  const hasHostedStorefront = !!store.tenant_slug;
  const { data } = useStoreTemplates(hasHostedStorefront ? store.id : null, hasHostedStorefront);

  const { data: currentSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ["cms-site-settings", store.id],
    enabled: hasHostedStorefront,
    queryFn: async () => {
      return await cms<{ settings: { published_data?: any; draft_data?: any } }>(
        store.id,
        "get-site-settings",
      );
    },
    staleTime: 0,
    refetchOnMount: "always",
  });

  const currentTemplateId =
    currentSettings?.settings?.published_data?.template_id ??
    currentSettings?.settings?.draft_data?.template_id ??
    null;

  const [selected, setSelected] = useState<string | null>(null);
  const [selectionTouched, setSelectionTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sync the picker from the actual current template. Do not fall back to the
  // default until the current settings query has resolved, otherwise the first
  // template briefly wins the race and can stay selected.
  useEffect(() => {
    if (selectionTouched) {
      if (currentTemplateId && selected === currentTemplateId) setSelectionTouched(false);
      return;
    }
    if (currentTemplateId) {
      if (selected !== currentTemplateId) setSelected(currentTemplateId);
    } else if (!settingsLoading && data?.default_template_id && selected !== data.default_template_id) {
      setSelected(data.default_template_id);
    }
  }, [currentTemplateId, data?.default_template_id, selected, selectionTouched, settingsLoading]);

  const selectTheme = (templateId: string) => {
    setSelectionTouched(true);
    setSelected(templateId);
  };

  const apply = async () => {
    if (!selected || !hasHostedStorefront) return;
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

  if (!hasHostedStorefront) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" /> Storefront theme
          </CardTitle>
          <CardDescription>
            Shopify stores use the live Shopify theme. Printonet storefront themes only apply to hosted stores.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

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
          onSelect={selectTheme}
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
