import { useParams, useSearchParams } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import DesignStudio from "./DesignStudio";
import {
  type BrandConfig,
  DEFAULT_BRAND_CONFIG,
  BrandConfigContext,
  applyBrandCSS,
  normalizeHexColor,
} from "@/lib/brand-config";

interface SessionProductData {
  name: string;
  category?: string;
  description?: string;
  image_front?: string;
  image_back?: string;
  image_side1?: string;
  image_side2?: string;
  variants?: Array<{ color: string; colorName: string; hex: string; image?: string; gallery?: string[]; sizes?: Array<{ size: string; price: number; qty?: number; sku?: string }> }>;
  /** WooCommerce variable selection captured on the PDP (stored with session product_data). */
  wc_attributes?: Record<string, string> | null;
  wc_variation_id?: string | number | null;
}

interface SessionDesignOutput {
  sides?: Array<{ view?: string; canvasJSON?: string; productImage?: string }>;
  variant?: {
    color?: string;
    colorName?: string;
    hex?: string;
    image?: string;
    gallery?: string[];
    sizes?: Array<{ size: string; price: number; qty?: number; sku?: string }>;
  } | null;
}

async function fetchLatestBrandConfig(userId: string) {
  const { data } = await supabase
    .from("brand_configs")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export default function EmbedCustomizer() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const allowCompleted = searchParams.get("allowCompleted") === "1";
  const [productData, setProductData] = useState<SessionProductData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvedBrand, setResolvedBrand] = useState<BrandConfig | null>(null);
  const [initialDesignOutput, setInitialDesignOutput] = useState<SessionDesignOutput | null>(null);
  /** When set, iframe URL brand query params are ignored so storefront branding stays authoritative */
  const [sessionUsesStore, setSessionUsesStore] = useState(false);

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
      theme: theme === "light" || theme === "dark" ? theme : DEFAULT_BRAND_CONFIG.theme,
      primaryColor: normalizeHexColor(primary, DEFAULT_BRAND_CONFIG.primaryColor),
      accentColor: normalizeHexColor(accent, DEFAULT_BRAND_CONFIG.accentColor),
      fontFamily: font || DEFAULT_BRAND_CONFIG.fontFamily,
      borderRadius: radius ? parseInt(radius, 10) : DEFAULT_BRAND_CONFIG.borderRadius,
    };
  }, [searchParams]);

  const effectiveBrand = useMemo(() => {
    if (sessionUsesStore) {
      return resolvedBrand || DEFAULT_BRAND_CONFIG;
    }
    return urlBrandConfig || resolvedBrand || DEFAULT_BRAND_CONFIG;
  }, [sessionUsesStore, resolvedBrand, urlBrandConfig]);

  /** Merge PDP attributes from iframe URL (SDK always appends) over session product_data. */
  const mergedEmbedProduct = useMemo((): SessionProductData | null => {
    if (!productData) return null;
    const raw = searchParams.get("wcAttributes");
    let fromUrl: Record<string, string> | null = null;
    if (raw) {
      try {
        fromUrl = JSON.parse(decodeURIComponent(raw)) as Record<string, string>;
      } catch {
        try {
          fromUrl = JSON.parse(raw) as Record<string, string>;
        } catch {
          fromUrl = null;
        }
      }
    }
    if (!fromUrl || typeof fromUrl !== "object") return productData;
    const sessionWc = productData.wc_attributes;
    return {
      ...productData,
      wc_attributes: {
        ...(sessionWc && typeof sessionWc === "object" ? sessionWc : {}),
        ...fromUrl,
      },
    };
  }, [productData, searchParams]);

  useEffect(() => {
    applyBrandCSS(document.documentElement, effectiveBrand);
  }, [effectiveBrand]);

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;

    supabase
      .from("customizer_sessions")
      .select("*")
      .eq("id", sessionId)
      .single()
      .then(async ({ data, error: err }) => {
        if (cancelled) return;
        if (err || !data) {
          setError("Session not found or expired.");
          setLoading(false);
          return;
        }
        if (data.status === "completed" && !allowCompleted) {
          setError("This session has already been completed.");
          setLoading(false);
          return;
        }

        const pd = data.product_data as unknown as SessionProductData;
        setProductData(pd);
        setInitialDesignOutput((data.design_output as SessionDesignOutput | null) || null);

        const userId = (data as { user_id?: string | null }).user_id ?? null;
        const storeId = (data as { store_id?: string | null }).store_id ?? null;

        let brand: BrandConfig | null = null;
        setSessionUsesStore(false);

        if (storeId) {
          setSessionUsesStore(true);
          const { data: storeData } = await supabase
            .from("corporate_stores")
            .select("name,logo_url,customizer_logo_dark_url,primary_color,accent_color,font_family,customizer_theme,customizer_border_radius,user_id")
            .eq("id", storeId)
            .maybeSingle();

          if (storeData) {
            const prefs = storeData.user_id ? await fetchLatestBrandConfig(storeData.user_id) : null;
            const sd = storeData as any;
            const storeTheme: "light" | "dark" | undefined =
              sd.customizer_theme === "light" || sd.customizer_theme === "dark" ? sd.customizer_theme : undefined;
            brand = {
              name: storeData.name || DEFAULT_BRAND_CONFIG.name,
              logoUrl: storeData.logo_url?.trim() || DEFAULT_BRAND_CONFIG.logoUrl,
              logoDarkUrl: sd.customizer_logo_dark_url?.trim() || DEFAULT_BRAND_CONFIG.logoDarkUrl,
              theme:
                storeTheme
                ?? (prefs?.theme === "light" || prefs?.theme === "dark" ? prefs.theme : DEFAULT_BRAND_CONFIG.theme),
              primaryColor: normalizeHexColor(storeData.primary_color, DEFAULT_BRAND_CONFIG.primaryColor),
              accentColor: normalizeHexColor(storeData.accent_color, DEFAULT_BRAND_CONFIG.accentColor),
              fontFamily: storeData.font_family?.trim() || DEFAULT_BRAND_CONFIG.fontFamily,
              borderRadius:
                typeof sd.customizer_border_radius === "number"
                  ? sd.customizer_border_radius
                  : (typeof prefs?.border_radius === "number" ? prefs.border_radius : DEFAULT_BRAND_CONFIG.borderRadius),
            };
          }
        } else if (userId && !searchParams.get("brandPrimary") && !searchParams.get("brandTheme")) {
          const brandData = await fetchLatestBrandConfig(userId);
          if (brandData) {
            brand = {
              name: brandData.name || DEFAULT_BRAND_CONFIG.name,
              logoUrl: brandData.logo_url || DEFAULT_BRAND_CONFIG.logoUrl,
              logoDarkUrl: (brandData as any).logo_dark_url || DEFAULT_BRAND_CONFIG.logoDarkUrl,
              theme: brandData.theme === "light" || brandData.theme === "dark" ? brandData.theme : DEFAULT_BRAND_CONFIG.theme,
              primaryColor: normalizeHexColor(brandData.primary_color, DEFAULT_BRAND_CONFIG.primaryColor),
              accentColor: normalizeHexColor(brandData.accent_color, DEFAULT_BRAND_CONFIG.accentColor),
              fontFamily: brandData.font_family || DEFAULT_BRAND_CONFIG.fontFamily,
              borderRadius: brandData.border_radius ?? DEFAULT_BRAND_CONFIG.borderRadius,
            };
          }
        }

        if (!cancelled) {
          setResolvedBrand(brand);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId, searchParams, allowCompleted]);

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
        embedProductData={mergedEmbedProduct!}
        brandConfig={effectiveBrand}
        initialDesignOutput={initialDesignOutput as any}
      />
    </BrandConfigContext.Provider>
  );
}
