import { Link } from "react-router-dom";
import { products, categories } from "@/data/products";
import { Button } from "@/components/ui/button";
import { ArrowRight, Package, ImageIcon } from "lucide-react";
import logo from "@/assets/customizer-studio-logo.png";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface InventoryProduct {
  id: string;
  name: string;
  description: string | null;
  category: string;
  base_price: number;
  image_front: string | null;
  image_back: string | null;
  image_side1: string | null;
  image_side2: string | null;
  is_active: boolean;
}

export default function Products() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [invProducts, setInvProducts] = useState<InventoryProduct[]>([]);

  useEffect(() => {
    supabase
      .from("inventory_products")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setInvProducts(data as InventoryProduct[]);
      });
  }, []);

  const allCategories = [...new Set([...categories, ...invProducts.map((p) => p.category)])];

  const filteredStatic = activeCategory
    ? products.filter((p) => p.category === activeCategory)
    : products;
  const filteredInv = activeCategory
    ? invProducts.filter((p) => p.category === activeCategory)
    : invProducts;

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-lg">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="Customizer Studio" className="h-8" />
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/products">
              <Button variant="ghost">Browse Products</Button>
            </Link>
            <Link to="/inventory">
              <Button variant="outline" className="gap-2">
                <Package className="h-4 w-4" /> Inventory
              </Button>
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
          {allCategories.map((cat) => (
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

        {/* Inventory products */}
        {filteredInv.length > 0 && (
          <>
            <h2 className="font-display text-xl font-semibold mb-4">Your Products</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
              {filteredInv.map((product) => (
                <div
                  key={product.id}
                  className="group rounded-xl border bg-card overflow-hidden transition-all hover:shadow-lg hover:border-primary/30"
                >
                  <div className="aspect-square w-full bg-muted/50 overflow-hidden">
                    {product.image_front ? (
                      <img
                        src={product.image_front}
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-display font-semibold truncate">{product.name}</h3>
                      <span className="text-sm font-semibold text-primary">${product.base_price.toFixed(2)}</span>
                    </div>
                    <Link to={`/design/inv-${product.id}`}>
                      <Button size="sm" className="gap-1.5 shrink-0">
                        Customize <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Static sample products */}
        {filteredStatic.length > 0 && (
          <>
            {filteredInv.length > 0 && (
              <h2 className="font-display text-xl font-semibold mb-4">Sample Products</h2>
            )}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredStatic.map((product) => (
                <div
                  key={product.id}
                  className="group rounded-xl border bg-card overflow-hidden transition-all hover:shadow-lg hover:border-primary/30"
                >
                  <div className="aspect-square w-full bg-muted/50 flex items-center justify-center text-7xl transition-transform group-hover:scale-105">
                    {product.icon}
                  </div>
                  <div className="p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-display font-semibold truncate">{product.name}</h3>
                      <span className="text-sm font-semibold text-primary">${product.basePrice.toFixed(2)}</span>
                    </div>
                    <Link to={`/design/${product.id}`}>
                      <Button size="sm" className="gap-1.5 shrink-0">
                        Customize <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
