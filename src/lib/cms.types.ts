// Shared CMS types — safe to import from client + server.
import { z } from "zod";

// ---------- Block types ----------
export const BLOCK_TYPES = [
  "hero",
  "value_props",
  "featured_categories",
  "featured_products",
  "testimonials",
  "cta_banner",
  "rich_text",
  "category_bento",
  "two_column_banners",
  "three_column_banners",
  "benefits_grid",
] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

const url = z.string().trim().max(1000).optional().or(z.literal(""));
const shortText = z.string().trim().max(200).optional().or(z.literal(""));
const longText = z.string().trim().max(2000).optional().or(z.literal(""));

export const heroSchema = z.object({
  eyebrow: shortText,
  headline: z.string().trim().min(1).max(200),
  subhead: longText,
  image_url: url,
  cta_label: shortText,
  cta_href: url,
  secondary_cta_label: shortText,
  secondary_cta_href: url,
  alignment: z.enum(["left", "center"]).default("left"),
});
export type HeroData = z.infer<typeof heroSchema>;

export const valuePropsSchema = z.object({
  heading: shortText,
  items: z
    .array(
      z.object({
        icon: z.string().trim().max(40).optional().or(z.literal("")),
        title: z.string().trim().min(1).max(80),
        body: z.string().trim().max(300),
      }),
    )
    .min(1)
    .max(6),
});

export const featuredCategoriesSchema = z.object({
  heading: shortText,
  subheading: longText,
  category_slugs: z.array(z.string().trim().min(1).max(80)).min(1).max(12),
});

export const featuredProductsSchema = z.object({
  heading: shortText,
  subheading: longText,
  store_product_ids: z.array(z.string().trim().min(1).max(80)).min(1).max(12),
});

export const testimonialsSchema = z.object({
  heading: shortText,
  items: z
    .array(
      z.object({
        quote: z.string().trim().min(1).max(500),
        author: z.string().trim().min(1).max(80),
        role: z.string().trim().max(80).optional().or(z.literal("")),
        avatar_url: url,
      }),
    )
    .min(1)
    .max(8),
});

export const ctaBannerSchema = z.object({
  headline: z.string().trim().min(1).max(200),
  body: longText,
  cta_label: z.string().trim().min(1).max(60),
  cta_href: z.string().trim().min(1).max(1000),
  background_image_url: url,
});

export const richTextSchema = z.object({
  markdown: z.string().min(1).max(50_000),
});

// Bento grid of category tiles — mirrors the static PopularCategories
// (6 tiles, first spans 2x2). Stored as a list; renderer applies the
// hero-tile span to the first item.
export const categoryBentoSchema = z.object({
  eyebrow: shortText,
  heading: shortText,
  items: z
    .array(
      z.object({
        image_url: url,
        label: z.string().trim().min(1).max(80),
        sublabel: z.string().trim().max(80).optional().or(z.literal("")),
        href: z.string().trim().max(1000).optional().or(z.literal("")),
      }),
    )
    .min(1)
    .max(6),
});

// Side-by-side promo banners (exactly 2 columns).
export const twoColumnBannersSchema = z.object({
  items: z
    .array(
      z.object({
        image_url: url,
        eyebrow: shortText,
        title: z.string().trim().min(1).max(120),
        body: z.string().trim().max(300).optional().or(z.literal("")),
        cta_label: z.string().trim().max(60).optional().or(z.literal("")),
        cta_href: z.string().trim().max(1000).optional().or(z.literal("")),
      }),
    )
    .min(1)
    .max(2),
});

// Side-by-side promo banners (exactly 3 columns).
export const threeColumnBannersSchema = z.object({
  items: z
    .array(
      z.object({
        image_url: url,
        eyebrow: shortText,
        title: z.string().trim().min(1).max(120),
        body: z.string().trim().max(300).optional().or(z.literal("")),
      }),
    )
    .min(1)
    .max(3),
});

// Benefits / "why shop with us" grid (up to 4 cards).
export const benefitsGridSchema = z.object({
  eyebrow: shortText,
  heading: shortText,
  items: z
    .array(
      z.object({
        eyebrow: z.string().trim().max(40).optional().or(z.literal("")),
        title: z.string().trim().min(1).max(80),
        body: z.string().trim().max(300),
        accent_color: z.string().trim().max(20).optional().or(z.literal("")),
      }),
    )
    .min(1)
    .max(4),
});

export const blockDataSchemaByType: Record<BlockType, z.ZodTypeAny> = {
  hero: heroSchema,
  value_props: valuePropsSchema,
  featured_categories: featuredCategoriesSchema,
  featured_products: featuredProductsSchema,
  testimonials: testimonialsSchema,
  cta_banner: ctaBannerSchema,
  rich_text: richTextSchema,
  category_bento: categoryBentoSchema,
  two_column_banners: twoColumnBannersSchema,
  three_column_banners: threeColumnBannersSchema,
  benefits_grid: benefitsGridSchema,
};

// ---------- Site settings ----------
export const siteSettingsSchema = z.object({
  announcement_text: z.string().trim().max(160).optional().or(z.literal("")),
  announcement_href: z.string().trim().max(1000).optional().or(z.literal("")),
  announcement_enabled: z.boolean().default(false),
  footer_about: z.string().trim().max(500).optional().or(z.literal("")),
  footer_columns: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(60),
        links: z
          .array(
            z.object({
              label: z.string().trim().min(1).max(60),
              href: z.string().trim().min(1).max(1000),
            }),
          )
          .max(10),
      }),
    )
    .max(4)
    .default([]),
  social_links: z
    .object({
      instagram: z.string().trim().max(1000).optional().or(z.literal("")),
      tiktok: z.string().trim().max(1000).optional().or(z.literal("")),
      x: z.string().trim().max(1000).optional().or(z.literal("")),
      facebook: z.string().trim().max(1000).optional().or(z.literal("")),
      youtube: z.string().trim().max(1000).optional().or(z.literal("")),
    })
    .default({}),
  contact_email: z.string().trim().max(255).optional().or(z.literal("")),
  contact_phone: z.string().trim().max(40).optional().or(z.literal("")),
  contact_address: z.string().trim().max(500).optional().or(z.literal("")),
  default_og_image_url: z.string().trim().max(1000).optional().or(z.literal("")),
});
export type SiteSettings = z.infer<typeof siteSettingsSchema>;

// ---------- Content pages ----------
export const contentPageSchema = z.object({
  title: z.string().trim().min(1).max(160),
  body_md: z.string().max(100_000).default(""),
  seo_title: z.string().trim().max(160).optional().or(z.literal("")),
  seo_description: z.string().trim().max(320).optional().or(z.literal("")),
  og_image_url: z.string().trim().max(1000).optional().or(z.literal("")),
});
export type ContentPageData = z.infer<typeof contentPageSchema>;

// Slugs we do NOT allow as content page slugs (collide with existing routes).
export const RESERVED_PAGE_SLUGS = new Set([
  "admin",
  "account",
  "cart",
  "checkout",
  "contact",
  "favorites",
  "orders",
  "p",
  "privacy",
  "products",
  "returns",
  "shipping",
  "sitemap.xml",
  "terms",
  "robots.txt",
]);

export const pageSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(63)
  .regex(/^[a-z0-9][a-z0-9-]*$/, "Use lowercase letters, numbers, and dashes")
  .refine((s) => !RESERVED_PAGE_SLUGS.has(s), "That slug is reserved");

// ---------- Nav items ----------
export const navItemSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().trim().min(1).max(60),
  href: z.string().trim().min(1).max(500),
  open_in_new_tab: z.boolean().default(false),
  sort_order: z.number().int().min(0).max(999).default(0),
});
export type NavItem = z.infer<typeof navItemSchema>;

// ---------- Rows returned from DB ----------
export type JsonObject = Record<string, any>;

export type HomepageBlockRow = {
  id: string;
  sort_order: number;
  block_type: BlockType;
  enabled: boolean;
  draft_data: JsonObject;
  published_data: JsonObject | null;
  published_at: string | null;
  updated_at: string;
};

export type ContentPageRow = {
  id: string;
  slug: string;
  enabled: boolean;
  draft_data: ContentPageData;
  published_data: ContentPageData | null;
  published_at: string | null;
  updated_at: string;
};

export type SiteSettingsRow = {
  tenant_slug: string;
  draft_data: SiteSettings;
  published_data: SiteSettings | null;
  published_at: string | null;
  updated_at: string;
};

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  announcement_text: "",
  announcement_href: "",
  announcement_enabled: false,
  footer_about: "",
  footer_columns: [],
  social_links: {},
  contact_email: "",
  contact_phone: "",
  contact_address: "",
  default_og_image_url: "",
};
