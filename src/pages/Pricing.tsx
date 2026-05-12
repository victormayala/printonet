import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { SubscriptionEmbeddedCheckout } from "@/components/SubscriptionEmbeddedCheckout";
import { useSubscription, PLAN_META, type PlanKey } from "@/hooks/useSubscription";
import { useAuth } from "@/contexts/AuthContext";

const PLAN_FEATURES: Record<PlanKey, string[]> = {
  starter_monthly: [
    "1 corporate store",
    "2.5% transaction fee",
    "Custom domain",
    "Stripe Connect payouts",
    "Hosted Customizer Studio checkout",
    "Add stores at $20/mo each",
  ],
  growth_monthly: [
    "3 corporate stores",
    "1.5% transaction fee",
    "Remove Printonet badge",
    "Push to Shopify & WooCommerce",
    "AI design assistant",
    "Design template library",
    "Add stores at $20/mo each",
  ],
  pro_monthly: [
    "10 corporate stores",
    "0.5% transaction fee",
    "White-label SDK loader",
    "Priority support",
    "Higher AI design quota",
    "Everything in Growth",
    "Add stores at $20/mo each",
  ],
};

export default function Pricing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { planKey: currentPlan, isActive } = useSubscription();
  const [openPlan, setOpenPlan] = useState<PlanKey | null>(null);

  const tiers: PlanKey[] = ["starter_monthly", "growth_monthly", "pro_monthly"];

  return (
    <div className="min-h-screen bg-background">
      <PaymentTestModeBanner />
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex items-center gap-3 mb-2">
          {user && (
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          )}
        </div>
        <h1 className="text-4xl font-semibold tracking-tight mb-3">Choose your plan</h1>
        <p className="text-muted-foreground mb-10 max-w-2xl">
          Pick the plan that fits your storefront. Lower transaction fees and more stores
          unlock as you scale. Cancel or change anytime.
        </p>

        {!user && (
          <Card className="p-4 mb-8 bg-muted/40">
            <p className="text-sm">
              <span className="font-medium">Sign in first</span> to start a subscription.
              {" "}
              <Button variant="link" className="px-1" onClick={() => navigate("/auth")}>
                Sign in
              </Button>
            </p>
          </Card>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          {tiers.map((key) => {
            const meta = PLAN_META[key];
            const isCurrent = currentPlan === key && isActive;
            const isHighlighted = key === "growth_monthly";
            return (
              <Card
                key={key}
                className={`relative p-6 flex flex-col ${
                  isHighlighted ? "border-primary border-2 shadow-lg" : ""
                }`}
              >
                {isHighlighted && (
                  <span className="absolute -top-3 left-6 bg-primary text-primary-foreground text-xs font-medium px-2 py-1 rounded">
                    Most popular
                  </span>
                )}
                <div className="mb-4">
                  <h3 className="text-2xl font-semibold">{meta.name}</h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-4xl font-bold">${meta.monthly}</span>
                    <span className="text-muted-foreground">/mo</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    + {meta.feeLabel} per transaction
                  </p>
                </div>

                <ul className="space-y-2 mb-6 flex-1">
                  {PLAN_FEATURES[key].map((f) => (
                    <li key={f} className="flex gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  disabled={!user || isCurrent}
                  variant={isHighlighted ? "default" : "outline"}
                  onClick={() => setOpenPlan(key)}
                >
                  {isCurrent ? "Current plan" : `Choose ${meta.name}`}
                </Button>
              </Card>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground mt-8 text-center">
          All prices in USD. You can add or remove store seats from your billing portal at any time.
        </p>
      </div>

      <Dialog open={!!openPlan} onOpenChange={(o) => !o && setOpenPlan(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b">
            <DialogTitle>
              Subscribe to {openPlan ? PLAN_META[openPlan].name : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[80vh] overflow-y-auto">
            {openPlan && <SubscriptionEmbeddedCheckout priceId={openPlan} />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
