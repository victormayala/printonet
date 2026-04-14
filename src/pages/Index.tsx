import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Layers, Globe, Zap, Paintbrush, Code2, Printer } from "lucide-react";
import MarketingLayout from "@/components/MarketingLayout";

const features = [
  {
    icon: Layers,
    title: "Rich Design Tools",
    description: "Text with custom fonts, shapes, clipart, image upload — all with layers, undo/redo, and precision controls.",
  },
  {
    icon: Globe,
    title: "Platform Agnostic",
    description: "Embed via iframe or JavaScript SDK. Works with Shopify, WooCommerce, custom stores, and any platform.",
  },
  {
    icon: Zap,
    title: "Instant Results",
    description: "Get back high-res PNG exports and canvas data via postMessage — ready for fulfillment.",
  },
];

const steps = [
  { step: "1", title: "Create a Session", desc: "POST your product data (name, images, variants) to our API." },
  { step: "2", title: "Customer Designs", desc: "The customizer opens in an iframe. Your customer adds text, images, shapes." },
  { step: "3", title: "Get Results Back", desc: "Receive high-res PNGs and design data back via callback to your store." },
];

export default function Index() {
  return (
    <MarketingLayout>
      {/* Hero */}
      <section className="py-28 md:py-44">
        <div className="container flex flex-col items-center text-center">
          <h1 className="font-display text-5xl sm:text-6xl md:text-[5.5rem] font-bold tracking-tight max-w-5xl leading-[1.05]">
            Add product customization to any store.
          </h1>
          <p className="mt-8 max-w-2xl text-lg md:text-xl text-muted-foreground leading-relaxed">
            Drop our JavaScript SDK into your e-commerce platform. Customers design custom products in a rich canvas editor —
            you get back print-ready PNGs and design data.
          </p>
          <div className="mt-12 flex flex-col sm:flex-row gap-4">
            <Link to="/auth">
              <Button className="rounded-full px-8 h-14 text-base font-semibold bg-foreground text-background hover:bg-foreground/90 gap-2">
                Get Started Free <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link to="/features">
              <Button variant="outline" className="rounded-full px-8 h-14 text-base font-semibold gap-2">
                View Features
              </Button>
            </Link>
          </div>
          <p className="mt-5 text-sm text-muted-foreground flex items-center gap-1.5">
            🔓 No credit card required
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="py-28 border-t">
        <div className="container">
          <div className="text-center mb-20">
            <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight">How it works</h2>
            <p className="mt-5 text-muted-foreground text-lg max-w-xl mx-auto">
              Three API calls. That's all it takes.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-10 max-w-5xl mx-auto">
            {steps.map((item) => (
              <div key={item.step} className="text-center">
                <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-foreground text-background text-xl font-bold">
                  {item.step}
                </div>
                <h3 className="font-display text-xl font-semibold mb-3">{item.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-28 border-t">
        <div className="container">
          <div className="text-center mb-20">
            <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight">Built for developers & store owners</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-10 max-w-5xl mx-auto">
            {features.map((f) => (
              <div key={f.title} className="text-center">
                <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-foreground">
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="font-display text-xl font-semibold mb-3">{f.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Code snippet preview */}
      <section className="py-28 border-t">
        <div className="container flex flex-col items-center text-center">
          <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight max-w-2xl mb-10">
            Integrate in minutes
          </h2>
          <div className="max-w-2xl w-full rounded-2xl border bg-card overflow-hidden text-left shadow-sm">
            <div className="px-5 py-3 border-b bg-muted/50 flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-destructive/60" />
                <div className="h-3 w-3 rounded-full bg-accent/60" />
                <div className="h-3 w-3 rounded-full bg-primary/60" />
              </div>
              <span className="text-xs text-muted-foreground font-mono ml-2">your-store.html</span>
            </div>
            <pre className="p-6 text-sm font-mono leading-relaxed overflow-x-auto text-foreground">
{`<script src="${window.location.origin}/customizer-sdk.js"></script>
<script>
  CustomizerStudio.open({
    product: {
      name: 'Classic T-Shirt',
      image_front: '/tshirt-front.png',
    },
    onComplete: (result) => {
      // Add to cart with design PNGs
      addToCart(result.sides);
    }
  });
</script>`}
            </pre>
          </div>
          <Link to="/developers" className="mt-10">
            <Button variant="outline" className="rounded-full px-6 h-11 gap-2 font-semibold">
              <Code2 className="h-4 w-4" /> Full Documentation
            </Button>
          </Link>
        </div>
      </section>

      {/* CTA */}
      <section className="py-28 border-t">
        <div className="container text-center">
          <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight mb-6">Ready to get started?</h2>
          <p className="text-muted-foreground text-lg mb-10 max-w-xl mx-auto">
            Create your free account and start adding product customization to your store today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/auth">
              <Button className="rounded-full px-8 h-14 text-base font-semibold bg-foreground text-background hover:bg-foreground/90 gap-2">
                Create Free Account <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/pricing">
              <Button variant="outline" className="rounded-full px-8 h-14 text-base font-semibold gap-2">
                View Pricing
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
