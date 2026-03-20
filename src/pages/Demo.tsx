import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import DesignStudio from "./DesignStudio";

const SAMPLE_PRODUCTS = [
  {
    id: "tshirt",
    name: "Classic T-Shirt",
    category: "T-Shirts",
    description: "Premium cotton crew neck tee",
    image_front: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&h=800&fit=crop",
    image_back: "https://images.unsplash.com/photo-1622445275463-afa2ab738c34?w=800&h=800&fit=crop",
  },
  {
    id: "hoodie",
    name: "Premium Hoodie",
    category: "Hoodies",
    description: "Heavyweight fleece hoodie",
    image_front: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800&h=800&fit=crop",
    image_back: "https://images.unsplash.com/photo-1578768079470-c7e3b4a0c53a?w=800&h=800&fit=crop",
  },
  {
    id: "mug",
    name: "Ceramic Mug",
    category: "Mugs",
    description: "11oz ceramic mug",
    image_front: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=800&h=800&fit=crop",
  },
  {
    id: "tote",
    name: "Canvas Tote Bag",
    category: "Tote Bags",
    description: "Sturdy canvas tote",
    image_front: "https://images.unsplash.com/photo-1597633425046-08f5110420b5?w=800&h=800&fit=crop",
  },
];

export default function Demo() {
  const [selectedProduct, setSelectedProduct] = useState<typeof SAMPLE_PRODUCTS[0] | null>(null);

  if (selectedProduct) {
    return (
      <DesignStudio
        embedMode
        sessionId={`demo-${selectedProduct.id}`}
        embedProductData={selectedProduct}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container flex h-14 items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-lg font-bold">Demo — Choose a Product</h1>
        </div>
      </header>

      <div className="container py-12">
        <p className="text-muted-foreground mb-8 max-w-lg">
          Pick a sample product below to open the customizer. This uses built-in data — no API session needed.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {SAMPLE_PRODUCTS.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedProduct(p)}
              className="group rounded-xl border bg-card overflow-hidden text-left transition-all hover:shadow-lg hover:border-primary/40"
            >
              <div className="aspect-square overflow-hidden bg-muted">
                <img
                  src={p.image_front}
                  alt={p.name}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              </div>
              <div className="p-4 space-y-1">
                <h3 className="font-semibold">{p.name}</h3>
                <p className="text-sm text-muted-foreground">{p.category}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
