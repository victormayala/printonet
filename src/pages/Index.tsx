import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Code, Layers, Zap, ArrowRight, Globe, Paintbrush, Package, LogIn } from "lucide-react";
import logo from "@/assets/customizer-studio-logo.png";
import { useAuth } from "@/contexts/AuthContext";

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
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-lg">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="Customizer Studio" className="h-8" />
          </Link>
          <div className="flex items-center gap-4">
            {user ? (
              <Link to="/products">
                <Button className="gap-2">
                  Dashboard <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <Link to="/auth">
                <Button className="gap-2">
                  <LogIn className="h-4 w-4" /> Sign In
                </Button>
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden py-24 md:py-36">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="container relative flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-sm text-muted-foreground mb-6">
            Embeddable Product Customizer
          </div>
          <h1 className="font-display text-3xl sm:text-5xl md:text-7xl font-bold tracking-tight max-w-4xl leading-[1.1]">
            Add product{" "}
            <span className="text-gradient">customization</span>{" "}
            to any store
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground leading-relaxed">
            Drop our JavaScript SDK into your e-commerce platform. Customers design custom products in a rich canvas editor —
            you get back print-ready PNGs and design data.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4">
            <Link to="/developers">
              <Button size="lg" className="gap-2 text-base px-8 h-12">
                View Integration Docs <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 border-t bg-muted/30">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold">How it works</h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
              Three API calls. That's all it takes.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {steps.map((item) => (
              <div key={item.step} className="group rounded-xl border bg-card p-8 transition-all hover:shadow-lg hover:border-primary/30">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                  {item.step}
                </div>
                <h3 className="font-display text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 border-t">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold">Built for developers & store owners</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {features.map((f) => (
              <div key={f.title} className="group rounded-xl border bg-card p-8 transition-all hover:shadow-lg hover:border-primary/30">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="font-display text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Code snippet preview */}
      <section className="py-24 border-t bg-muted/30">
        <div className="container flex flex-col items-center text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold max-w-2xl mb-8">
            Integrate in minutes
          </h2>
          <div className="max-w-2xl w-full rounded-xl border bg-card overflow-hidden text-left">
            <div className="px-4 py-2 border-b bg-muted flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-destructive/60" />
                <div className="h-3 w-3 rounded-full bg-yellow-400/60" />
                <div className="h-3 w-3 rounded-full bg-green-400/60" />
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
          <Link to="/developers" className="mt-8">
            <Button size="lg" variant="outline" className="gap-2">
              <Code className="h-4 w-4" /> Full Documentation
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Customizer Studio" className="h-6" />
          </div>
          <p>© {new Date().getFullYear()} All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
