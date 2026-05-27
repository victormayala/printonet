import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import {
  Search, Package, Calendar,
  Filter, ExternalLink, Palette, Copy, Printer, CreditCard, Mail,
  Download, ChevronDown, ChevronRight, Send, CheckCircle2, XCircle,
  Clock, Loader2, Upload, X,
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

type ApprovalRow = {
  id: string;
  order_id: string;
  status: "pending" | "approved" | "rejected" | "expired";
  customer_email: string;
  token: string;
  sent_at: string;
  decided_at: string | null;
  customer_comment: string | null;
  sender_domain: string | null;
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

function friendlyOrderNumber(id: string, createdAt: string | Date) {
  const d = new Date(createdAt);
  const yy = String(d.getFullYear()).slice(-2);
  const start = new Date(d.getFullYear(), 0, 0);
  const doy = Math.floor((d.getTime() - start.getTime()) / 86400000);
  const datePart = `${yy}${doy.toString(36).toUpperCase().padStart(2, "0")}`;
  const idPart = id.replace(/-/g, "").slice(0, 4).toUpperCase();
  return `#PN-${datePart}-${idPart}`;
}

export default function Orders() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["orders-page", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: storesData, error: storesErr } = await supabase
        .from("corporate_stores")
        .select("id, name, tenant_slug")
        .eq("user_id", user!.id);

      if (storesErr) {
        toast({ title: "Error loading stores", description: storesErr.message, variant: "destructive" });
        return { orders: [] as EnrichedOrder[], stores: [] as StoreRow[], sessionById: {} as Record<string, SessionRow>, approvalsByOrder: {} as Record<string, ApprovalRow[]> };
      }

      const storeRows = (storesData || []) as StoreRow[];
      if (storeRows.length === 0) {
        return { orders: [], stores: storeRows, sessionById: {}, approvalsByOrder: {} };
      }

      const storeIds = storeRows.map((s) => s.id);
      const { data: orderRows, error: ordersErr } = await supabase
        .from("orders")
        .select("*")
        .in("store_id", storeIds)
        .order("created_at", { ascending: false });

      if (ordersErr) {
        toast({ title: "Error loading orders", description: ordersErr.message, variant: "destructive" });
        return { orders: [], stores: storeRows, sessionById: {}, approvalsByOrder: {} };
      }

      const orderIds = (orderRows || []).map((o) => o.id);
      const itemsByOrder: Record<string, OrderItemRow[]> = {};
      const approvalsByOrder: Record<string, ApprovalRow[]> = {};
      if (orderIds.length > 0) {
        const [{ data: itemRows }, { data: approvalRows }] = await Promise.all([
          supabase.from("order_items").select("*").in("order_id", orderIds),
          supabase
            .from("order_approvals")
            .select("id, order_id, status, customer_email, token, sent_at, decided_at, customer_comment, sender_domain")
            .in("order_id", orderIds)
            .order("sent_at", { ascending: false }),
        ]);
        for (const it of (itemRows || []) as OrderItemRow[]) {
          (itemsByOrder[it.order_id] ||= []).push(it);
        }
        for (const a of (approvalRows || []) as ApprovalRow[]) {
          (approvalsByOrder[a.order_id] ||= []).push(a);
        }
      }

      const storeMap = new Map(storeRows.map((s) => [s.id, s]));
      const enriched: EnrichedOrder[] = (orderRows || []).map((o) => ({
        ...(o as OrderRow),
        items: itemsByOrder[o.id] || [],
        store: o.store_id ? storeMap.get(o.store_id) : undefined,
      }));

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

      const sessionById: Record<string, SessionRow> = {};
      if (sessionIds.length > 0) {
        const { data: sessRows } = await supabase
          .from("customizer_sessions")
          .select("*")
          .in("id", sessionIds);
        for (const s of (sessRows || []) as SessionRow[]) sessionById[s.id] = s;
      }

      return { orders: enriched, stores: storeRows, sessionById, approvalsByOrder };
    },
  });

  const orders = data?.orders ?? [];
  const stores = data?.stores ?? [];
  const sessionById = data?.sessionById ?? {};
  const approvalsByOrder = data?.approvalsByOrder ?? {};
  const loading = isLoading;

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

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["orders-page", user?.id] });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Orders</h1>
        <p className="text-muted-foreground text-sm mt-1 max-w-2xl">
          Click any row to view design assets, send the customer a proof for approval, and access the print URL.
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
              <SelectItem key={s} value={s}>{s}</SelectItem>
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
                <TableHead className="w-10" />
                <TableHead>Order</TableHead>
                <TableHead>Store</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Placed</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => {
                const itemQty = row.items.reduce((s, i) => s + (i.quantity || 0), 0);
                const isOpen = expandedId === row.id;
                const approvals = approvalsByOrder[row.id] || [];
                const latestApproval = approvals[0];
                return (
                  <>
                    <TableRow
                      key={row.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => setExpandedId(isOpen ? null : row.id)}
                    >
                      <TableCell>
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        <div className="flex flex-col gap-1">
                          <span>{friendlyOrderNumber(row.id, row.created_at)}</span>
                          {latestApproval && (
                            <ApprovalChip status={latestApproval.status} />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.store?.name || row.store?.tenant_slug || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs max-w-[200px] truncate">
                        {row.customer_email || "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={row.status} />
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
                    </TableRow>
                    {isOpen && (
                      <TableRow key={`${row.id}-detail`} className="bg-muted/20 hover:bg-muted/20">
                        <TableCell colSpan={8} className="p-0">
                          <div className="px-4 py-5 sm:px-6">
                            <OrderDetailPanel
                              order={row}
                              sessionById={sessionById}
                              approvals={approvals}
                              copyToClipboard={copyToClipboard}
                              onApprovalSent={refresh}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function ApprovalChip({ status }: { status: ApprovalRow["status"] }) {
  const map = {
    pending: { label: "Approval pending", variant: "secondary" as const, Icon: Clock },
    approved: { label: "Customer approved", variant: "default" as const, Icon: CheckCircle2 },
    rejected: { label: "Changes requested", variant: "destructive" as const, Icon: XCircle },
    expired: { label: "Approval expired", variant: "outline" as const, Icon: Clock },
  };
  const cfg = map[status];
  return (
    <Badge variant={cfg.variant} className="gap-1 w-fit text-[10px] font-normal">
      <cfg.Icon className="h-2.5 w-2.5" />
      {cfg.label}
    </Badge>
  );
}

function OrderDetailPanel({
  order,
  sessionById,
  approvals,
  copyToClipboard,
  onApprovalSent,
}: {
  order: EnrichedOrder;
  sessionById: Record<string, SessionRow>;
  approvals: ApprovalRow[];
  copyToClipboard: (text: string, label: string) => void;
  onApprovalSent: () => void;
}) {
  const sid = order.session_id || "";
  const sess = sid ? sessionById[sid] : null;
  const printUrl = sid ? `${window.location.origin}/print/${sid}` : "";

  return (
    <div className="space-y-4 text-sm">
      {/* Customer approval workflow */}
      <ApprovalSection
        order={order}
        approvals={approvals}
        copyToClipboard={copyToClipboard}
        onSent={onApprovalSent}
      />

      {/* Payment summary */}
      <div className="rounded-md border bg-background p-3 space-y-2">
        <div className="font-medium text-foreground flex items-center gap-2">
          <CreditCard className="h-4 w-4" />
          Payment summary
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
          <div>
            <span className="text-muted-foreground">Total:</span>{" "}
            <span className="font-medium text-foreground">
              {formatMoney(order.amount_total, order.currency)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Status:</span>{" "}
            <StatusBadge status={order.status} className="text-[10px]" />
          </div>
          {order.application_fee_amount != null && (
            <div className="col-span-2">
              <span className="text-muted-foreground">Platform fee:</span>{" "}
              <span className="text-foreground">
                {formatMoney(order.application_fee_amount, order.currency)}
              </span>
            </div>
          )}
          {order.customer_email && (
            <div className="col-span-2 flex items-center gap-1.5">
              <Mail className="h-3 w-3 text-muted-foreground" />
              <a href={`mailto:${order.customer_email}`} className="text-primary break-all">
                {order.customer_email}
              </a>
            </div>
          )}
          {order.stripe_payment_intent && (
            <div className="col-span-2 font-mono text-[10px] text-muted-foreground break-all">
              PI: {order.stripe_payment_intent}
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
        <div className="space-y-2 rounded-md border bg-background p-3">
          <div className="font-medium text-foreground flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Customizer session
          </div>
          {!sess ? (
            <div className="text-xs text-muted-foreground font-mono break-all">
              Session {sid}: not found.
            </div>
          ) : (
            <div className="rounded-md border bg-muted/30 p-3 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-medium">
                    {(sess.product_data as { name?: string } | null)?.name || "Customizer session"}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">{sid}</div>
                  <StatusBadge status={sess.status} className="mt-1 text-[10px]" />
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
      <div className="border rounded-md divide-y bg-background">
        {order.items.length === 0 ? (
          <div className="p-3 text-xs text-muted-foreground">No line items.</div>
        ) : (
          order.items.map((li) => {
            const meta = ((li as { metadata?: Record<string, unknown> | null }).metadata || {}) as Record<string, unknown>;
            const liSid = typeof meta.customizer_session_id === "string" ? (meta.customizer_session_id as string) : "";
            const liPrint = typeof meta.print_file_url === "string" ? (meta.print_file_url as string) : "";
            const liPreview = typeof meta.design_preview_url === "string" ? (meta.design_preview_url as string) : "";
            const liLayers = typeof meta.design_layers_url === "string" ? (meta.design_layers_url as string) : "";
            const hasMeta = liSid || liPrint || liPreview || liLayers;
            return (
              <div key={li.id} className="p-3 space-y-2">
                <div className="flex gap-3">
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
                {hasMeta && (
                  <div className="rounded border bg-muted/30 p-2 space-y-1 text-xs">
                    {liSid && (
                      <div className="font-mono text-[10px] text-muted-foreground break-all">
                        Session: {liSid}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {liPreview && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={liPreview} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Preview
                          </a>
                        </Button>
                      )}
                      {liPrint && (
                        <Button variant="secondary" size="sm" asChild>
                          <a href={liPrint} target="_blank" rel="noopener noreferrer">
                            <Download className="h-3 w-3 mr-1" />
                            Print file
                          </a>
                        </Button>
                      )}
                      {liLayers && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={liLayers} target="_blank" rel="noopener noreferrer">
                            <Download className="h-3 w-3 mr-1" />
                            Layers
                          </a>
                        </Button>
                      )}
                      {liSid && (
                        <Button variant="default" size="sm" asChild>
                          <a href={`${window.location.origin}/print/${liSid}`} target="_blank" rel="noopener noreferrer">
                            <Printer className="h-3 w-3 mr-1" />
                            Open print URL
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function ApprovalSection({
  order,
  approvals,
  copyToClipboard,
  onSent,
}: {
  order: EnrichedOrder;
  approvals: ApprovalRow[];
  copyToClipboard: (text: string, label: string) => void;
  onSent: () => void;
}) {
  const [recipient, setRecipient] = useState(order.customer_email || "");
  const [sending, setSending] = useState(false);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [proofName, setProofName] = useState<string | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [customMessage, setCustomMessage] = useState("");
  const [lastResult, setLastResult] = useState<{
    approvalUrl: string;
    emailDispatched: boolean;
    emailError: string | null;
    senderDomain: string;
  } | null>(null);

  const latest = approvals[0];

  const handleProofUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Image required", description: "Please upload a PNG or JPG.", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Image too large", description: "Maximum size is 10 MB.", variant: "destructive" });
      return;
    }
    setUploadingProof(true);
    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) throw new Error("You must be signed in to upload.");
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      // RLS requires the first folder segment to be the auth uid.
      const path = `${userData.user.id}/proofs/${order.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("design-exports")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("design-exports").getPublicUrl(path);
      setProofUrl(pub.publicUrl);
      setProofName(file.name);
    } catch (e) {
      toast({ title: "Upload failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setUploadingProof(false);
    }
  };

  const send = async () => {
    if (!recipient || !/^\S+@\S+\.\S+$/.test(recipient)) {
      toast({ title: "Invalid email", description: "Enter a valid recipient address.", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("send-order-approval", {
        body: {
          orderId: order.id,
          recipientEmail: recipient,
          proofImageUrl: proofUrl,
          customMessage: customMessage.trim() || null,
        },
      });
      if (error) throw error;
      setLastResult(result);
      toast({
        title: result.emailDispatched ? "Approval email sent" : "Approval link created",
        description: result.emailDispatched
          ? `Sent from ${result.senderDomain} to ${result.recipient}.`
          : "Email delivery isn't enabled yet — copy the link below to share manually.",
      });
      onSent();
    } catch (e) {
      toast({
        title: "Could not send",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-md border bg-background p-3 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <div className="font-medium text-foreground flex items-center gap-2">
            <Send className="h-4 w-4" />
            Customer approval
          </div>
          <p className="text-xs text-muted-foreground max-w-xl">
            Optional. Email the customer a private link to review the design and approve it before you start printing.
          </p>
        </div>
        {latest && <ApprovalChip status={latest.status} />}
      </div>

      {latest?.status === "approved" || latest?.status === "rejected" ? (
        <div className="rounded border bg-muted/30 p-3 text-xs space-y-1">
          <div className="flex items-center gap-2">
            {latest.status === "approved" ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-destructive" />
            )}
            <span className="font-medium">
              {latest.customer_email} {latest.status === "approved" ? "approved" : "requested changes"}
            </span>
            {latest.decided_at && (
              <span className="text-muted-foreground">
                · {format(new Date(latest.decided_at), "MMM d, yyyy h:mm a")}
              </span>
            )}
          </div>
          {latest.customer_comment && (
            <p className="italic text-muted-foreground pt-1">
              "{latest.customer_comment}"
            </p>
          )}
        </div>
      ) : null}

      <div className="space-y-2">
        <label className="text-xs font-medium text-foreground">
          Proof image <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        {proofUrl ? (
          <div className="flex items-center gap-3 rounded-md border bg-muted/30 p-2">
            <img src={proofUrl} alt="Proof" className="h-12 w-12 rounded object-cover border" />
            <div className="flex-1 text-xs truncate text-muted-foreground">{proofName}</div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => { setProofUrl(null); setProofName(null); }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <label className="flex items-center gap-2 rounded-md border border-dashed bg-background px-3 py-2 cursor-pointer hover:bg-muted/30 transition-colors text-xs text-muted-foreground">
            {uploadingProof ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            <span>{uploadingProof ? "Uploading…" : "Upload a proof image to include in the email"}</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploadingProof}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleProofUpload(f);
                e.target.value = "";
              }}
            />
          </label>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-foreground">
          Message to customer <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        <Textarea
          value={customMessage}
          onChange={(e) => setCustomMessage(e.target.value.slice(0, 1000))}
          placeholder="Add a personal note — e.g. 'Here's the proof for your order. Let me know if anything needs to change before we print.'"
          rows={3}
          className="text-sm"
        />
        <div className="text-[10px] text-muted-foreground text-right">{customMessage.length}/1000</div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          type="email"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="customer@example.com"
          className="flex-1"
        />
        <Button onClick={send} disabled={sending || uploadingProof}>
          {sending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Send className="h-4 w-4 mr-2" />
          )}
          {latest?.status === "pending" ? "Resend approval email" : "Send approval email"}
        </Button>
      </div>

      {lastResult && (
        <div className="rounded border bg-muted/30 p-2 flex flex-wrap items-center gap-2">
          <code className="flex-1 text-xs font-mono break-all">{lastResult.approvalUrl}</code>
          <Button
            variant="outline"
            size="sm"
            onClick={() => copyToClipboard(lastResult.approvalUrl, "Approval link")}
          >
            <Copy className="h-3 w-3 mr-1" /> Copy link
          </Button>
        </div>
      )}
    </div>
  );
}
