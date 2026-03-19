import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Palette, Layers, ShoppingCart, ArrowRight } from "lucide-react";
import logo from "@/assets/customizer-studio-logo.png";

const features = [
  {
    icon: Palette,
    title: "Rich Design Tools",
    description: "Upload images, add text with custom fonts, shapes, and clipart to create your perfect design.",
  },
  {
    icon: Layers,
    title: "Layer Management",
    description: "Full control with drag-to-reorder layers, opacity, locking, and visibility toggles.",
  },
  {
    icon: ShoppingCart,
    title: "Order & Checkout",
    description: "Save your designs, add to cart, and order custom products delivered to your door.",
  },
];

const showcaseProducts = [
  { emoji: "👕", label: "T-Shirts", delay: "0s" },
  { emoji: "🧥", label: "Hoodies", delay: "0.5s" },
  { emoji: "☕", label: "Mugs", delay: "1s" },
  { emoji: "📱", label: "Cases", delay: "1.5s" },
  { emoji: "👜", label: "Totes", delay: "2s" },
];

export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-lg">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="Customizer Studio" className="h-8" />
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/products">
              <Button variant="ghost">Browse Products</Button>
            </Link>
            <Link to="/products">
              <Button className="gap-2">
                Start Designing <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden py-24 md:py-36">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="container relative flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-sm text-muted-foreground mb-6">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Design. Customize. Order.
          </div>
          <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tight max-w-4xl leading-[1.1]">
            Create stunning custom{" "}
            <span className="text-gradient">products</span>{" "}
            in minutes
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground leading-relaxed">
            Design custom apparel and accessories with our powerful editor. Upload images, add text,
            shapes, and more — then order your creations with one click.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4">
            <Link to="/products">
              <Button size="lg" className="gap-2 text-base px-8 h-12">
                Start Designing <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          </div>

          {/* Floating product showcase */}
          <div className="mt-20 flex items-center justify-center gap-6 md:gap-10">
            {showcaseProducts.map((p) => (
              <div
                key={p.label}
                className="flex flex-col items-center gap-2 animate-float"
                style={{ animationDelay: p.delay }}
              >
                <div className="flex h-16 w-16 md:h-20 md:w-20 items-center justify-center rounded-2xl bg-card border shadow-lg text-3xl md:text-4xl">
                  {p.emoji}
                </div>
                <span className="text-xs text-muted-foreground font-medium">{p.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 border-t bg-muted/30">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold">Everything you need to create</h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
              Professional-grade tools in a simple, intuitive interface.
            </p>
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

      {/* CTA */}
      <section className="py-24">
        <div className="container flex flex-col items-center text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold max-w-2xl">
            Ready to bring your ideas to life?
          </h2>
          <p className="mt-4 text-muted-foreground">No design skills needed. Start customizing in seconds.</p>
          <Link to="/products" className="mt-8">
            <Button size="lg" className="gap-2 text-base px-8 h-12">
              Browse Products <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-display font-semibold text-foreground">Customizer Studio</span>
          </div>
          <p>© {new Date().getFullYear()} All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
