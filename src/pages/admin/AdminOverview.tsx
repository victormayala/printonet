import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2, ShoppingBag, DollarSign, TrendingUp, CreditCard, Loader2 } from "lucide-react";

const fmtMoney = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((cents || 0) / 100);
const fmtNum = (n: number) => new Intl.NumberFormat("en-US").format(n || 0);

export default function AdminOverview() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-platform-stats"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("admin_platform_stats");
      if (error) throw error;
      return data as Record<string, number>;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const s = data || ({} as Record<string, number>);

  const tiles = [
    { label: "Total users", value: fmtNum(s.total_users), sub: `+${fmtNum(s.new_users_30d)} in 30d`, icon: Users },
    { label: "Active stores", value: `${fmtNum(s.active_stores)} / ${fmtNum(s.total_stores)}`, sub: "active / total", icon: Building2 },
    { label: "Paid orders", value: fmtNum(s.total_orders), sub: `+${fmtNum(s.new_orders_30d)} in 30d`, icon: ShoppingBag },
    { label: "GMV (all time)", value: fmtMoney(s.gmv_cents), sub: `${fmtMoney(s.gmv_30d_cents)} in 30d`, icon: DollarSign },
    { label: "Platform fees", value: fmtMoney(s.platform_fees_cents), sub: "all time", icon: TrendingUp },
    { label: "MRR", value: fmtMoney(s.mrr_cents), sub: `${fmtNum(s.active_subscriptions)} active subs`, icon: CreditCard },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Platform overview</h1>
        <p className="text-sm text-muted-foreground">Cross-tenant KPIs across all Printonet customers.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tiles.map((t) => (
          <Card key={t.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t.label}</CardTitle>
              <t.icon className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{t.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{t.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
