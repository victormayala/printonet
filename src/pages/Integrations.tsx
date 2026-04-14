import MarketingLayout from "@/components/MarketingLayout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Code2, ShoppingBag, Store, Globe, Package, Truck } from "lucide-react";

const integrations = [
  {
    icon: ShoppingBag,
    name: "Shopify",
    desc: "One-click OAuth connection. Products sync automatically. Cart integration preserves design data through checkout.",
  },
  {
    icon: Store,
    name: "WooCommerce",
    desc: "WordPress plugin with universal loader injection. Products push directly via REST API with full variant mapping.",
  },
  {
    icon: Globe,
    name: "Custom Stores",
    desc: "JavaScript SDK with iframe embed or script tag. Works with any platform that renders HTML — React, Vue, static sites, and more.",
  },
  {
    icon: Package,
    name: "S&S Activewear",
    desc: "Browse the full S&S catalog, import blank products with colors, sizes, and pricing directly into your inventory.",
  },
  {
    icon: Truck,
    name: "SanMar",
    desc: "Connect your SanMar account via PromoStandards API. Search by style number and import products with full variant data.",
  },
  {
    icon: Code2,
    name: "REST API",
    desc: "Full API access for custom workflows. Create sessions, manage products, and retrieve design outputs programmatically.",
  },
];

export default function Integrations() {
  return (
    <MarketingLayout>
      <section className="py-28 md:py-36">
        <div className="container">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h1 className="font-display text-5xl md:text-[4.5rem] font-bold tracking-tight leading-[1.05]">
              Connects to your entire stack.
            </h1>
            <p className="mt-8 text-lg md:text-xl text-muted-foreground leading-relaxed">
              From e-commerce platforms to blank product suppliers, Customizer Studio integrates with the tools you already use.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-14 max-w-5xl mx-auto">
            {integrations.map((item) => (
              <div key={item.name} className="text-center">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-foreground">
                  <item.icon className="h-6 w-6" />
                </div>
                <h3 className="font-display text-lg font-semibold mb-2">{item.name}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-20">
            <Link to="/developers">
              <Button variant="outline" className="rounded-full px-6 h-11 gap-2 font-semibold">
                <Code2 className="h-4 w-4" /> View API Documentation
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
