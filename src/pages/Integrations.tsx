import MarketingLayout from "@/components/MarketingLayout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Code2, ShoppingBag, Store, Globe, Package, Truck } from "lucide-react";

const integrations = [
  {
    icon: ShoppingBag,
    name: "Shopify",
    desc: "One-click OAuth connection. Products sync automatically. Cart integration preserves design data through checkout.",
    status: "Available",
  },
  {
    icon: Store,
    name: "WooCommerce",
    desc: "WordPress plugin with universal loader injection. Products push directly via REST API with full variant mapping.",
    status: "Available",
  },
  {
    icon: Globe,
    name: "Custom Stores",
    desc: "JavaScript SDK with iframe embed or script tag. Works with any platform that renders HTML — React, Vue, static sites, and more.",
    status: "Available",
  },
  {
    icon: Package,
    name: "S&S Activewear",
    desc: "Browse the full S&S catalog, import blank products with colors, sizes, and pricing directly into your inventory.",
    status: "Available",
  },
  {
    icon: Truck,
    name: "SanMar",
    desc: "Connect your SanMar account via PromoStandards API. Search by style number and import products with full variant data.",
    status: "Available",
  },
  {
    icon: Code2,
    name: "REST API",
    desc: "Full API access for custom workflows. Create sessions, manage products, and retrieve design outputs programmatically.",
    status: "Available",
  },
];

export default function Integrations() {
  return (
    <MarketingLayout>
      <section className="py-24 md:py-32">
        <div className="container">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h1 className="font-display text-4xl md:text-6xl font-bold tracking-tight leading-[1.1]">
              Connects to your{" "}
              <span className="text-gradient">entire stack</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
              From e-commerce platforms to blank product suppliers, Customizer Studio integrates with the tools you already use.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {integrations.map((item) => (
              <div
                key={item.name}
                className="group rounded-xl border bg-card p-7 transition-all hover:shadow-lg hover:border-primary/30"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                    {item.status}
                  </span>
                </div>
                <h3 className="font-display text-base font-semibold mb-2">{item.name}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-16">
            <Link to="/developers">
              <Button size="lg" variant="outline" className="gap-2">
                <Code2 className="h-4 w-4" /> View API Documentation
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
