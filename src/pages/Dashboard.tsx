import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowUpRight,
  Building2,
  Clock,
  DollarSign,
  Package,
  Palette,
  ShoppingBag,
  Truck,
  Users,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, subDays, startOfDay, startOfWeek } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

type OrderRow = {
  id: string;
  store_id: string | null;
  amount_total: number | null;
  currency: string | null;
  status: string;
  customer_email: string | null;
  created_at: string;
};

type StoreRow = {
  id: string;
  name: string;
  tenant_slug: string | null;
  status: string;
  store_type: string;
  custom_domain: string | null;
};

function fmtMoney(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: (currency || "USD").toUpperCase(),
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              {label}
            </p>
            <p className="text-2xl font-semibold">{value}</p>
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
          </div>
          <div
            className={`h-10 w-10 rounded-lg grid place-items-center ${
              accent ?? "bg-primary/10 text-primary"
            }`}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [productCount, setProductCount] = useState(0);
  const [customizableCount, setCustomizableCount] = useState(0);
  const [customerCount, setCustomerCount] = useState(0);
  const [integrationCount, setIntegrationCount] = useState(0);
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    if (!user) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function load() {
    setLoading(true);
    const since = subDays(new Date(), 30).toISOString();

    const [
      profileRes,
      storesRes,
      productsRes,
      customizableRes,
      integrationsRes,
    ] = await Promise.all([
      supabase.from("profiles").select("store_name").eq("id", user!.id).maybeSingle(),
      supabase
        .from("corporate_stores")
        .select("id,name,tenant_slug,status,store_type,custom_domain")
        .eq("user_id", user!.id),
      supabase
        .from("inventory_products")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id),
      supabase
        .from("corporate_store_products")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("customizable", true),
      supabase
        .from("store_integrations")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id),
    ]);

    setDisplayName(profileRes.data?.store_name || user!.email?.split("@")[0] || "there");
    const storeRows = (storesRes.data || []) as StoreRow[];
    setStores(storeRows);
    setProductCount(productsRes.count ?? 0);
    setCustomizableCount(customizableRes.count ?? 0);
    setIntegrationCount(integrationsRes.count ?? 0);

    const storeIds = storeRows.map((s) => s.id);
    if (storeIds.length > 0) {
      const [ordersRes, customersRes] = await Promise.all([
        supabase
          .from("orders")
          .select("id,store_id,amount_total,currency,status,customer_email,created_at")
          .in("store_id", storeIds)
          .gte("created_at", subDays(new Date(), 90).toISOString())
          .order("created_at", { ascending: false }),
        supabase
          .from("customer_profiles")
          .select("id", { count: "exact", head: true })
          .in("store_id", storeIds),
      ]);
      setOrders((ordersRes.data || []) as OrderRow[]);
      setCustomerCount(customersRes.count ?? 0);
    } else {
      setOrders([]);
      setCustomerCount(0);
    }
    setLoading(false);
  }

  const since30 = useMemo(() => subDays(new Date(), 30), []);
  const sincePrev30 = useMemo(() => subDays(new Date(), 60), []);

  const ordersLast30 = useMemo(
    () => orders.filter((o) => new Date(o.created_at) >= since30),
    [orders, since30],
  );
  const ordersPrev30 = useMemo(
    () =>
      orders.filter((o) => {
        const d = new Date(o.created_at);
        return d >= sincePrev30 && d < since30;
      }),
    [orders, sincePrev30, since30],
  );

  const revenue30 = ordersLast30.reduce((s, o) => s + (o.amount_total ?? 0), 0);
  const revenuePrev30 = ordersPrev30.reduce((s, o) => s + (o.amount_total ?? 0), 0);
  const revenueDelta =
    revenuePrev30 > 0 ? ((revenue30 - revenuePrev30) / revenuePrev30) * 100 : null;
  const aov = ordersLast30.length > 0 ? revenue30 / ordersLast30.length : 0;
  const currency = orders[0]?.currency || "usd";

  const todayStart = useMemo(() => startOfDay(new Date()), []);
  const weekStart = useMemo(() => startOfWeek(new Date(), { weekStartsOn: 1 }), []);
  const ordersToday = useMemo(
    () => orders.filter((o) => new Date(o.created_at) >= todayStart),
    [orders, todayStart],
  );
  const ordersThisWeek = useMemo(
    () => orders.filter((o) => new Date(o.created_at) >= weekStart),
    [orders, weekStart],
  );
  const revenueToday = ordersToday.reduce((s, o) => s + (o.amount_total ?? 0), 0);
  const revenueWeek = ordersThisWeek.reduce((s, o) => s + (o.amount_total ?? 0), 0);
  const pendingCount = useMemo(
    () => ordersLast30.filter((o) => o.status !== "paid" && o.status !== "refunded").length,
    [ordersLast30],
  );
  const statusBreakdown = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of ordersLast30) m.set(o.status, (m.get(o.status) ?? 0) + 1);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [ordersLast30]);

  // 30-day timeseries
  const chartData = useMemo(() => {
    const buckets = new Map<string, number>();
    for (let i = 29; i >= 0; i--) {
      const d = startOfDay(subDays(new Date(), i));
      buckets.set(d.toISOString(), 0);
    }
    for (const o of ordersLast30) {
      const key = startOfDay(new Date(o.created_at)).toISOString();
      if (buckets.has(key)) {
        buckets.set(key, (buckets.get(key) ?? 0) + (o.amount_total ?? 0));
      }
    }
    return Array.from(buckets.entries()).map(([iso, cents]) => ({
      date: format(new Date(iso), "MMM d"),
      revenue: cents / 100,
    }));
  }, [ordersLast30]);

  // Top stores
  const storesById = useMemo(() => new Map(stores.map((s) => [s.id, s])), [stores]);
  const topStores = useMemo(() => {
    const m = new Map<string, { revenue: number; orders: number }>();
    for (const o of ordersLast30) {
      if (!o.store_id) continue;
      const cur = m.get(o.store_id) ?? { revenue: 0, orders: 0 };
      cur.revenue += o.amount_total ?? 0;
      cur.orders += 1;
      m.set(o.store_id, cur);
    }
    return Array.from(m.entries())
      .map(([id, v]) => ({ store: storesById.get(id), ...v }))
      .filter((r) => r.store)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [ordersLast30, storesById]);

  const recentOrders = orders.slice(0, 6);
  const activeStores = stores.filter((s) => s.status === "active").length;

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-80" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Greeting */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Welcome back, {displayName}
          </h1>
          <p className="text-muted-foreground mt-1">
            Here's how your print business is performing across all stores and channels.
          </p>
        </div>
        <Badge variant="secondary" className="gap-1">
          <Activity className="h-3 w-3" />
          Last 30 days
        </Badge>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          icon={DollarSign}
          label="Revenue (30d)"
          value={fmtMoney(revenue30, currency)}
          hint={
            revenueDelta == null
              ? "No prior period data"
              : `${revenueDelta >= 0 ? "▲" : "▼"} ${Math.abs(revenueDelta).toFixed(1)}% vs prev 30d`
          }
          accent="bg-emerald-500/10 text-emerald-600"
        />
        <KpiCard
          icon={ShoppingBag}
          label="Orders (30d)"
          value={ordersLast30.length.toLocaleString()}
          hint={`AOV ${fmtMoney(aov, currency)}`}
          accent="bg-blue-500/10 text-blue-600"
        />
        <KpiCard
          icon={Users}
          label="Customers"
          value={customerCount.toLocaleString()}
          hint="Across all stores"
          accent="bg-purple-500/10 text-purple-600"
        />
        <KpiCard
          icon={Building2}
          label="Active Stores"
          value={`${activeStores}`}
          hint={`${stores.length} total`}
          accent="bg-amber-500/10 text-amber-600"
        />
        <KpiCard
          icon={Package}
          label="Inventory Products"
          value={productCount.toLocaleString()}
          hint="In your catalog"
          accent="bg-rose-500/10 text-rose-600"
        />
        <KpiCard
          icon={Palette}
          label="Customizable Live"
          value={customizableCount.toLocaleString()}
          hint="Products with Customizer on"
          accent="bg-pink-500/10 text-pink-600"
        />
        <KpiCard
          icon={Truck}
          label="External Integrations"
          value={integrationCount.toLocaleString()}
          hint="Shopify · WooCommerce"
          accent="bg-cyan-500/10 text-cyan-600"
        />
        <KpiCard
          icon={Zap}
          label="Orders Today"
          value={ordersToday.length.toLocaleString()}
          hint={`${fmtMoney(revenueToday, currency)} today`}
          accent="bg-indigo-500/10 text-indigo-600"
        />
      </div>

      {/* Chart + Plan usage */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-base">Revenue trend</CardTitle>
              <CardDescription>Last 30 days across all stores</CardDescription>
            </div>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {chartData.every((d) => d.revenue === 0) ? (
              <div className="h-64 grid place-items-center text-sm text-muted-foreground">
                No revenue yet in the last 30 days.
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 8, left: -8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={48} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={(v: number) => [`$${v.toFixed(2)}`, "Revenue"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fill="url(#rev)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Plan & seats</CardTitle>
            <CardDescription>
              {sub.isActive ? sub.planMeta?.name : "No active plan"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {sub.isActive ? (
              <>
                <div>
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-sm text-muted-foreground">Store seats</span>
                    <span className="text-sm font-medium">
                      {stores.length} / {sub.totalStoreLimit}
                    </span>
                  </div>
                  <Progress
                    value={
                      sub.totalStoreLimit > 0
                        ? Math.min(100, (stores.length / sub.totalStoreLimit) * 100)
                        : 0
                    }
                  />
                </div>
                <div className="text-sm text-muted-foreground">
                  Transaction fee:{" "}
                  <span className="text-foreground font-medium">{sub.feeLabel}</span>
                </div>
                {sub.periodEnd && (
                  <div className="text-sm text-muted-foreground">
                    Renews{" "}
                    <span className="text-foreground font-medium">
                      {sub.periodEnd.toLocaleDateString()}
                    </span>
                  </div>
                )}
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link to="/billing">
                    Manage billing <ArrowUpRight className="h-3 w-3 ml-1" />
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Subscribe to unlock corporate stores, higher store limits, and lower
                  transaction fees.
                </p>
                <Button asChild className="w-full">
                  <Link to="/pricing">View plans</Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent orders + Top stores */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-base">Recent orders</CardTitle>
              <CardDescription>Latest activity from all your stores</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/orders">
                View all <ArrowUpRight className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No orders yet. Once customers check out, they'll show up here.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentOrders.map((o) => {
                  const store = o.store_id ? storesById.get(o.store_id) : undefined;
                  return (
                    <div key={o.id} className="flex items-center justify-between py-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">
                          {o.customer_email || "Guest customer"}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {store?.name ?? "—"} · {format(new Date(o.created_at), "MMM d, h:mm a")}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 pl-3">
                        <Badge variant={o.status === "paid" ? "default" : "secondary"}>
                          {o.status}
                        </Badge>
                        <div className="text-sm font-semibold tabular-nums">
                          {fmtMoney(o.amount_total ?? 0, o.currency ?? currency)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top stores (30d)</CardTitle>
            <CardDescription>By revenue</CardDescription>
          </CardHeader>
          <CardContent>
            {topStores.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No store revenue in the last 30 days.
              </div>
            ) : (
              <div className="space-y-3">
                {topStores.map(({ store, revenue, orders: oc }, i) => (
                  <Link
                    key={store!.id}
                    to={`/corporate-stores/${store!.id}`}
                    className="flex items-center gap-3 p-2 -mx-2 rounded-md hover:bg-accent/50 transition-colors"
                  >
                    <div className="h-7 w-7 rounded-md bg-primary/10 text-primary grid place-items-center text-xs font-semibold">
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{store!.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {oc} order{oc === 1 ? "" : "s"}
                      </div>
                    </div>
                    <div className="text-sm font-semibold tabular-nums">
                      {fmtMoney(revenue, currency)}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Stores grid */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-base">Your stores</CardTitle>
            <CardDescription>Hosted Printonet storefronts and channels</CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/corporate-stores">
              Manage <ArrowUpRight className="h-3 w-3 ml-1" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {stores.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              You don't have any stores yet.{" "}
              <Link to="/corporate-stores" className="text-primary underline">
                Create your first store
              </Link>
              .
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {stores.slice(0, 6).map((s) => (
                <Link
                  key={s.id}
                  to={`/corporate-stores/${s.id}`}
                  className="border border-border rounded-lg p-4 hover:border-primary hover:bg-accent/30 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium truncate">{s.name}</div>
                    <Badge
                      variant={s.status === "active" ? "default" : "secondary"}
                      className="text-[10px]"
                    >
                      {s.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {s.custom_domain || (s.tenant_slug ? `/s/${s.tenant_slug}` : "—")}
                  </div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground mt-2">
                    {s.store_type}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick actions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Quick actions</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Button asChild variant="outline" className="justify-start h-auto py-3">
            <Link to="/products">
              <Package className="h-4 w-4 mr-2" />
              <div className="text-left">
                <div className="text-sm font-medium">Add products</div>
                <div className="text-xs text-muted-foreground">Build your catalog</div>
              </div>
            </Link>
          </Button>
          <Button asChild variant="outline" className="justify-start h-auto py-3">
            <Link to="/suppliers">
              <Truck className="h-4 w-4 mr-2" />
              <div className="text-left">
                <div className="text-sm font-medium">Import from supplier</div>
                <div className="text-xs text-muted-foreground">S&S · SanMar</div>
              </div>
            </Link>
          </Button>
          <Button asChild variant="outline" className="justify-start h-auto py-3">
            <Link to="/customizer">
              <Palette className="h-4 w-4 mr-2" />
              <div className="text-left">
                <div className="text-sm font-medium">Customize brand</div>
                <div className="text-xs text-muted-foreground">Logo, colors, fonts</div>
              </div>
            </Link>
          </Button>
          <Button asChild variant="outline" className="justify-start h-auto py-3">
            <Link to="/corporate-stores">
              <Building2 className="h-4 w-4 mr-2" />
              <div className="text-left">
                <div className="text-sm font-medium">Launch a store</div>
                <div className="text-xs text-muted-foreground">Hosted or connect</div>
              </div>
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
