import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  Search, Download, Eye, Package, Calendar,
  Filter, ExternalLink, Palette, Copy, Printer, CreditCard, Mail,
} from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import type { Database } from "@/integrations/supabase/types";

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type OrderItemRow = Database["public"]["Tables"]["order_items"]["Row"];
type SessionRow = Database["public"]["Tables"]["customizer_sessions"]["Row"];
type StoreRow = { id: string; name: string | null; tenant_slug: string | null };

type EnrichedOrder = OrderRow & {
  items: OrderItemRow[];
  store?: StoreRow;
};

type SideAsset = {
  view: string;
  previewPNG?: string;
  designPNG?: string;
  productImage?: string;
};

function getSideAssetsFromSession(session: SessionRow): SideAsset[] {
  if (!session.design_output || typeof session.design_output !== "object") return [];
  const output = session.design_output as Record<string, unknown>;
  const sides = Array.isArray(output.sides) ? (output.sides as Record<string, unknown>[]) : [];
  return sides
    .map((s) => ({
      view: String(s.view || ""),
      previewPNG: typeof s.previewPNG === "string" && s.previewPNG.startsWith("http") ? s.previewPNG : undefined,
      designPNG: typeof s.designPNG === "string" && s.designPNG.startsWith("http") ? s.designPNG : undefined,
      productImage: typeof s.productImage === "string" && s.productImage.startsWith("http") ? s.productImage : undefined,
    }))
    .filter((s) => s.previewPNG || s.designPNG);
}

function getDesignImagesFromSession(session: SessionRow): string[] {
  const sides = getSideAssetsFromSession(session);
  if (sides.length > 0) {
    return sides.map((s) => s.previewPNG || s.designPNG!).filter(Boolean);
  }
  if (!session.design_output || typeof session.design_output !== "object") return [];
  const output = session.design_output as Record<string, unknown>;
  const images: string[] = [];
  for (const key of Object.keys(output)) {
    const v = output[key];
    if (
      typeof v === "string" &&
      v.startsWith("http") &&
      /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(v)
    ) {
      images.push(v);
    }
  }
  return images;
}

function formatMoney(cents: number | null | undefined, currency: string | null | undefined) {
  if (cents == null) return "—";
  const cur = (currency || "USD").toUpperCase();
  return `${(cents / 100).toFixed(2)} ${cur}`;
}

export default function Orders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<EnrichedOrder[]>([]);
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [sessionById, setSessionById] = useState<Record<string, SessionRow>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<EnrichedOrder | null>(null);

  useEffect(() => {
    if (!user) return;
    void fetchOrders();
  }, [user]);

  async function fetchOrders() {
    setLoading(true);

    const { data: storesData, error: storesErr } = await supabase
      .from("corporate_stores")
      .select("id, name, tenant_slug")
      .eq("user_id", user!.id);

    if (storesErr) {
      toast({
        title: "Error loading stores",
        description: storesErr.message,
        variant: "destructive",
      });
      setOrders([]);
      setStores([]);
      setSessionById({});
      setLoading(false);
      return;
    }

    const storeRows = (storesData || []) as StoreRow[];
    setStores(storeRows);

    if (storeRows.length === 0) {
      setOrders([]);
      setSessionById({});
      setLoading(false);
      return;
    }

    const storeIds = storeRows.map((s) => s.id);

    const { data: orderRows, error: ordersErr } = await supabase
      .from("orders")
      .select("*")
      .in("store_id", storeIds)
      .order("created_at", { ascending: false });

    if (ordersErr) {
      toast({
        title: "Error loading orders",
        description: ordersErr.message,
        variant: "destructive",
      });
      setOrders([]);
      setSessionById({});
      setLoading(false);
      return;
    }

    const orderIds = (orderRows || []).map((o) => o.id);
    let itemsByOrder: Record<string, OrderItemRow[]> = {};
    if (orderIds.length > 0) {
      const { data: itemRows, error: itemsErr } = await supabase
        .from("order_items")
        .select("*")
        .in("order_id", orderIds);
      if (itemsErr) {
        toast({
          title: "Error loading line items",
          description: itemsErr.message,
          variant: "destructive",
        });
      }
      for (const it of (itemRows || []) as OrderItemRow[]) {
        (itemsByOrder[it.order_id] ||= []).push(it);
      }
    }

    const storeMap = new Map(storeRows.map((s) => [s.id, s]));
    const enriched: EnrichedOrder[] = (orderRows || []).map((o) => ({
      ...(o as OrderRow),
      items: itemsByOrder[o.id] || [],
      store: o.store_id ? storeMap.get(o.store_id) : undefined,
    }));
    setOrders(enriched);

    const sessionIds = Array.from(
      new Set(
        enriched.flatMap((o) => {
          const ids: string[] = [];
          if (typeof o.session_id === "string" && o.session_id) ids.push(o.session_id);
          for (const it of o.items) {
            const meta = (it as { metadata?: Record<string, unknown> | null }).metadata;
            const sid = meta && typeof meta === "object" ? (meta as Record<string, unknown>).customizer_session_id : null;
            if (typeof sid === "string" && sid) ids.push(sid);
          }
          return ids;
        }),
      ),
    );

    if (sessionIds.length > 0) {
      const { data: sessRows, error: sessErr } = await supabase
        .from("customizer_sessions")
        .select("*")
        .in("id", sessionIds);
      if (sessErr) {
        toast({
          title: "Could not load customizer sessions",
          description: sessErr.message,
          variant: "destructive",
        });
        setSessionById({});
      } else {
        const map: Record<string, SessionRow> = {};
        for (const s of (sessRows || []) as SessionRow[]) map[s.id] = s;
        setSessionById(map);
      }
    } else {
      setSessionById({});
    }

    setLoading(false);
  }

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        o.id.toLowerCase().includes(q) ||
        (o.customer_email || "").toLowerCase().includes(q) ||
        (o.store?.name || "").toLowerCase().includes(q) ||
        (o.store?.tenant_slug || "").toLowerCase().includes(q) ||
        (o.stripe_payment_intent || "").toLowerCase().includes(q) ||
        o.items.some(
          (i) =>
            (i.name || "").toLowerCase().includes(q) ||
            (i.sku || "").toLowerCase().includes(q),
        );
      const matchesStatus =
        statusFilter === "all" || (o.status || "").toLowerCase() === statusFilter.toLowerCase();
      return matchesSearch && matchesStatus;
    });
  }, [orders, search, statusFilter]);

  const statusValues: string[] = Array.from(
    new Set(orders.map((o) => (o.status || "").trim()).filter(Boolean)),
  ).sort();

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: `${label} copied`, description: text });
    });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Orders</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Paid orders from your storefront. Linked customizer sessions load when an order has a session id.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search order id, email, store, product, or SKU…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {statusValues.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="rounded-md border overflow-hidden">
          <div className="divide-y">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-4">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-4 w-24 ml-auto" />
              </div>
            ))}
          </div>
        </div>
      ) : stores.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground">No corporate stores</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              Orders are scoped to your stores. Add or open a corporate store first.
            </p>
            <Button className="mt-6" asChild>
              <Link to="/corporate-stores">Corporate stores</Link>
            </Button>
          </CardContent>
        </Card>
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground">No orders yet</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              Orders appear here as soon as a buyer completes checkout on your storefront.
            </p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground">No orders match</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              Try clearing search or setting status to &quot;All statuses&quot;. You have {orders.length}{" "}
              order{orders.length === 1 ? "" : "s"}.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table className="min-w-[820px]">
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Store</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Placed</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => {
                const itemQty = row.items.reduce((s, i) => s + (i.quantity || 0), 0);
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs">
                      {row.id.slice(0, 8)}…
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.store?.name || row.store?.tenant_slug || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs max-w-[200px] truncate">
                      {row.customer_email || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{row.status || "—"}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        {format(new Date(row.created_at), "MMM d, yyyy")}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.items.length} line{row.items.length === 1 ? "" : "s"}
                      {itemQty > 0 ? <span className="text-foreground"> · {itemQty} qty</span> : null}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {formatMoney(row.amount_total, row.currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedOrder(row)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Details
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Order{" "}
              <span className="font-mono text-base">
                {selectedOrder?.id.slice(0, 8)}…
              </span>{" "}
              <span className="text-muted-foreground font-normal text-base">
                ({selectedOrder?.store?.name || selectedOrder?.store?.tenant_slug || "store"})
              </span>
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && (() => {
            const sid = selectedOrder.session_id || "";
            const sess = sid ? sessionById[sid] : null;
            const printUrl = sid ? `${window.location.origin}/print/${sid}` : "";

            return (
              <div className="space-y-4 text-sm">
                {/* Payment summary */}
                <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                  <div className="font-medium text-foreground flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Payment summary
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                    <div>
                      <span className="text-muted-foreground">Total:</span>{" "}
                      <span className="font-medium text-foreground">
                        {formatMoney(selectedOrder.amount_total, selectedOrder.currency)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Status:</span>{" "}
                      <Badge variant="secondary" className="text-[10px]">{selectedOrder.status || "—"}</Badge>
                    </div>
                    {selectedOrder.application_fee_amount != null && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Platform fee:</span>{" "}
                        <span className="text-foreground">
                          {formatMoney(selectedOrder.application_fee_amount, selectedOrder.currency)}
                        </span>
                      </div>
                    )}
                    {selectedOrder.customer_email && (
                      <div className="col-span-2 flex items-center gap-1.5">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        <a href={`mailto:${selectedOrder.customer_email}`} className="text-primary break-all">
                          {selectedOrder.customer_email}
                        </a>
                      </div>
                    )}
                    {selectedOrder.stripe_payment_intent && (
                      <div className="col-span-2 font-mono text-[10px] text-muted-foreground break-all">
                        PI: {selectedOrder.stripe_payment_intent}
                      </div>
                    )}
                    {selectedOrder.stripe_checkout_id && (
                      <div className="col-span-2 font-mono text-[10px] text-muted-foreground break-all">
                        CS: {selectedOrder.stripe_checkout_id}
                      </div>
                    )}
                    {selectedOrder.stripe_account_id && (
                      <div className="col-span-2 font-mono text-[10px] text-muted-foreground break-all">
                        Connected acct: {selectedOrder.stripe_account_id}
                      </div>
                    )}
                  </div>
                </div>

                {/* Print URL */}
                {sid && (
                  <div className="rounded-md border bg-primary/5 p-3 space-y-2">
                    <div className="font-medium text-foreground flex items-center gap-2">
                      <Printer className="h-4 w-4" />
                      Print URL
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Send this to your print shop. Opens the printer-ready view with high-res assets and specs.
                    </p>
                    <div className="flex flex-wrap items-center gap-2 rounded border bg-background p-2">
                      <code className="flex-1 text-xs font-mono break-all">{printUrl}</code>
                      <Button variant="outline" size="sm" onClick={() => copyToClipboard(printUrl, "Print URL")}>
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </Button>
                      <Button variant="default" size="sm" asChild>
                        <a href={printUrl} target="_blank" rel="noopener noreferrer">
                          <Printer className="h-3 w-3 mr-1" />
                          Open
                        </a>
                      </Button>
                    </div>
                  </div>
                )}

                {/* Customizer session */}
                {sid && (
                  <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                    <div className="font-medium text-foreground flex items-center gap-2">
                      <Palette className="h-4 w-4" />
                      Customizer session
                    </div>
                    {!sess ? (
                      <div className="text-xs text-muted-foreground font-mono break-all">
                        Session {sid}: not found.
                      </div>
                    ) : (
                      <div className="rounded-md border bg-background p-3 space-y-2">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="font-medium">
                              {(sess.product_data as { name?: string } | null)?.name || "Customizer session"}
                            </div>
                            <div className="text-xs text-muted-foreground font-mono">{sid}</div>
                            <Badge variant="outline" className="mt-1 text-[10px]">
                              {sess.status}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" asChild>
                              <a href={`${window.location.origin}/embed/${sid}`} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3 w-3 mr-1" />
                                Open embed
                              </a>
                            </Button>
                            <Button variant="outline" size="sm" asChild>
                              <a href={`${window.location.origin}/review/${sid}`} target="_blank" rel="noopener noreferrer">
                                Review
                              </a>
                            </Button>
                          </div>
                        </div>
                        {(sess.customer_name || sess.customer_email) && (
                          <div className="text-xs text-muted-foreground">
                            {sess.customer_name && <span>{sess.customer_name}</span>}
                            {sess.customer_name && sess.customer_email && " · "}
                            {sess.customer_email && <span>{sess.customer_email}</span>}
                          </div>
                        )}
                        {(() => {
                          const imgs = getDesignImagesFromSession(sess);
                          if (imgs.length === 0) return null;
                          return (
                            <div className="grid grid-cols-3 gap-2 pt-1">
                              {imgs.slice(0, 6).map((url, i) => (
                                <a
                                  key={i}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="aspect-square rounded border bg-muted overflow-hidden"
                                >
                                  <img src={url} alt="" className="w-full h-full object-contain" />
                                </a>
                              ))}
                            </div>
                          );
                        })()}
                        {(() => {
                          const sides = getSideAssetsFromSession(sess);
                          if (sides.length === 0) return null;
                          return (
                            <div className="flex flex-wrap gap-2 pt-1">
                              {sides.map((s, i) => (
                                <Button key={i} variant="secondary" size="sm" asChild>
                                  <a href={s.designPNG || s.previewPNG} target="_blank" rel="noopener noreferrer">
                                    <Download className="h-4 w-4 mr-1" />
                                    Print file ({s.view || `side ${i + 1}`})
                                  </a>
                                </Button>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}

                {/* Line items */}
                <div className="border rounded-md divide-y">
                  {selectedOrder.items.length === 0 ? (
                    <div className="p-3 text-xs text-muted-foreground">No line items.</div>
                  ) : (
                    selectedOrder.items.map((li) => (
                      <div key={li.id} className="p-3 space-y-2 flex gap-3">
                        {li.image_url ? (
                          <img
                            src={li.image_url}
                            alt=""
                            className="h-16 w-16 shrink-0 rounded border bg-muted object-contain"
                          />
                        ) : null}
                        <div className="flex-1 space-y-1">
                          <div className="font-medium">{li.name}</div>
                          <div className="text-muted-foreground text-xs flex flex-wrap gap-x-3 gap-y-1">
                            {li.sku ? <span>SKU: {li.sku}</span> : null}
                            {li.variant_color ? <span>Color: {li.variant_color}</span> : null}
                            {li.variant_size ? <span>Size: {li.variant_size}</span> : null}
                            <span>Qty: {li.quantity}</span>
                            <span>{formatMoney(li.unit_amount, li.currency)} ea</span>
                          </div>
                        </div>
                        <div className="text-sm font-medium whitespace-nowrap">
                          {formatMoney((li.unit_amount || 0) * (li.quantity || 0), li.currency)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
