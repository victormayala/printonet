import { Link } from "react-router-dom";
import MarketingLayout from "@/components/MarketingLayout";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight } from "lucide-react";

const plans = [
  {
    name: "Starter",
    price: "Free",
    period: "",
    description: "Perfect for testing and small stores.",
    features: [
      "Up to 5 products",
      "Design studio embed",
      "Standard export (1×)",
      "Community support",
    ],
    cta: "Get Started",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$29",
    period: "/month",
    description: "For growing stores that need more power.",
    features: [
      "Unlimited products",
      "High-res export (4×)",
      "AI design assistant",
      "White labeling",
      "Supplier integrations",
      "Priority support",
    ],
    cta: "Start Free Trial",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For large-scale operations and custom needs.",
    features: [
      "Everything in Pro",
      "Custom integrations",
      "Dedicated support",
      "SLA guarantee",
      "On-premise option",
      "Volume pricing",
    ],
    cta: "Contact Sales",
    highlighted: false,
  },
];

export default function Pricing() {
  return (
    <MarketingLayout>
      <section className="py-28 md:py-36">
        <div className="container">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h1 className="font-display text-5xl md:text-[4.5rem] font-bold tracking-tight leading-[1.05]">
              Simple, transparent pricing.
            </h1>
            <p className="mt-8 text-lg md:text-xl text-muted-foreground leading-relaxed">
              Start free, upgrade when you're ready. No hidden fees.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl border p-8 flex flex-col transition-all ${
                  plan.highlighted
                    ? "border-foreground shadow-xl scale-[1.02]"
                    : "hover:shadow-lg"
                }`}
              >
                {plan.highlighted && (
                  <div className="text-xs font-bold uppercase tracking-wider mb-4 text-foreground">
                    Most Popular
                  </div>
                )}
                <h3 className="font-display text-xl font-bold">{plan.name}</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="font-display text-5xl font-bold">{plan.price}</span>
                  {plan.period && (
                    <span className="text-muted-foreground text-sm">{plan.period}</span>
                  )}
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{plan.description}</p>

                <ul className="mt-8 space-y-3 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm">
                      <Check className="h-4 w-4 text-foreground shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link to={plan.name === "Enterprise" ? "/contact" : "/auth"} className="mt-8">
                  <Button
                    className={`w-full rounded-full h-12 font-semibold gap-2 ${
                      plan.highlighted
                        ? "bg-foreground text-background hover:bg-foreground/90"
                        : ""
                    }`}
                    variant={plan.highlighted ? "default" : "outline"}
                    size="lg"
                  >
                    {plan.cta} <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
