import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Building2, ShoppingBag, DollarSign, TrendingUp, CreditCard, Loader2, Zap, AlertTriangle } from "lucide-react";

const fmtMoney = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((cents || 0) / 100);
const fmtNum = (n: number) => new Intl.NumberFormat("en-US").format(n || 0);

type ConnectEnv = {
  mode: "test" | "live" | "unset";
  secret_configured: boolean;
  publishable_configured: boolean;
  publishable_mode: "test" | "live" | "unset";
  webhook_configured: boolean;
};

export default function AdminOverview() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-platform-stats"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("admin_platform_stats");
      if (error) throw error;
      return data as Record<string, number>;
    },
  });

  const { data: connectEnv } = useQuery({
    queryKey: ["stripe-connect-env"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<ConnectEnv>("stripe-connect-env");
      if (error) throw error;
      return data;
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

  const mismatched =
    connectEnv &&
    connectEnv.mode !== "unset" &&
    connectEnv.publishable_mode !== "unset" &&
    connectEnv.mode !== connectEnv.publishable_mode;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Platform overview</h1>
          <p className="text-sm text-muted-foreground">Cross-tenant KPIs across all Printonet customers.</p>
        </div>
        {connectEnv && (
          <Card className="min-w-[260px]">
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Zap className="h-3.5 w-3.5" /> Stripe Connect
              </div>
              <div className="flex items-center gap-2">
                {connectEnv.mode === "live" ? (
                  <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">LIVE mode</Badge>
                ) : connectEnv.mode === "test" ? (
                  <Badge className="bg-amber-500 hover:bg-amber-500 text-white">TEST mode</Badge>
                ) : (
                  <Badge variant="destructive">Not configured</Badge>
                )}
                {mismatched && (
                  <span className="flex items-center gap-1 text-xs text-destructive">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Key mismatch
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
                <div>Secret key: {connectEnv.secret_configured ? connectEnv.mode : "missing"}</div>
                <div>Publishable: {connectEnv.publishable_configured ? connectEnv.publishable_mode : "missing"}</div>
                <div>Webhook secret: {connectEnv.webhook_configured ? "set" : "missing"}</div>
              </div>
            </CardContent>
          </Card>
        )}
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

