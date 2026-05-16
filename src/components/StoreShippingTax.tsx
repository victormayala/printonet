import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import type { CorporateStore } from "@/types/corporateStore";

type ShippingZone = {
  id: string; // local uuid for new rows, db uuid for existing
  db_id: string | null;
  name: string;
  countries: string; // comma-separated in the form
  rate_amount: string; // dollars in the form
  free_threshold: string; // dollars or ''
  sort_order: number;
};

const dollarsToCents = (v: string) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
};
const centsToDollars = (n: number | null | undefined) =>
  n == null ? "" : (n / 100).toFixed(2);

export function StoreShippingTax({ store }: { store: CorporateStore }) {
  const qc = useQueryClient();

  // Tax + flat shipping settings — read fresh from DB so we have the new columns.
  const settingsQ = useQuery({
    queryKey: ["store-shipping-tax", store.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("corporate_stores")
        .select(
          "id, tax_enabled, tax_rate_bps, tax_inclusive, tax_label, shipping_label, shipping_flat_amount, free_shipping_threshold",
        )
        .eq("id", store.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const zonesQ = useQuery({
    queryKey: ["store-shipping-zones", store.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("corporate_store_shipping_zones")
        .select("id, name, countries, rate_amount, free_threshold, sort_order")
        .eq("store_id", store.id)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxRatePct, setTaxRatePct] = useState("0");
  const [taxInclusive, setTaxInclusive] = useState(false);
  const [taxLabel, setTaxLabel] = useState("Tax");
  const [shippingLabel, setShippingLabel] = useState("Standard shipping");
  const [shippingFlat, setShippingFlat] = useState("0.00");
  const [freeThreshold, setFreeThreshold] = useState("");
  const [zones, setZones] = useState<ShippingZone[]>([]);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingZones, setSavingZones] = useState(false);

  useEffect(() => {
    const s = settingsQ.data as any;
    if (!s) return;
    setTaxEnabled(!!s.tax_enabled);
    setTaxRatePct(((s.tax_rate_bps ?? 0) / 100).toString());
    setTaxInclusive(!!s.tax_inclusive);
    setTaxLabel(s.tax_label ?? "Tax");
    setShippingLabel(s.shipping_label ?? "Standard shipping");
    setShippingFlat(centsToDollars(s.shipping_flat_amount));
    setFreeThreshold(centsToDollars(s.free_shipping_threshold));
  }, [settingsQ.data]);

  useEffect(() => {
    if (!zonesQ.data) return;
    setZones(
      zonesQ.data.map((z: any) => ({
        id: z.id,
        db_id: z.id,
        name: z.name,
        countries: (z.countries ?? []).join(", "),
        rate_amount: centsToDollars(z.rate_amount),
        free_threshold: centsToDollars(z.free_threshold),
        sort_order: z.sort_order ?? 0,
      })),
    );
  }, [zonesQ.data]);

  const saveSettings = async () => {
    const ratePctNum = Number(taxRatePct);
    if (!Number.isFinite(ratePctNum) || ratePctNum < 0 || ratePctNum > 100) {
      toast({ title: "Tax rate must be 0–100%", variant: "destructive" });
      return;
    }
    const flatCents = dollarsToCents(shippingFlat);
    if (flatCents === null) {
      toast({ title: "Invalid flat shipping amount", variant: "destructive" });
      return;
    }
    const freeCents = freeThreshold.trim() === "" ? null : dollarsToCents(freeThreshold);
    if (freeCents === null && freeThreshold.trim() !== "") {
      toast({ title: "Invalid free shipping threshold", variant: "destructive" });
      return;
    }

    setSavingSettings(true);
    try {
      const { error } = await supabase
        .from("corporate_stores")
        .update({
          tax_enabled: taxEnabled,
          tax_rate_bps: Math.round(ratePctNum * 100),
          tax_inclusive: taxInclusive,
          tax_label: taxLabel.trim() || "Tax",
          shipping_label: shippingLabel.trim() || "Standard shipping",
          shipping_flat_amount: flatCents,
          free_shipping_threshold: freeCents,
        })
        .eq("id", store.id);
      if (error) throw error;
      toast({ title: "Settings saved" });
      qc.invalidateQueries({ queryKey: ["store-shipping-tax", store.id] });
    } catch (e) {
      toast({
        title: "Could not save settings",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const addZone = () => {
    setZones((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        db_id: null,
        name: "",
        countries: "",
        rate_amount: "0.00",
        free_threshold: "",
        sort_order: prev.length,
      },
    ]);
  };

  const updateZone = (id: string, patch: Partial<ShippingZone>) => {
    setZones((prev) => prev.map((z) => (z.id === id ? { ...z, ...patch } : z)));
  };

  const removeZone = (id: string) => {
    setZones((prev) => prev.filter((z) => z.id !== id));
  };

  const saveZones = async () => {
    // Validate & build rows
    const rows: {
      db_id: string | null;
      name: string;
      countries: string[];
      rate_amount: number;
      free_threshold: number | null;
      sort_order: number;
    }[] = [];

    for (const z of zones) {
      if (!z.name.trim()) {
        toast({ title: "Every zone needs a name", variant: "destructive" });
        return;
      }
      const rate = dollarsToCents(z.rate_amount);
      if (rate === null) {
        toast({ title: `Invalid rate in zone "${z.name}"`, variant: "destructive" });
        return;
      }
      let free: number | null = null;
      if (z.free_threshold.trim() !== "") {
        const f = dollarsToCents(z.free_threshold);
        if (f === null) {
          toast({
            title: `Invalid free threshold in zone "${z.name}"`,
            variant: "destructive",
          });
          return;
        }
        free = f;
      }
      const countries = z.countries
        .split(",")
        .map((c) => c.trim().toUpperCase())
        .filter((c) => c.length === 2);
      rows.push({
        db_id: z.db_id,
        name: z.name.trim(),
        countries,
        rate_amount: rate,
        free_threshold: free,
        sort_order: z.sort_order,
      });
    }

    setSavingZones(true);
    try {
      const keepIds = rows.filter((r) => r.db_id).map((r) => r.db_id as string);
      // 1. Delete removed zones
      let del = supabase
        .from("corporate_store_shipping_zones")
        .delete()
        .eq("store_id", store.id);
      if (keepIds.length > 0) del = del.not("id", "in", `(${keepIds.join(",")})`);
      const { error: delErr } = await del;
      if (delErr) throw delErr;

      // 2. Update existing
      for (const r of rows.filter((x) => x.db_id)) {
        const { error } = await supabase
          .from("corporate_store_shipping_zones")
          .update({
            name: r.name,
            countries: r.countries,
            rate_amount: r.rate_amount,
            free_threshold: r.free_threshold,
            sort_order: r.sort_order,
          })
          .eq("id", r.db_id as string)
          .eq("store_id", store.id);
        if (error) throw error;
      }

      // 3. Insert new
      const inserts = rows
        .filter((x) => !x.db_id)
        .map((r) => ({
          store_id: store.id,
          name: r.name,
          countries: r.countries,
          rate_amount: r.rate_amount,
          free_threshold: r.free_threshold,
          sort_order: r.sort_order,
        }));
      if (inserts.length > 0) {
        const { error } = await supabase
          .from("corporate_store_shipping_zones")
          .insert(inserts);
        if (error) throw error;
      }

      toast({ title: "Shipping zones saved" });
      qc.invalidateQueries({ queryKey: ["store-shipping-zones", store.id] });
    } catch (e) {
      toast({
        title: "Could not save zones",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSavingZones(false);
    }
  };

  const loading = settingsQ.isLoading || zonesQ.isLoading;
  const taxAuto = taxEnabled;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tax */}
      <Card>
        <CardHeader>
          <CardTitle>Tax</CardTitle>
          <CardDescription>
            Choose Stripe automatic tax or set a single manual rate. Manual tax is applied to the
            order total at checkout.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Use Stripe automatic tax</p>
              <p className="text-xs text-muted-foreground">
                When on, manual tax fields below are ignored.
              </p>
            </div>
            <Switch checked={taxEnabled} onCheckedChange={setTaxEnabled} />
          </div>

          <div className={`grid gap-4 sm:grid-cols-2 ${taxAuto ? "opacity-50 pointer-events-none" : ""}`}>
            <div className="space-y-1.5">
              <Label htmlFor="tax-label">Tax label</Label>
              <Input
                id="tax-label"
                value={taxLabel}
                onChange={(e) => setTaxLabel(e.target.value)}
                placeholder="VAT, GST, Sales tax…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tax-rate">Rate (%)</Label>
              <Input
                id="tax-rate"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={taxRatePct}
                onChange={(e) => setTaxRatePct(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2 flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Prices include tax (inclusive)</p>
                <p className="text-xs text-muted-foreground">
                  When on, tax is back-computed from the listed price instead of added on top.
                </p>
              </div>
              <Switch checked={taxInclusive} onCheckedChange={setTaxInclusive} />
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="text-sm font-medium mb-3">Default shipping (fallback)</h4>
            <p className="text-xs text-muted-foreground mb-3">
              Used when no shipping zone matches the buyer's country.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="ship-label">Label</Label>
                <Input
                  id="ship-label"
                  value={shippingLabel}
                  onChange={(e) => setShippingLabel(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ship-flat">Flat rate ($)</Label>
                <Input
                  id="ship-flat"
                  type="number"
                  min="0"
                  step="0.01"
                  value={shippingFlat}
                  onChange={(e) => setShippingFlat(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ship-free">Free over ($, optional)</Label>
                <Input
                  id="ship-free"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Leave blank to disable"
                  value={freeThreshold}
                  onChange={(e) => setFreeThreshold(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={saveSettings} disabled={savingSettings}>
              {savingSettings ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Shipping zones */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
          <div>
            <CardTitle>Shipping zones</CardTitle>
            <CardDescription>
              Per-country rates. The lowest <code>sort_order</code> matching the buyer wins;
              otherwise the default shipping above is used.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={addZone}>
            <Plus className="h-4 w-4" /> Add zone
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {zones.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No zones yet — checkout will use the default shipping above.
            </p>
          )}

          {zones.map((z) => (
            <div key={z.id} className="rounded-md border p-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-12">
                <div className="sm:col-span-3 space-y-1.5">
                  <Label className="text-xs">Name</Label>
                  <Input
                    value={z.name}
                    onChange={(e) => updateZone(z.id, { name: e.target.value })}
                    placeholder="EU"
                  />
                </div>
                <div className="sm:col-span-5 space-y-1.5">
                  <Label className="text-xs">Countries (ISO-2, comma separated)</Label>
                  <Input
                    value={z.countries}
                    onChange={(e) => updateZone(z.id, { countries: e.target.value })}
                    placeholder="DE, FR, NL"
                  />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs">Rate ($)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={z.rate_amount}
                    onChange={(e) => updateZone(z.id, { rate_amount: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs">Free over ($)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Optional"
                    value={z.free_threshold}
                    onChange={(e) => updateZone(z.id, { free_threshold: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Sort order</Label>
                  <Input
                    type="number"
                    className="h-8 w-20"
                    value={z.sort_order}
                    onChange={(e) =>
                      updateZone(z.id, { sort_order: Number(e.target.value) || 0 })
                    }
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => removeZone(z.id)}
                >
                  <Trash2 className="h-4 w-4" /> Remove
                </Button>
              </div>
            </div>
          ))}

          <div className="flex justify-end">
            <Button onClick={saveZones} disabled={savingZones}>
              {savingZones ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save zones
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
