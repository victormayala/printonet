import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DesignStudio from "./DesignStudio";

export default function ProductPreview() {
  const { productId } = useParams<{ productId: string }>();
  const [productData, setProductData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!productId) return;
    supabase
      .from("inventory_products")
      .select("*")
      .eq("id", productId)
      .single()
      .then(({ data, error: err }) => {
        if (err || !data) {
          setError("Product not found.");
        } else {
          setProductData(data);
        }
        setLoading(false);
      });
  }, [productId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <p>Loading product preview...</p>
      </div>
    );
  }

  if (error || !productData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <p>{error || "Product not found."}</p>
      </div>
    );
  }

  return (
    <DesignStudio
      embedMode
      sessionId={`preview-${productId}`}
      embedProductData={{
        name: productData.name,
        category: productData.category,
        description: productData.description,
        image_front: productData.image_front,
        image_back: productData.image_back,
        image_side1: productData.image_side1,
        image_side2: productData.image_side2,
        print_areas: productData.print_areas,
        variants: productData.variants,
      }}
    />
  );
}
