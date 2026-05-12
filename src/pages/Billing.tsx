import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ExternalLink, CreditCard, Building2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription, EXTRA_STORE_PRICE } from "@/hooks/useSubscription";
import { getStripeEnvironment } from "@/lib/stripe";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";

export default function Billing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const sub = useSubscription();
  const [opening, setOpening] = useState(false);

  const { data: storeCount = 0 } = useQuery({
    queryKey: ["store_count", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { count } = await supabase
        .from("corporate_stores")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id);
      return count ?? 0;
    },
  });

  const openPortal = async () => {
    setOpening(true);
    try {
      const { data, error } = await supabase.functions.invoke("subscription-portal", {
        body: {
          environment: getStripeEnvironment(),
          returnUrl: `${window.location.origin}/billing`,
        },
      });
      if (error || !data?.url) throw new Error(error?.message || "Failed to open portal");
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast({ title: "Couldn't open billing portal", description: (e as Error).message, variant: "destructive" });
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PaymentTestModeBanner />
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold">Billing & Plan</h1>
          <p className="text-muted-foreground mt-1">
            Manage your Printonet subscription and store seats.
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate("/pricing")}>
          View all plans
        </Button>
      </div>

      {!sub.isActive ? (
        <Card className="p-8 text-center">
          <AlertTriangle className="h-10 w-10 text-warning mx-auto mb-3 text-amber-500" />
          <h2 className="text-xl font-semibold mb-2">No active plan</h2>
          <p className="text-muted-foreground mb-6">
            You need an active subscription to operate corporate stores.
          </p>
          <Button onClick={() => navigate("/pricing")}>Choose a plan</Button>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-semibold">{sub.planMeta?.name}</h2>
                  <Badge variant="secondary">{sub.subscription?.status}</Badge>
                  {sub.cancelAtPeriodEnd && (
                    <Badge variant="destructive">Cancels at period end</Badge>
                  )}
                </div>
                <p className="text-muted-foreground text-sm">
                  ${sub.planMeta?.monthly}/mo · {sub.feeLabel} per transaction
                </p>
                {sub.periodEnd && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Renews {sub.periodEnd.toLocaleDateString()}
                  </p>
                )}
              </div>
              <Button onClick={openPortal} disabled={opening}>
                <CreditCard className="h-4 w-4" />
                {opening ? "Opening…" : "Manage billing"}
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold">Store seats</h3>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <div className="text-2xl font-semibold">{sub.includedStores}</div>
                <div className="text-xs text-muted-foreground">Included</div>
              </div>
              <div>
                <div className="text-2xl font-semibold">{sub.extraStores}</div>
                <div className="text-xs text-muted-foreground">
                  Add-on (${EXTRA_STORE_PRICE}/mo each)
                </div>
              </div>
              <div>
                <div className="text-2xl font-semibold">
                  {storeCount} <span className="text-base text-muted-foreground">/ {sub.totalStoreLimit}</span>
                </div>
                <div className="text-xs text-muted-foreground">In use</div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Add or remove store seats from the billing portal — changes prorate automatically.
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
