import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus, Save, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { CorporateStore } from "@/types/corporateStore";

type Location = "header" | "footer";
type Item = { label: string; href: string; new_tab?: boolean };

function NavSection({ site, location }: { site: CorporateStore; location: Location }) {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [rowId, setRowId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["site-navigation", site.id, location],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("site_navigation")
        .select("*")
        .eq("store_id", site.id)
        .eq("location", location)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; items: Item[] } | null;
    },
  });

  useEffect(() => {
    setItems((data?.items as Item[]) ?? []);
    setRowId(data?.id ?? null);
  }, [data?.id]);

  const update = (idx: number, patch: Partial<Item>) =>
    setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[idx], next[j]] = [next[j], next[idx]];
    setItems(next);
  };

  const save = async () => {
    if (!user?.id) return;
    setSaving(true);
    if (rowId) {
      const { error } = await (supabase as any)
        .from("site_navigation")
        .update({ items })
        .eq("id", rowId);
      if (error) {
        toast({ title: "Save failed", description: error.message, variant: "destructive" });
        setSaving(false);
        return;
      }
    } else {
      const { error } = await (supabase as any)
        .from("site_navigation")
        .insert({ store_id: site.id, user_id: user.id, location, items });
      if (error) {
        toast({ title: "Save failed", description: error.message, variant: "destructive" });
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    toast({ title: `${location === "header" ? "Header" : "Footer"} menu saved` });
    refetch();
  };

  if (isLoading) {
    return (
      <div className="py-8 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base capitalize">{location} menu</CardTitle>
        <CardDescription>
          Links shown in the {location} of every page.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground">No links yet.</p>
        )}
        {items.map((it, idx) => (
          <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Label</Label>
              <Input value={it.label} onChange={(e) => update(idx, { label: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">URL</Label>
              <Input value={it.href} onChange={(e) => update(idx, { href: e.target.value })} placeholder="/about" />
            </div>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" onClick={() => move(idx, -1)} disabled={idx === 0}>
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => move(idx, 1)} disabled={idx === items.length - 1}>
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setItems((arr) => arr.filter((_, i) => i !== idx))}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
        <div className="flex justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setItems((arr) => [...arr, { label: "", href: "" }])}
          >
            <Plus className="h-4 w-4" /> Add link
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save {location}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function WebsiteNavigationEditor({ site }: { site: CorporateStore }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Navigation</h2>
        <p className="text-sm text-muted-foreground">
          Configure the header and footer menus for your website.
        </p>
      </div>
      <NavSection site={site} location="header" />
      <NavSection site={site} location="footer" />
    </div>
  );
}
