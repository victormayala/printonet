import { createContext, useContext } from "react";

export interface BrandConfig {
  /** Display name shown in the toolbar */
  name?: string;
  /** Logo URL shown in the toolbar (used for light theme, fallback for dark) */
  logoUrl?: string;
  /** Optional dark-theme logo URL (light-on-dark variant) */
  logoDarkUrl?: string;
  /** Light or dark theme */
  theme: "light" | "dark";
  /** Primary brand color (hex) */
  primaryColor: string;
  /** Accent color for highlights (hex) */
  accentColor: string;
  /** Font family for display/headings */
  fontFamily: string;
  /** Border radius in px */
  borderRadius: number;
}

export const DEFAULT_BRAND_CONFIG: BrandConfig = {
  name: "",
  logoUrl: "",
  logoDarkUrl: "",
  theme: "dark",
  primaryColor: "#7c3aed",
  accentColor: "#e0459b",
  fontFamily: "Inter",
  borderRadius: 12,
};

/** Pick the right logo URL given the active theme */
export function activeBrandLogo(config: BrandConfig): string {
  if (config.theme === "dark" && config.logoDarkUrl) return config.logoDarkUrl;
  return config.logoUrl || "";
}

/** Ensure hex is #RRGGBB for CSS var generation */
export function normalizeHexColor(hex: string | null | undefined, fallback: string): string {
  if (!hex || typeof hex !== "string") return fallback;
  let h = hex.trim();
  if (!h.startsWith("#")) h = `#${h}`;
  if (/^#[0-9a-fA-F]{6}$/.test(h)) return h.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(h)) {
    return `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`.toLowerCase();
  }
  return fallback;
}

export const BrandConfigContext = createContext<BrandConfig>(DEFAULT_BRAND_CONFIG);

export function useBrandConfig() {
  return useContext(BrandConfigContext);
}

/** Convert hex color to HSL string for CSS variables (e.g. "262 83% 58%") */
export function hexToHSL(hex: string): string {
  let r = 0, g = 0, b = 0;
  hex = hex.replace("#", "");
  if (hex.length === 3) {
    r = parseInt(hex[0] + hex[0], 16);
    g = parseInt(hex[1] + hex[1], 16);
    b = parseInt(hex[2] + hex[2], 16);
  } else {
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
  }
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** Generate CSS custom properties from a BrandConfig */
export function brandConfigToCSSVars(config: BrandConfig): Record<string, string> {
  const primaryHSL = hexToHSL(config.primaryColor);
  const accentHSL = hexToHSL(config.accentColor);

  if (config.theme === "light") {
    return {
      "--primary": primaryHSL,
      "--primary-foreground": "0 0% 100%",
      "--accent": accentHSL,
      "--accent-foreground": "0 0% 100%",
      "--ring": primaryHSL,
      // Editor / sidebar surfaces — light mode
      "--editor-bg": "0 0% 95%",
      "--editor-surface": "0 0% 100%",
      "--editor-surface-hover": "0 0% 97%",
      "--toolbar-bg": "0 0% 98%",
      "--sidebar-background": "0 0% 98%",
      "--sidebar-foreground": "240 10% 10%",
      "--sidebar-primary": primaryHSL,
      "--sidebar-primary-foreground": "0 0% 100%",
      "--sidebar-accent": "0 0% 94%",
      "--sidebar-accent-foreground": "240 10% 10%",
      "--sidebar-border": "0 0% 88%",
      "--sidebar-ring": primaryHSL,
      "--background": "0 0% 100%",
      "--foreground": "240 10% 6%",
      "--card": "0 0% 100%",
      "--card-foreground": "240 10% 6%",
      "--muted": "0 0% 96%",
      "--muted-foreground": "240 4% 46%",
      "--border": "0 0% 90%",
      "--input": "0 0% 90%",
      "--destructive": "0 84% 60%",
      "--destructive-foreground": "0 0% 100%",
      "--radius": `${config.borderRadius / 16}rem`,
    };
  }

  // Dark theme (default)
  return {
    "--primary": primaryHSL,
    "--primary-foreground": "0 0% 100%",
    "--accent": accentHSL,
    "--accent-foreground": "0 0% 100%",
    "--ring": primaryHSL,
    "--editor-bg": "240 10% 12%",
    "--editor-surface": "240 10% 16%",
    "--editor-surface-hover": "240 10% 20%",
    "--toolbar-bg": "240 10% 10%",
    "--sidebar-background": "240 10% 8%",
    "--sidebar-foreground": "240 5% 85%",
    "--sidebar-primary": primaryHSL,
    "--sidebar-primary-foreground": "0 0% 100%",
    "--sidebar-accent": "240 8% 14%",
    "--sidebar-accent-foreground": "240 5% 90%",
    "--sidebar-border": "240 8% 18%",
    "--sidebar-ring": primaryHSL,
    "--background": "240 10% 6%",
    "--foreground": "0 0% 95%",
    "--card": "240 10% 10%",
    "--card-foreground": "0 0% 95%",
    "--muted": "240 8% 15%",
    "--muted-foreground": "240 4% 55%",
    "--border": "240 8% 18%",
    "--input": "240 8% 18%",
    "--destructive": "0 62% 30%",
    "--destructive-foreground": "0 0% 100%",
    "--radius": `${config.borderRadius / 16}rem`,
  };
}

/** Apply brand config CSS vars to an element */
export function applyBrandCSS(el: HTMLElement, config: BrandConfig) {
  const vars = brandConfigToCSSVars(config);
  Object.entries(vars).forEach(([key, value]) => {
    el.style.setProperty(key, value);
  });
}
