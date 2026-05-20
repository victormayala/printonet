import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

type Order = {
  id: string;
  store_id: string | null;
  customer_email: string | null;
  amount_total: number | null;
  currency: string | null;
  status: string;
  environment: string;
  application_fee_amount: number | null;
  created_at: string;
};

const fmt = (cents: number | null, currency: string | null) =>
  cents == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: (currency || "usd").toUpperCase() }).format(cents / 100);

export default function AdminOrders() {
  const [q, setQ] = useState("");

  const { data: stores } = useQuery({
    queryKey: ["admin-stores-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("corporate_stores").select("id,name");
      if (error) throw error;
      return new Map((data || []).map((s) => [s.id, s.name]));
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id,store_id,customer_email,amount_total,currency,status,environment,application_fee_amount,created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as Order[];
    },
  });

  const filtered = (data || []).filter((o) => {
    const v = q.toLowerCase().trim();
    if (!v) return true;
    const storeName = (o.store_id && stores?.get(o.store_id)) || "";
    return [o.customer_email, o.id, storeName].some((x) => x?.toLowerCase().includes(v));
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
        <p className="text-sm text-muted-foreground">Latest 500 orders across all tenants.</p>
      </div>
      <Input placeholder="Search by email, store, or order id…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Store</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Platform fee</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Env</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-10"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground text-sm">No orders.</TableCell></TableRow>
            ) : (
              filtered.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="text-sm">{new Date(o.created_at).toLocaleString()}</TableCell>
                  <TableCell>{(o.store_id && stores?.get(o.store_id)) || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>{o.customer_email || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="font-medium">{fmt(o.amount_total, o.currency)}</TableCell>
                  <TableCell>{fmt(o.application_fee_amount, o.currency)}</TableCell>
                  <TableCell><Badge variant={o.status === "paid" ? "default" : "secondary"}>{o.status}</Badge></TableCell>
                  <TableCell><Badge variant="outline">{o.environment}</Badge></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
