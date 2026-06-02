import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ArrowLeft, Sparkles, Store, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SubscriptionEmbeddedCheckout } from "@/components/SubscriptionEmbeddedCheckout";
import {
  useSubscription,
  PLAN_META,
  EXTRA_STORE_PRICE,
  EXTRA_SEAT_PRICE,
  type PlanKey,
} from "@/hooks/useSubscription";
import { useAuth } from "@/contexts/AuthContext";

const HOSTED_SHARED: string[] = [
  "Hosted storefront with custom domain",
  "Embeddable Printonet Product Customizer",
  "AI Design Assistant",
  "Stripe hosted checkout",
  "Supplier catalog sync (S&S, SanMar)",
  "Production-ready high-res exports",
  "White-label branding",
  "Invoicing & order tools",
];

const PLAN_TAGLINES: Record<PlanKey, string> = {
  customizer_monthly:
    "Embed the Customizer in your existing site. No hosted store, no extras.",
  starter_monthly:
    "Get your print shop online and selling custom products fast.",
  growth_monthly:
    "For growing shops managing more products, customers, and stores.",
  pro_monthly:
    "For established operations running multiple storefronts and teams.",
};

function planFeatures(key: PlanKey): string[] {
  const meta = PLAN_META[key];
  if (key === "customizer_monthly") {
    return [
      "Embeddable Printonet Product Customizer",
      "1 team seat",
      "AI Design Assistant",
      "Production-ready exports",
      "White-label branding",
      meta.support,
    ];
  }
  return [
    `${meta.includedStores} hosted store${meta.includedStores > 1 ? "s" : ""}`,
    `${meta.productsPerStore} products${meta.includedStores > 1 ? " per store" : ""}`,
    `${meta.includedSeats} team seat${meta.includedSeats > 1 ? "s" : ""}`,
    meta.support,
    ...HOSTED_SHARED,
  ];
}

export default function Pricing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { planKey: currentPlan, isActive } = useSubscription();
  const [openPlan, setOpenPlan] = useState<PlanKey | null>(null);

  const hostedTiers: PlanKey[] = ["starter_monthly", "growth_monthly", "pro_monthly"];
  const customizerMeta = PLAN_META.customizer_monthly;
  const isCustomizerCurrent = currentPlan === "customizer_monthly" && isActive;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="flex items-center gap-3 mb-2">
          {user && (
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          )}
        </div>
        <h1 className="text-4xl font-semibold tracking-tight mb-3">
          Choose your plan
        </h1>
        <p className="text-muted-foreground mb-10 max-w-2xl">
          Pick a hosted store plan to sell custom products end-to-end, or grab
          the Customizer-only plan to embed it into a site you already run.
          No setup fees. Cancel any time.
        </p>

        {!user && (
          <Card className="p-4 mb-8 bg-muted/40">
            <p className="text-sm">
              <span className="font-medium">Sign in first</span> to start a subscription.{" "}
              <Button variant="link" className="px-1" onClick={() => navigate("/auth")}>
                Sign in
              </Button>
            </p>
          </Card>
        )}

        {/* Hosted store plans */}
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
          Hosted store plans
        </h2>
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {hostedTiers.map((key) => {
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

        {/* Customizer-only plan */}
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
          Printonet Product Customizer only
        </h2>
        <Card className="p-6 mb-12 md:flex md:items-center md:gap-8 border-dashed">
          <div className="flex items-start gap-4 flex-1">
            <div className="rounded-md bg-primary/10 p-3 text-primary shrink-0">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-baseline gap-2 flex-wrap">
                <h3 className="text-xl font-semibold">{customizerMeta.name}</h3>
                <span className="text-sm text-muted-foreground">
                  ${customizerMeta.monthly}/mo
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground max-w-xl">
                {PLAN_TAGLINES.customizer_monthly} Drop the Customizer widget
                into Shopify, WooCommerce, or any site — checkout stays in your
                store, design data flows to your fulfillment workflow.
              </p>
              <ul className="mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-1">
                {planFeatures("customizer_monthly").map((f) => (
                  <li key={f} className="flex gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-4 md:mt-0 md:w-48 shrink-0">
            <Button
              className="w-full"
              variant={isCustomizerCurrent ? "outline" : "default"}
              disabled={!user || isCustomizerCurrent}
              onClick={() => setOpenPlan("customizer_monthly")}
            >
              {isCustomizerCurrent ? "Current plan" : "Choose Customizer"}
            </Button>
          </div>
        </Card>

        {/* Add-ons */}
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
          Add-ons
        </h2>
        <div className="grid md:grid-cols-2 gap-6 mb-10">
          <Card className="p-6 flex items-start gap-4">
            <div className="rounded-md bg-primary/10 p-3 text-primary shrink-0">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <h3 className="font-semibold">Extra hosted store</h3>
                <span className="text-sm text-muted-foreground">
                  ${EXTRA_STORE_PRICE}/mo each
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Add a separate storefront on top of what your plan includes.
                Each store has its own products, branding, and domain.
                Available on Starter, Grow, and Pro.
              </p>
            </div>
          </Card>
          <Card className="p-6 flex items-start gap-4">
            <div className="rounded-md bg-primary/10 p-3 text-primary shrink-0">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <h3 className="font-semibold">Extra team seat</h3>
                <span className="text-sm text-muted-foreground">
                  ${EXTRA_SEAT_PRICE}/mo each
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Invite teammates beyond the seats included with your plan.
                Each seat gets its own login with role-based access.
              </p>
            </div>
          </Card>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          All prices in USD. Add-ons can be selected at checkout or managed
          anytime from your billing portal.
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
