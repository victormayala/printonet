import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

type Store = {
  id: string;
  user_id: string;
  name: string;
  contact_email: string;
  tenant_slug: string | null;
  status: string;
  platform_fee_bps: number;
  store_type: string;
  stripe_charges_enabled: boolean;
  created_at: string;
};

export default function AdminStores() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-stores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("corporate_stores")
        .select("id,user_id,name,contact_email,tenant_slug,status,platform_fee_bps,store_type,stripe_charges_enabled,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Store[];
    },
  });

  const filtered = (data || []).filter((s) => {
    const v = q.toLowerCase().trim();
    if (!v) return true;
    return [s.name, s.contact_email, s.tenant_slug, s.id].some((x) => x?.toLowerCase().includes(v));
  });

  const updateStore = async (id: string, patch: Partial<Store>) => {
    setBusy(id);
    try {
      const { error } = await supabase.from("corporate_stores").update(patch).eq("id", id);
      if (error) throw error;
      toast.success("Updated");
      await qc.invalidateQueries({ queryKey: ["admin-stores"] });
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setBusy(null);
    }
  };

  const setFee = async (s: Store) => {
    const input = window.prompt(`Platform fee (basis points) for "${s.name}". 250 = 2.50%`, String(s.platform_fee_bps));
    if (input == null) return;
    const bps = parseInt(input, 10);
    if (!Number.isFinite(bps) || bps < 0 || bps > 10000) {
      toast.error("Enter 0–10000");
      return;
    }
    await updateStore(s.id, { platform_fee_bps: bps });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Stores</h1>
        <p className="text-sm text-muted-foreground">All corporate stores across every tenant.</p>
      </div>
      <Input placeholder="Search by name, email, slug…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Store</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Fee</TableHead>
              <TableHead>Stripe</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-10"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground text-sm">No stores.</TableCell></TableRow>
            ) : (
              filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.contact_email}</div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{s.tenant_slug || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={s.status === "active" ? "default" : "secondary"}>{s.status}</Badge>
                  </TableCell>
                  <TableCell>{(s.platform_fee_bps / 100).toFixed(2)}%</TableCell>
                  <TableCell>
                    {s.stripe_charges_enabled ? (
                      <Badge className="bg-emerald-600 text-white">connected</Badge>
                    ) : (
                      <Badge variant="secondary">none</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button size="sm" variant="outline" disabled={busy === s.id} onClick={() => setFee(s)}>Set fee</Button>
                    {s.status !== "paused" ? (
                      <Button size="sm" variant="outline" disabled={busy === s.id} onClick={() => updateStore(s.id, { status: "paused" })}>Pause</Button>
                    ) : (
                      <Button size="sm" variant="outline" disabled={busy === s.id} onClick={() => updateStore(s.id, { status: "active" })}>Activate</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
