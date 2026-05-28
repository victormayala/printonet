import { useQuery } from "@tanstack/react-query";
import { DollarSign, Package, ShoppingCart, Users, Calendar, Globe } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { CorporateStore } from "@/types/corporateStore";

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

export function StoreOverviewStats({ store }: { store: CorporateStore }) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["store_overview_stats", store.id],
    queryFn: async () => {
      const [productsRes, customersRes, ordersRes] = await Promise.all([
        supabase
          .from("corporate_store_products")
          .select("id", { count: "exact", head: true })
          .eq("store_id", store.id),
        supabase
          .from("customer_profiles")
          .select("id", { count: "exact", head: true })
          .eq("store_id", store.id),
        supabase
          .from("orders")
          .select("amount_total, status")
          .eq("store_id", store.id)
          .not("status", "in", "(pending,failed)"),
      ]);

      const orders = ordersRes.data ?? [];
      const revenue = orders
        .filter((o: any) => o.status !== "canceled" && o.status !== "refunded")
        .reduce((sum: number, o: any) => sum + (Number(o.amount_total) || 0), 0);

      return {
        products: productsRes.count ?? 0,
        customers: customersRes.count ?? 0,
        orders: orders.length,
        revenue: revenue / 100,
      };
    },
  });

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  const storefrontUrl = store.custom_domain
    ? `https://${store.custom_domain}`
    : store.tenant_slug
      ? `https://stores.printonet.com/${store.tenant_slug}`
      : null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total revenue"
          value={isLoading ? "—" : fmt(stats?.revenue ?? 0)}
          icon={DollarSign}
        />
        <StatCard label="Orders" value={isLoading ? "—" : stats?.orders ?? 0} icon={ShoppingCart} />
        <StatCard label="Customers" value={isLoading ? "—" : stats?.customers ?? 0} icon={Users} />
        <StatCard label="Products" value={isLoading ? "—" : stats?.products ?? 0} icon={Package} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Store info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">Created</span>
            <span className="ml-auto font-medium">
              {new Date(store.created_at).toLocaleDateString()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">Storefront</span>
            {storefrontUrl ? (
              <a
                href={storefrontUrl}
                target="_blank"
                rel="noreferrer"
                className="ml-auto font-medium text-primary hover:underline truncate"
              >
                {storefrontUrl.replace(/^https?:\/\//, "")}
              </a>
            ) : (
              <span className="ml-auto text-muted-foreground italic">Not configured</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">Store type</span>
            <span className="ml-auto font-medium capitalize">{store.store_type ?? "standard"}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
