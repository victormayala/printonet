import { useParams, useSearchParams } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import DesignStudio from "./DesignStudio";
import { type BrandConfig, DEFAULT_BRAND_CONFIG, BrandConfigContext, applyBrandCSS } from "@/lib/brand-config";

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
  const [searchParams] = useSearchParams();
  const [productData, setProductData] = useState<SessionProductData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Parse brand config from URL params
  const brandConfig = useMemo<BrandConfig>(() => {
    const theme = searchParams.get("brandTheme");
    const primary = searchParams.get("brandPrimary");
    const accent = searchParams.get("brandAccent");
    const font = searchParams.get("brandFont");
    const radius = searchParams.get("brandRadius");
    const name = searchParams.get("brandName");
    const logoUrl = searchParams.get("brandLogo");

    return {
      name: name || DEFAULT_BRAND_CONFIG.name,
      logoUrl: logoUrl || DEFAULT_BRAND_CONFIG.logoUrl,
      theme: (theme === "light" || theme === "dark") ? theme : DEFAULT_BRAND_CONFIG.theme,
      primaryColor: primary || DEFAULT_BRAND_CONFIG.primaryColor,
      accentColor: accent || DEFAULT_BRAND_CONFIG.accentColor,
      fontFamily: font || DEFAULT_BRAND_CONFIG.fontFamily,
      borderRadius: radius ? parseInt(radius, 10) : DEFAULT_BRAND_CONFIG.borderRadius,
    };
  }, [searchParams]);

  // Apply brand CSS vars to document root when in embed mode
  useEffect(() => {
    applyBrandCSS(document.documentElement, brandConfig);
  }, [brandConfig]);

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
    <BrandConfigContext.Provider value={brandConfig}>
      <DesignStudio
        embedMode
        sessionId={sessionId}
        embedProductData={productData}
        brandConfig={brandConfig}
      />
    </BrandConfigContext.Provider>
  );
}
