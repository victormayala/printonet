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
  variants?: Array<{ color: string; colorName: string; hex: string; image?: string; sizes?: Array<{ size: string; price: number; qty?: number; sku?: string }> }>;
}

export default function EmbedCustomizer() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const [productData, setProductData] = useState<SessionProductData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dbBrandConfig, setDbBrandConfig] = useState<BrandConfig | null>(null);

  // Parse brand config from URL params
  const urlBrandConfig = useMemo<BrandConfig | null>(() => {
    const theme = searchParams.get("brandTheme");
    const primary = searchParams.get("brandPrimary");
    const accent = searchParams.get("brandAccent");
    const font = searchParams.get("brandFont");
    const radius = searchParams.get("brandRadius");
    const name = searchParams.get("brandName");
    const logoUrl = searchParams.get("brandLogo");

    if (!theme && !primary && !accent && !font && !radius && !name && !logoUrl) {
      return null;
    }

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

  // Effective brand: URL params > DB config > defaults
  const effectiveBrand = urlBrandConfig || dbBrandConfig || DEFAULT_BRAND_CONFIG;

  // Apply brand CSS vars to document root when in embed mode
  useEffect(() => {
    applyBrandCSS(document.documentElement, effectiveBrand);
  }, [effectiveBrand]);

  // Fetch session and brand config from DB

  useEffect(() => {
    if (!sessionId) return;

    supabase
      .from("customizer_sessions")
      .select("*")
      .eq("id", sessionId)
      .single()
      .then(async ({ data, error: err }) => {
        console.log("[EmbedCustomizer] Session fetch result:", { data: !!data, error: err, sessionId });
        if (err || !data) {
          console.error("[EmbedCustomizer] Session error:", err);
          setError("Session not found or expired.");
        } else if (data.status === "completed") {
          setError("This session has already been completed.");
        } else {
          const pd = data.product_data as unknown as SessionProductData;
          console.log("[EmbedCustomizer] Product data:", pd);
          setProductData(pd);

          // Fetch brand config if session has a user_id and no URL brand params
          const userId = (data as any).user_id;
          if (userId && !searchParams.get("brandPrimary") && !searchParams.get("brandTheme")) {
            const { data: brandData } = await supabase
              .from("brand_configs")
              .select("*")
              .eq("user_id", userId)
              .order("updated_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (brandData) {
              setDbBrandConfig({
                name: brandData.name || DEFAULT_BRAND_CONFIG.name,
                logoUrl: brandData.logo_url || DEFAULT_BRAND_CONFIG.logoUrl,
                theme: (brandData.theme === "light" || brandData.theme === "dark") ? brandData.theme : DEFAULT_BRAND_CONFIG.theme,
                primaryColor: brandData.primary_color || DEFAULT_BRAND_CONFIG.primaryColor,
                accentColor: brandData.accent_color || DEFAULT_BRAND_CONFIG.accentColor,
                fontFamily: brandData.font_family || DEFAULT_BRAND_CONFIG.fontFamily,
                borderRadius: brandData.border_radius ?? DEFAULT_BRAND_CONFIG.borderRadius,
              });
            }
          }
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
    <BrandConfigContext.Provider value={effectiveBrand}>
      <DesignStudio
        embedMode
        sessionId={sessionId}
        embedProductData={productData}
        brandConfig={effectiveBrand}
      />
    </BrandConfigContext.Provider>
  );
}
