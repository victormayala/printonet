import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { SubscriptionEmbeddedCheckout } from "@/components/SubscriptionEmbeddedCheckout";
import {
  useSubscription,
  PLAN_META,
  EXTRA_STORE_PRICE,
  EXTRA_SEAT_PRICE,
  type PlanKey,
} from "@/hooks/useSubscription";
import { useAuth } from "@/contexts/AuthContext";

const SHARED_FEATURES = [
  "Product Customizer Studio",
  "AI Design Assistant",
  "Stripe Hosted Checkout",
  "Suppliers Catalog Sync",
  "Production-Ready Exports",
  "Custom Domains",
  "White Label Branding",
  "Invoicing Tools",
  "Advanced Store Dashboards",
  "Corporate Budget Features",
];

const PLAN_TAGLINES: Record<PlanKey, string> = {
  customizer_monthly:
    "Embed the Customizer Studio in your existing site. No hosted store, no extras.",
  starter_monthly:
    "Perfect for getting your print shop online and selling custom products fast.",
  growth_monthly:
    "Built for growing print shops managing more products, customers, and sales.",
  pro_monthly:
    "For established print operations running multiple storefronts and larger teams.",
};

function planFeatures(key: PlanKey): string[] {
  const meta = PLAN_META[key];
  if (key === "customizer_monthly") {
    return [
      "Embeddable Customizer Studio",
      "1 Team Seat",
      meta.support,
      "AI Design Assistant",
      "Production-Ready Exports",
      "White Label Branding",
    ];
  }
  return [
    `${meta.includedStores} Hosted Store${meta.includedStores > 1 ? "s" : ""}`,
    `${meta.productsPerStore} Products${meta.includedStores > 1 ? " per Store" : ""}`,
    `${meta.includedSeats} Team Seat${meta.includedSeats > 1 ? "s" : ""}`,
    meta.support,
    ...SHARED_FEATURES,
  ];
}

export default function Pricing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { planKey: currentPlan, isActive } = useSubscription();
  const [openPlan, setOpenPlan] = useState<PlanKey | null>(null);

  const tiers: PlanKey[] = [
    "customizer_monthly",
    "starter_monthly",
    "growth_monthly",
    "pro_monthly",
  ];

  return (
    <div className="min-h-screen bg-background">
      <PaymentTestModeBanner />
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="flex items-center gap-3 mb-2">
          {user && (
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          )}
        </div>
        <h1 className="text-4xl font-semibold tracking-tight mb-3">
          Start free. Scale on your terms.
        </h1>
        <p className="text-muted-foreground mb-10 max-w-2xl">
          No setup fees. No surprise charges. Cancel any time.
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

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                  <p className="mt-1 text-sm text-muted-foreground min-h-[40px]">
                    {PLAN_TAGLINES[key]}
                  </p>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-4xl font-bold">${meta.monthly}</span>
                    <span className="text-muted-foreground">/mo</span>
                  </div>
                </div>

                <ul className="space-y-2 mb-6 flex-1">
                  {planFeatures(key).map((f) => (
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
          All prices in USD. Add-ons available on hosted-store plans: extra stores
          ${EXTRA_STORE_PRICE}/mo · extra team seats ${EXTRA_SEAT_PRICE}/mo. Manage
          add-ons from your billing portal.
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
