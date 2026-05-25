import {
  Image as ImageIcon,
  Sparkles,
  LayoutGrid,
  ShoppingBag,
  Quote,
  Megaphone,
  Type,
  Columns2,
  Columns3,
  Grid3x3,
  Box,
  type LucideIcon,
} from "lucide-react";

export type BlockMeta = {
  label: string;
  description: string;
  icon: LucideIcon;
  summary?: (data: any) => string | undefined;
};

const firstText = (...vals: any[]) =>
  vals.find((v) => typeof v === "string" && v.trim().length > 0) as string | undefined;

export const BLOCK_META: Record<string, BlockMeta> = {
  hero: {
    label: "Hero",
    description: "Top-of-page banner with headline and call-to-action.",
    icon: ImageIcon,
    summary: (d) => firstText(d?.headline, d?.eyebrow),
  },
  value_props: {
    label: "Value props",
    description: "Short list of benefits or selling points.",
    icon: Sparkles,
    summary: (d) =>
      firstText(d?.heading) ??
      (Array.isArray(d?.items) ? `${d.items.length} item${d.items.length === 1 ? "" : "s"}` : undefined),
  },
  featured_categories: {
    label: "Featured categories",
    description: "Grid of curated storefront categories.",
    icon: LayoutGrid,
    summary: (d) =>
      firstText(d?.heading) ??
      (Array.isArray(d?.category_slugs)
        ? `${d.category_slugs.length} categor${d.category_slugs.length === 1 ? "y" : "ies"}`
        : undefined),
  },
  featured_products: {
    label: "Featured products",
    description: "Hand-picked products from this store.",
    icon: ShoppingBag,
    summary: (d) =>
      firstText(d?.heading) ??
      (Array.isArray(d?.store_product_ids)
        ? `${d.store_product_ids.length} product${d.store_product_ids.length === 1 ? "" : "s"}`
        : undefined),
  },
  testimonials: {
    label: "Testimonials",
    description: "Customer quotes and social proof.",
    icon: Quote,
    summary: (d) =>
      firstText(d?.heading) ??
      (Array.isArray(d?.items) ? `${d.items.length} quote${d.items.length === 1 ? "" : "s"}` : undefined),
  },
  cta_banner: {
    label: "CTA banner",
    description: "Full-width call-to-action band.",
    icon: Megaphone,
    summary: (d) => firstText(d?.headline, d?.body),
  },
  rich_text: {
    label: "Rich text",
    description: "Free-form text block (markdown supported).",
    icon: Type,
    summary: (d) => firstText(d?.heading, d?.body)?.slice(0, 80),
  },
  category_bento: {
    label: "Category bento",
    description: "Asymmetric category showcase grid.",
    icon: LayoutGrid,
    summary: (d) => firstText(d?.heading),
  },
  two_column_banners: {
    label: "Two-column banners",
    description: "Two side-by-side promotional banners.",
    icon: Columns2,
    summary: (d) => firstText(d?.heading),
  },
  three_column_banners: {
    label: "Three-column banners",
    description: "Three promotional banners in a row.",
    icon: Columns3,
    summary: (d) => firstText(d?.heading),
  },
  benefits_grid: {
    label: "Benefits grid",
    description: "Grid of icons highlighting benefits.",
    icon: Grid3x3,
    summary: (d) =>
      firstText(d?.heading) ??
      (Array.isArray(d?.items) ? `${d.items.length} benefit${d.items.length === 1 ? "" : "s"}` : undefined),
  },
};

export function metaFor(type: string): BlockMeta {
  return (
    BLOCK_META[type] ?? {
      label: type.replace(/_/g, " "),
      description: "Custom block.",
      icon: Box,
    }
  );
}
