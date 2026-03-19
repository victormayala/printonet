import { Link } from "react-router-dom";
import { products, categories } from "@/data/products";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight, Package } from "lucide-react";
import { useState } from "react";

export default function Products() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const filtered = activeCategory ? products.filter((p) => p.category === activeCategory) : products;

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-lg">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <span className="font-display text-xl font-bold">Customizer Studio</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/products">
              <Button variant="ghost">Browse Products</Button>
            </Link>
          </div>
        </div>
      </nav>

      <div className="container py-12">
        <div className="mb-10">
          <h1 className="font-display text-4xl font-bold">Choose a product</h1>
          <p className="mt-2 text-muted-foreground">Select a product to start customizing with your designs.</p>
        </div>

        {/* Category filter */}
        <div className="flex flex-wrap gap-2 mb-8">
          <Button
            variant={activeCategory === null ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveCategory(null)}
          >
            All
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={activeCategory === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </Button>
          ))}
        </div>

        {/* Product grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((product) => (
            <Link
              key={product.id}
              to={`/design/${product.id}`}
              className="group rounded-xl border bg-card overflow-hidden transition-all hover:shadow-lg hover:border-primary/30"
            >
              <div className="flex h-48 items-center justify-center bg-muted/50 text-7xl transition-transform group-hover:scale-110">
                {product.icon}
              </div>
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-display text-lg font-semibold">{product.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{product.description}</p>
                  </div>
                  <span className="text-sm font-semibold text-primary">${product.basePrice}</span>
                </div>
                {/* Color swatches */}
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex gap-1.5">
                    {product.variants.map((v) => (
                      <div
                        key={v.color}
                        className="h-5 w-5 rounded-full border shadow-sm"
                        style={{ backgroundColor: v.hex }}
                        title={v.colorName}
                      />
                    ))}
                  </div>
                  <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1 group-hover:text-primary transition-colors">
                    Customize <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
