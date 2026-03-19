export interface ProductVariant {
  color: string;
  colorName: string;
  hex: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  description: string;
  basePrice: number;
  variants: ProductVariant[];
  hasFrontBack: boolean;
  icon: string;
}

export const products: Product[] = [
  {
    id: "classic-tee",
    name: "Classic T-Shirt",
    category: "T-Shirts",
    description: "Premium cotton crew neck tee. Perfect canvas for your designs.",
    basePrice: 24.99,
    variants: [
      { color: "white", colorName: "White", hex: "#FFFFFF" },
      { color: "black", colorName: "Black", hex: "#1a1a1a" },
      { color: "navy", colorName: "Navy", hex: "#1e3a5f" },
      { color: "heather-gray", colorName: "Heather Gray", hex: "#9ca3af" },
      { color: "red", colorName: "Red", hex: "#dc2626" },
    ],
    hasFrontBack: true,
    icon: "👕",
  },
  {
    id: "premium-hoodie",
    name: "Premium Hoodie",
    category: "Hoodies",
    description: "Heavyweight fleece hoodie with kangaroo pocket.",
    basePrice: 44.99,
    variants: [
      { color: "black", colorName: "Black", hex: "#1a1a1a" },
      { color: "white", colorName: "White", hex: "#FFFFFF" },
      { color: "navy", colorName: "Navy", hex: "#1e3a5f" },
      { color: "forest", colorName: "Forest Green", hex: "#166534" },
    ],
    hasFrontBack: true,
    icon: "🧥",
  },
  {
    id: "ceramic-mug",
    name: "Ceramic Mug",
    category: "Mugs",
    description: "11oz ceramic mug with wraparound print area.",
    basePrice: 14.99,
    variants: [
      { color: "white", colorName: "White", hex: "#FFFFFF" },
      { color: "black", colorName: "Black", hex: "#1a1a1a" },
    ],
    hasFrontBack: false,
    icon: "☕",
  },
  {
    id: "phone-case",
    name: "Phone Case",
    category: "Phone Cases",
    description: "Slim protective case with edge-to-edge printing.",
    basePrice: 19.99,
    variants: [
      { color: "clear", colorName: "Clear", hex: "#e5e7eb" },
      { color: "black", colorName: "Black", hex: "#1a1a1a" },
      { color: "white", colorName: "White", hex: "#FFFFFF" },
    ],
    hasFrontBack: false,
    icon: "📱",
  },
  {
    id: "tote-bag",
    name: "Canvas Tote Bag",
    category: "Tote Bags",
    description: "Sturdy canvas tote with spacious interior.",
    basePrice: 17.99,
    variants: [
      { color: "natural", colorName: "Natural", hex: "#f5f0e8" },
      { color: "black", colorName: "Black", hex: "#1a1a1a" },
    ],
    hasFrontBack: true,
    icon: "👜",
  },
];

export const categories = [...new Set(products.map((p) => p.category))];

export function getProductById(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}
