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
            <Sparkles className="h-6 w-6 text-primary" />
            <span className="font-display text-xl font-bold">Customizer Studio</span>
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
                <Link
                  key={product.id}
                  to={`/design/inv-${product.id}`}
                  className="group rounded-xl border bg-card overflow-hidden transition-all hover:shadow-lg hover:border-primary/30"
                >
                  <div className="flex h-48 items-center justify-center bg-muted/50 overflow-hidden">
                    {product.image_front ? (
                      <img
                        src={product.image_front}
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform group-hover:scale-110"
                      />
                    ) : (
                      <ImageIcon className="h-12 w-12 text-muted-foreground" />
                    )}
                  </div>
                  <div className="p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-display text-lg font-semibold">{product.name}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{product.description || product.category}</p>
                      </div>
                      <span className="text-sm font-semibold text-primary">${product.base_price}</span>
                    </div>
                    <div className="mt-4 flex items-center justify-end">
                      <span className="text-xs text-muted-foreground flex items-center gap-1 group-hover:text-primary transition-colors">
                        Customize <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                  </div>
                </Link>
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
          </>
        )}
      </div>
    </div>
  );
}
