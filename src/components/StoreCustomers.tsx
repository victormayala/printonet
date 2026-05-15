import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, Mail, MapPin, Package, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";

type CustomerProfile = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  created_at: string;
  disabled_at: string | null;
};

type CustomerRow = CustomerProfile & {
  order_count: number;
  total_spent: number;
};

type OrderRow = {
  id: string;
  created_at: string;
  status: string;
  amount_total: number | null;
  currency: string | null;
};

type AddressRow = {
  id: string;
  label: string | null;
  full_name: string | null;
  line1: string;
  line2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country: string | null;
  phone: string | null;
  is_default_shipping: boolean;
  is_default_billing: boolean;
};

function formatMoney(amount: number | null | undefined, currency = "usd") {
  const n = (amount ?? 0) / 100;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: (currency || "usd").toUpperCase(),
    }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

export function StoreCustomers({ storeId }: { storeId: string }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<CustomerProfile | null>(null);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["store-customers", storeId],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("customer_profiles")
        .select("id, email, full_name, phone, created_at, disabled_at")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const emails = (profiles ?? []).map((p) => p.email).filter(Boolean);
      let orderAgg: Record<string, { count: number; total: number }> = {};
      if (emails.length) {
        const { data: orders } = await supabase
          .from("orders")
          .select("customer_email, amount_total, status")
          .eq("store_id", storeId)
          .in("customer_email", emails);
        for (const o of orders ?? []) {
          const key = (o.customer_email ?? "").toLowerCase();
          if (!key) continue;
          if (!orderAgg[key]) orderAgg[key] = { count: 0, total: 0 };
          orderAgg[key].count += 1;
          if (o.status !== "refunded") orderAgg[key].total += o.amount_total ?? 0;
        }
      }

      return (profiles ?? []).map<CustomerRow>((p) => {
        const agg = orderAgg[p.email.toLowerCase()] ?? { count: 0, total: 0 };
        return { ...p, order_count: agg.count, total_spent: agg.total };
      });
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.email.toLowerCase().includes(q) ||
        (c.full_name ?? "").toLowerCase().includes(q) ||
        (c.phone ?? "").toLowerCase().includes(q),
    );
  }, [customers, search]);

  const exportCsv = () => {
    const rows = [
      ["Email", "Name", "Phone", "Orders", "Total spent (USD)", "Joined", "Status"],
      ...filtered.map((c) => [
        c.email,
        c.full_name ?? "",
        c.phone ?? "",
        String(c.order_count),
        (c.total_spent / 100).toFixed(2),
        new Date(c.created_at).toISOString(),
        c.disabled_at ? "disabled" : "active",
      ]),
    ];
    const csv = rows
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `customers-${storeId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle>Customers</CardTitle>
          <CardDescription>
            Shoppers who created an account on this store.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search email, name, phone…"
            className="pl-8"
          />
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Loading customers…
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">
            No customers yet.
          </div>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Spent</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer"
                    onClick={() => setSelected(c)}
                  >
                    <TableCell>
                      <div className="font-medium">{c.full_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{c.email}</div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{c.order_count}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(c.total_spent)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {c.disabled_at ? (
                        <Badge variant="outline">Disabled</Badge>
                      ) : (
                        <Badge variant="secondary">Active</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <CustomerDetailSheet
        storeId={storeId}
        customer={selected}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </Card>
  );
}

function CustomerDetailSheet({
  storeId,
  customer,
  onOpenChange,
}: {
  storeId: string;
  customer: CustomerProfile | null;
  onOpenChange: (open: boolean) => void;
}) {
  const open = !!customer;

  const { data: addresses = [] } = useQuery({
    queryKey: ["customer-addresses", customer?.id],
    enabled: !!customer,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_addresses")
        .select(
          "id, label, full_name, line1, line2, city, region, postal_code, country, phone, is_default_shipping, is_default_billing",
        )
        .eq("customer_id", customer!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AddressRow[];
    },
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["customer-orders", storeId, customer?.email],
    enabled: !!customer,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, created_at, status, amount_total, currency")
        .eq("store_id", storeId)
        .eq("customer_email", customer!.email)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as OrderRow[];
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        {customer && (
          <>
            <SheetHeader>
              <SheetTitle>{customer.full_name || customer.email}</SheetTitle>
              <SheetDescription className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5" /> {customer.email}
                {customer.phone && <span>· {customer.phone}</span>}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              <section>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Addresses ({addresses.length})
                </h3>
                {addresses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No saved addresses.</p>
                ) : (
                  <div className="space-y-3">
                    {addresses.map((a) => (
                      <div key={a.id} className="rounded-md border p-3 text-sm space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{a.label || a.full_name || "Address"}</span>
                          {a.is_default_shipping && (
                            <Badge variant="secondary" className="text-xs">Default ship</Badge>
                          )}
                          {a.is_default_billing && (
                            <Badge variant="secondary" className="text-xs">Default bill</Badge>
                          )}
                        </div>
                        <div className="text-muted-foreground">
                          {a.line1}
                          {a.line2 ? `, ${a.line2}` : ""}
                          <br />
                          {[a.city, a.region, a.postal_code].filter(Boolean).join(", ")}
                          {a.country ? ` · ${a.country}` : ""}
                          {a.phone && (
                            <>
                              <br />
                              {a.phone}
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <Separator />

              <section>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Package className="h-4 w-4" /> Orders ({orders.length})
                </h3>
                {orders.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No orders yet.</p>
                ) : (
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders.map((o) => (
                          <TableRow key={o.id}>
                            <TableCell className="text-sm">
                              {new Date(o.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">
                                {o.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatMoney(o.amount_total, o.currency ?? "usd")}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
