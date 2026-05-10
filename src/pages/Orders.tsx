import { useState, useEffect, useMemo } from "react";
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
  Filter, ExternalLink, Palette, Copy, Printer, CreditCard, Mail, Layers,
} from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import type { Database } from "@/integrations/supabase/types";

type WooOrderRow = Database["public"]["Tables"]["printonet_woo_order_files"]["Row"];
type SessionRow = Database["public"]["Tables"]["customizer_sessions"]["Row"];

type LineItem = {
  order_item_id?: number;
  product_id?: number;
  variation_id?: number;
  name?: string;
  quantity?: number;
  sku?: string;
  print_file_url?: string;
  printFileUrl?: string;
  design_layers_url?: string;
  designLayersUrl?: string;
  design_preview_url?: string;
  customizer_design_url?: string;
  customizer_session_id?: string;
};

function parseLineItems(row: WooOrderRow): LineItem[] {
  const raw = row.line_items;
  if (!Array.isArray(raw)) return [];
  return raw as LineItem[];
}

function lineDesignLayersUrl(li: LineItem): string {
  return String(li.design_layers_url || li.designLayersUrl || "").trim();
}

function linePrintFileUrl(li: LineItem): string {
  return String(li.print_file_url || li.printFileUrl || "").trim();
}

/** Opens formatted JSON in-app; avoids browser freezing on huge single-line JSON. */
function layersJsonViewerHref(publicLayersUrl: string): string {
  const u = publicLayersUrl.trim();
  if (!u.startsWith("http")) return u;
  return `${window.location.origin}/layers-preview?url=${encodeURIComponent(u)}`;
}

/** Loose UUID check for session ids stored on Woo line meta */
function looksLikeSessionId(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s.trim(),
  );
}

function collectSessionIdsFromOrders(orderRows: WooOrderRow[]): string[] {
  const set = new Set<string>();
  for (const o of orderRows) {
    for (const li of parseLineItems(o)) {
      const id = (li.customizer_session_id || "").trim();
      if (id && looksLikeSessionId(id)) set.add(id);
    }
  }
  return [...set];
}

function orderSessionIds(order: WooOrderRow): string[] {
  const set = new Set<string>();
  for (const li of parseLineItems(order)) {
    const id = (li.customizer_session_id || "").trim();
    if (id && looksLikeSessionId(id)) set.add(id);
  }
  return [...set];
}

function getDesignImagesFromSession(session: SessionRow): string[] {
  if (!session.design_output || typeof session.design_output !== "object") return [];
  const output = session.design_output as Record<string, unknown>;
  const images: string[] = [];
  for (const key of Object.keys(output)) {
    const v = output[key];
    if (typeof v === "string" && v.startsWith("http")) images.push(v);
  }
  return images;
}

const SESSION_FETCH_CHUNK = 120;

async function fetchCustomizerSessionsByIds(ids: string[]): Promise<Record<string, SessionRow>> {
  const out: Record<string, SessionRow> = {};
  if (ids.length === 0) return out;

  for (let i = 0; i < ids.length; i += SESSION_FETCH_CHUNK) {
    const chunk = ids.slice(i, i + SESSION_FETCH_CHUNK);
    const { data, error } = await supabase
      .from("customizer_sessions")
      .select("*")
      .in("id", chunk);

    if (error) {
      toast({
        title: "Could not load customizer sessions",
        description: error.message,
        variant: "destructive",
      });
      continue;
    }
    for (const row of data || []) {
      out[row.id] = row as SessionRow;
    }
  }
  return out;
}

export default function Orders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<WooOrderRow[]>([]);
  const [sessionById, setSessionById] = useState<Record<string, SessionRow>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<WooOrderRow | null>(null);

  useEffect(() => {
    if (!user) return;
    void fetchPaidOrders();
  }, [user]);

  async function fetchPaidOrders() {
    setLoading(true);

    const { data: stores, error: storesErr } = await supabase
      .from("corporate_stores")
      .select("id, tenant_slug")
      .eq("user_id", user!.id);

    if (storesErr) {
      toast({
        title: "Error loading stores",
        description: storesErr.message,
        variant: "destructive",
      });
      setOrders([]);
      setSessionById({});
      setLoading(false);
      return;
    }

    const slugs = (stores || [])
      .map((s) => s.tenant_slug)
      .filter((s): s is string => typeof s === "string" && s.length > 0);

    if (slugs.length === 0) {
      setOrders([]);
      setSessionById({});
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("printonet_woo_order_files")
      .select("*")
      .in("tenant_slug", slugs)
      .order("updated_at", { ascending: false });

    if (error) {
      toast({
        title: "Error loading paid orders",
        description:
          error.message ||
          "Ensure printonet_woo_order_files exists and RLS allows your corporate stores.",
        variant: "destructive",
      });
      setOrders([]);
      setSessionById({});
    } else {
      const rows = (data as WooOrderRow[]) || [];
      setOrders(rows);
      const sessionIds = collectSessionIdsFromOrders(rows);
      if (sessionIds.length > 0) {
        const map = await fetchCustomizerSessionsByIds(sessionIds);
        setSessionById(map);
      } else {
        setSessionById({});
      }
    }

    setLoading(false);
  }

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      const q = search.toLowerCase();
      const lines = parseLineItems(o);
      const sessionProductMatch = lines.some((li) => {
        const sid = (li.customizer_session_id || "").trim();
        if (!sid || !sessionById[sid]) return false;
        const name = (sessionById[sid].product_data as { name?: string } | null)?.name || "";
        return name.toLowerCase().includes(q);
      });
      const matchesSearch =
        !q ||
        String(o.order_number ?? "").toLowerCase().includes(q) ||
        String(o.order_id).includes(q) ||
        o.tenant_slug.toLowerCase().includes(q) ||
        lines.some((li) => (li.name || "").toLowerCase().includes(q)) ||
        sessionProductMatch;
      const st = (o.order_status || "").toLowerCase();
      const matchesStatus =
        statusFilter === "all" || st === statusFilter.toLowerCase();
      return matchesSearch && matchesStatus;
    });
  }, [orders, search, statusFilter, sessionById]);

  const statusValues = Array.from(
    new Set(orders.map((o) => (o.order_status || "").trim()).filter(Boolean)),
  ).sort();

  function resolvedSessionCount(row: WooOrderRow): number {
    const ids = orderSessionIds(row);
    return ids.filter((id) => sessionById[id]).length;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Orders</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Paid WooCommerce orders (synced from your stores). Linked customizer sessions load when a line item includes a session id.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search order #, tenant, product, or session product…"
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
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground">No paid orders yet</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              After a customer pays on your Woo store, the order appears here. Customizer session details show inside each order when session ids were saved on the line items.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table className="min-w-[820px]">
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Store</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Lines</TableHead>
                <TableHead>Sessions</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => {
                const lines = parseLineItems(row);
                const filesCount = lines.filter((l) => {
                  const p = linePrintFileUrl(l);
                  const d = lineDesignLayersUrl(l);
                  return p !== "" || d !== "";
                }).length;
                const sidCount = orderSessionIds(row).length;
                const resolved = resolvedSessionCount(row);
                return (
                  <TableRow key={`${row.tenant_slug}-${row.store_url}-${row.order_id}`}>
                    <TableCell className="font-medium">
                      #{row.order_number || row.order_id}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm font-mono">
                      {row.tenant_slug}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs max-w-[200px] truncate">
                      {row.store_url}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{row.order_status || "—"}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {row.date_paid ? (
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 shrink-0" />
                          {format(new Date(row.date_paid), "MMM d, yyyy")}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {lines.length}
                      {filesCount > 0 ? (
                        <span className="text-foreground"> · {filesCount} file(s)</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {sidCount === 0 ? (
                        "—"
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <Palette className="h-3.5 w-3.5" />
                          {resolved}/{sidCount}
                        </span>
                      )}
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
              Order #{selectedOrder?.order_number || selectedOrder?.order_id}{" "}
              <span className="text-muted-foreground font-normal text-base">
                ({selectedOrder?.tenant_slug})
              </span>
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && (() => {
            const payload = (selectedOrder.payload || {}) as Record<string, any>;
            const amountTotal = typeof payload.amount_total === "number" ? payload.amount_total : null;
            const customerEmail = payload.customer_email || payload?.tenant_order?.customer_email || null;
            const stripeSession = payload.stripe_checkout_session_id || null;
            const stripeAccount = payload.stripe_account_id || null;
            const sessionIds = orderSessionIds(selectedOrder);
            const wooViewUrl = `${(selectedOrder.store_url || "").replace(/\/+$/, "")}/wp-admin/post.php?post=${selectedOrder.order_id}&action=edit`;

            const copyToClipboard = (text: string, label: string) => {
              navigator.clipboard.writeText(text).then(() => {
                toast({ title: `${label} copied`, description: text });
              });
            };

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
                      {amountTotal != null
                        ? `${(amountTotal / 100).toFixed(2)} ${(selectedOrder.currency || "USD").toUpperCase()}`
                        : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span>{" "}
                    <Badge variant="secondary" className="text-[10px]">{selectedOrder.order_status || "—"}</Badge>
                  </div>
                  {customerEmail && (
                    <div className="col-span-2 flex items-center gap-1.5">
                      <Mail className="h-3 w-3 text-muted-foreground" />
                      <a href={`mailto:${customerEmail}`} className="text-primary break-all">{customerEmail}</a>
                    </div>
                  )}
                  {stripeSession && (
                    <div className="col-span-2 font-mono text-[10px] text-muted-foreground break-all">
                      {stripeSession}
                    </div>
                  )}
                  {stripeAccount && (
                    <div className="col-span-2 font-mono text-[10px] text-muted-foreground break-all">
                      Connected acct: {stripeAccount}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button variant="outline" size="sm" asChild>
                    <a href={selectedOrder.store_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Store
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a href={wooViewUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Open in Woo admin
                    </a>
                  </Button>
                </div>
              </div>

              {/* Print URLs — one per linked customizer session */}
              {sessionIds.length > 0 && (
                <div className="rounded-md border bg-primary/5 p-3 space-y-2">
                  <div className="font-medium text-foreground flex items-center gap-2">
                    <Printer className="h-4 w-4" />
                    Print URLs
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Send these to your print shop. Each URL opens the printer-ready view with high-res assets and specs.
                  </p>
                  <div className="space-y-2">
                    {sessionIds.map((sid) => {
                      const printUrl = `${window.location.origin}/print/${sid}`;
                      return (
                        <div key={sid} className="flex flex-wrap items-center gap-2 rounded border bg-background p-2">
                          <code className="flex-1 text-xs font-mono break-all">{printUrl}</code>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(printUrl, "Print URL")}
                          >
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
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Customizer sessions referenced on this paid order */}
              {(() => {
                const ids = orderSessionIds(selectedOrder);
                if (ids.length === 0) return null;
                return (
                  <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                    <div className="font-medium text-foreground flex items-center gap-2">
                      <Palette className="h-4 w-4" />
                      Customizer sessions (paid order)
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Loaded from Supabase when line items include <span className="font-mono">customizer_session_id</span>.
                    </p>
                    <div className="space-y-3">
                      {ids.map((sid) => {
                        const sess = sessionById[sid];
                        if (!sess) {
                          return (
                            <div key={sid} className="text-xs text-muted-foreground font-mono break-all">
                              Session {sid}: not found or still loading.
                            </div>
                          );
                        }
                        const pname =
                          (sess.product_data as { name?: string } | null)?.name || "Customizer session";
                        const imgs = getDesignImagesFromSession(sess);
                        return (
                          <div key={sid} className="rounded-md border bg-background p-3 space-y-2">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <div className="font-medium">{pname}</div>
                                <div className="text-xs text-muted-foreground font-mono">{sid}</div>
                                <Badge variant="outline" className="mt-1 text-[10px]">
                                  {sess.status}
                                </Badge>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button variant="outline" size="sm" asChild>
                                  <a
                                    href={`${window.location.origin}/embed/${sid}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <ExternalLink className="h-3 w-3 mr-1" />
                                    Open embed
                                  </a>
                                </Button>
                                <Button variant="outline" size="sm" asChild>
                                  <a
                                    href={`${window.location.origin}/review/${sid}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
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
                            {imgs.length > 0 && (
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
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              <div className="border rounded-md divide-y">
                {parseLineItems(selectedOrder).map((li, idx) => {
                  const sid = (li.customizer_session_id || "").trim();
                  const sess = sid && sessionById[sid] ? sessionById[sid] : null;
                  return (
                    <div key={li.order_item_id ?? idx} className="p-3 space-y-2">
                      <div className="font-medium">{li.name || `Line ${idx + 1}`}</div>
                      <div className="text-muted-foreground text-xs flex flex-wrap gap-x-3 gap-y-1">
                        {li.sku ? <span>SKU: {li.sku}</span> : null}
                        {li.quantity != null ? <span>Qty: {li.quantity}</span> : null}
                        {sid ? (
                          <span className="font-mono">
                            Session: {sess ? sess.status : sid.slice(0, 8) + "…"}
                          </span>
                        ) : null}
                      </div>
                      {sess && getDesignImagesFromSession(sess).length > 0 && (
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {getDesignImagesFromSession(sess).slice(0, 4).map((url, i) => (
                            <a
                              key={i}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="h-14 w-14 shrink-0 rounded border bg-muted overflow-hidden"
                            >
                              <img src={url} alt="" className="w-full h-full object-cover" />
                            </a>
                          ))}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {linePrintFileUrl(li) ? (
                          <Button variant="secondary" size="sm" asChild>
                            <a href={linePrintFileUrl(li)} target="_blank" rel="noopener noreferrer">
                              <Download className="h-4 w-4 mr-1" />
                              Print file
                            </a>
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-xs">No print file URL</span>
                        )}
                        {lineDesignLayersUrl(li) ? (
                          <Button variant="secondary" size="sm" asChild>
                            <a href={layersJsonViewerHref(lineDesignLayersUrl(li))} target="_blank" rel="noopener noreferrer">
                              <Layers className="h-4 w-4 mr-1" />
                              Design layers
                            </a>
                          </Button>
                        ) : null}
                        {li.design_preview_url ? (
                          <Button variant="outline" size="sm" asChild>
                            <a href={li.design_preview_url} target="_blank" rel="noopener noreferrer">
                              Preview
                            </a>
                          </Button>
                        ) : null}
                        {li.customizer_design_url ? (
                          <Button variant="outline" size="sm" asChild>
                            <a href={li.customizer_design_url} target="_blank" rel="noopener noreferrer">
                              Design asset
                            </a>
                          </Button>
                        ) : null}
                        {sid && looksLikeSessionId(sid) ? (
                          <Button variant="outline" size="sm" asChild>
                            <a
                              href={`${window.location.origin}/embed/${sid}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Palette className="h-3 w-3 mr-1" />
                              Session
                            </a>
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            );
          })()}

        </DialogContent>
      </Dialog>
    </div>
  );
}
