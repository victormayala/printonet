import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DesignStudio from "./DesignStudio";

interface SessionProductData {
  name: string;
  category?: string;
  description?: string;
  image_front?: string;
  image_back?: string;
  image_side1?: string;
  image_side2?: string;
  variants?: Array<{ color: string; colorName: string; hex: string }>;
}

export default function EmbedCustomizer() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [productData, setProductData] = useState<SessionProductData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    supabase
      .from("customizer_sessions")
      .select("*")
      .eq("id", sessionId)
      .single()
      .then(({ data, error: err }) => {
        if (err || !data) {
          setError("Session not found or expired.");
        } else if (data.status === "completed") {
          setError("This session has already been completed.");
        } else {
          setProductData(data.product_data as unknown as SessionProductData);
        }
        setLoading(false);
      });
  }, [sessionId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--editor-bg))] text-sidebar-foreground">
        <p>Loading customizer...</p>
      </div>
    );
  }

  if (error || !productData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--editor-bg))] text-sidebar-foreground">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold">{error || "Something went wrong"}</h2>
          <p className="text-sm text-muted-foreground">Please contact the store for a new customization link.</p>
        </div>
      </div>
    );
  }

  return (
    <DesignStudio
      embedMode
      sessionId={sessionId}
      embedProductData={productData}
    />
  );
}
