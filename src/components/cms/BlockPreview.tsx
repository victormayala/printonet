/**
 * Lightweight, schematic previews of homepage blocks. Not pixel-perfect to the
 * storefront — meant to give the editor an at-a-glance idea of layout and
 * content as they edit drafts.
 */
import { createContext, useContext } from "react";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const BaseUrlContext = createContext<string | undefined>(undefined);


/**
 * Resolves possibly-relative image URLs (like "/defaults/banner-hero.jpg")
 * against the storefront origin so they load from the dashboard.
 */
function resolveUrl(src: string | undefined, baseUrl?: string): string | undefined {
  if (!src) return undefined;
  const trimmed = src.trim();
  if (!trimmed) return undefined;
  if (/^(https?:|data:|blob:)/i.test(trimmed)) return trimmed;
  if (!baseUrl) return trimmed; // best-effort
  try {
    return new URL(trimmed, baseUrl.replace(/\/+$/, "") + "/").toString();
  } catch {
    return trimmed;
  }
}

function Img({
  src,
  alt,
  className,
}: {
  src?: string;
  alt?: string;
  className?: string;
}) {
  const baseUrl = useContext(BaseUrlContext);
  const resolved = resolveUrl(src, baseUrl);
  if (!resolved) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted text-muted-foreground/60",
          className,
        )}
      >
        <ImageIcon className="h-6 w-6" />
      </div>
    );
  }
  return (
    <img
      src={resolved}
      alt={alt ?? ""}
      className={cn("object-cover", className)}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
      }}
    />
  );
}



function FauxBtn({ label, variant = "primary" }: { label?: string; variant?: "primary" | "ghost" }) {
  if (!label) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2.5 py-1 text-[10px] font-medium",
        variant === "primary"
          ? "bg-foreground text-background"
          : "border border-foreground/40 text-foreground",
      )}
    >
      {label}
    </span>
  );
}

function HeroPreview({ d }: { d: any }) {
  const align = d?.alignment === "center" ? "items-center text-center" : "items-start text-left";
  return (
    <div className="relative overflow-hidden rounded-md border bg-muted/40">
      <Img src={d?.image_url} className="absolute inset-0 h-full w-full opacity-70" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-background/40 to-transparent" />
      <div className={cn("relative flex flex-col gap-1.5 p-4 min-h-[140px] justify-center", align)}>
        {d?.eyebrow && (
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{d.eyebrow}</p>
        )}
        <h3 className="text-base font-bold leading-tight">{d?.headline || "Headline"}</h3>
        {d?.subhead && <p className="text-xs text-muted-foreground line-clamp-2">{d.subhead}</p>}
        <div className="flex gap-2 mt-1">
          <FauxBtn label={d?.cta_label} />
          <FauxBtn label={d?.secondary_cta_label} variant="ghost" />
        </div>
      </div>
    </div>
  );
}

function ValuePropsPreview({ d }: { d: any }) {
  const items = Array.isArray(d?.items) ? d.items.slice(0, 4) : [];
  return (
    <div className="rounded-md border bg-card p-3 space-y-2">
      {d?.heading && <p className="text-xs font-semibold text-center">{d.heading}</p>}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {items.map((it: any, i: number) => (
          <div key={i} className="flex flex-col items-center text-center gap-1 p-2 rounded bg-muted/40">
            <div className="h-6 w-6 rounded-full bg-foreground/10 flex items-center justify-center text-[10px]">
              {it?.icon ? "✦" : "•"}
            </div>
            <p className="text-[10px] font-medium leading-tight">{it?.title || "Title"}</p>
            <p className="text-[9px] text-muted-foreground line-clamp-2">{it?.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function FeaturedListPreview({ d, label }: { d: any; label: string }) {
  const items: any[] =
    (Array.isArray(d?.category_slugs) && d.category_slugs) ||
    (Array.isArray(d?.store_product_ids) && d.store_product_ids) ||
    [];
  const tiles = items.slice(0, 6);
  return (
    <div className="rounded-md border bg-card p-3 space-y-2">
      {d?.heading && <p className="text-xs font-semibold">{d.heading}</p>}
      {d?.subheading && <p className="text-[10px] text-muted-foreground">{d.subheading}</p>}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {(tiles.length ? tiles : [0, 1, 2, 3, 4, 5]).map((it, i) => (
          <div key={i} className="aspect-square rounded bg-muted flex items-center justify-center text-[9px] text-muted-foreground truncate px-1">
            {typeof it === "string" ? it : label}
          </div>
        ))}
      </div>
    </div>
  );
}

function TestimonialsPreview({ d }: { d: any }) {
  const items = Array.isArray(d?.items) ? d.items.slice(0, 3) : [];
  return (
    <div className="rounded-md border bg-card p-3 space-y-2">
      {d?.heading && <p className="text-xs font-semibold text-center">{d.heading}</p>}
      <div className="grid sm:grid-cols-3 gap-2">
        {items.map((it: any, i: number) => (
          <div key={i} className="rounded border bg-muted/30 p-2 space-y-1">
            <p className="text-[10px] italic line-clamp-3">"{it?.quote || "Great product!"}"</p>
            <div className="flex items-center gap-1.5">
              <div className="h-4 w-4 rounded-full bg-muted overflow-hidden">
                {it?.avatar_url && <Img src={it.avatar_url} className="h-full w-full" />}
              </div>

              <div>
                <p className="text-[9px] font-medium">{it?.author || "Author"}</p>
                {it?.role && <p className="text-[8px] text-muted-foreground">{it.role}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CtaBannerPreview({ d }: { d: any }) {
  return (
    <div className="relative overflow-hidden rounded-md border bg-foreground text-background">
      <Img src={d?.background_image_url} className="absolute inset-0 h-full w-full opacity-40" />
      <div className="relative flex flex-col sm:flex-row items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <h4 className="text-sm font-bold leading-tight">{d?.headline || "Call to action"}</h4>
          {d?.body && <p className="text-[10px] opacity-80 line-clamp-2">{d.body}</p>}
        </div>
        {d?.cta_label && (
          <span className="inline-flex items-center rounded bg-background text-foreground px-3 py-1 text-[10px] font-medium">
            {d.cta_label}
          </span>
        )}
      </div>
    </div>
  );
}

function RichTextPreview({ d }: { d: any }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <pre className="text-[10px] whitespace-pre-wrap text-muted-foreground line-clamp-6 font-sans">
        {d?.markdown || "Your text will appear here…"}
      </pre>
    </div>
  );
}

function CategoryBentoPreview({ d }: { d: any }) {
  const items = Array.isArray(d?.items) ? d.items.slice(0, 6) : [];
  return (
    <div className="rounded-md border bg-card p-3 space-y-2">
      {d?.eyebrow && <p className="text-[10px] uppercase text-muted-foreground">{d.eyebrow}</p>}
      {d?.heading && <p className="text-xs font-semibold">{d.heading}</p>}
      <div className="grid grid-cols-4 grid-rows-2 gap-1.5 h-32">
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const it = items[i];
          return (
            <div
              key={i}
              className={cn(
                "relative overflow-hidden rounded bg-muted flex items-end p-1",
                i === 0 && "col-span-2 row-span-2",
              )}
            >
              {it?.image_url && (
                <Img src={it.image_url} className="absolute inset-0 h-full w-full" />
              )}

              {it?.label && (
                <span className="relative text-[9px] font-medium text-background bg-foreground/60 px-1 rounded">
                  {it.label}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ColumnsBannerPreview({ d, cols }: { d: any; cols: 2 | 3 }) {
  const items = Array.isArray(d?.items) ? d.items.slice(0, cols) : [];
  const placeholders = Array.from({ length: cols }, (_, i) => items[i]);
  return (
    <div className={cn("grid gap-2", cols === 2 ? "grid-cols-2" : "grid-cols-3")}>
      {placeholders.map((it, i) => (
        <div key={i} className="relative overflow-hidden rounded-md border bg-muted/40 aspect-[4/3]">
          <Img src={it?.image_url} className="absolute inset-0 h-full w-full" />
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-end p-2 text-background">
            {it?.eyebrow && <p className="text-[9px] uppercase opacity-80">{it.eyebrow}</p>}
            <p className="text-[11px] font-semibold leading-tight line-clamp-1">{it?.title || "Title"}</p>
            {it?.body && <p className="text-[9px] opacity-80 line-clamp-2">{it.body}</p>}
            {it?.cta_label && <FauxBtn label={it.cta_label} />}
          </div>
        </div>
      ))}
    </div>
  );
}

function BenefitsGridPreview({ d }: { d: any }) {
  const items = Array.isArray(d?.items) ? d.items.slice(0, 4) : [];
  return (
    <div className="rounded-md border bg-card p-3 space-y-2">
      {d?.eyebrow && <p className="text-[10px] uppercase text-muted-foreground">{d.eyebrow}</p>}
      {d?.heading && <p className="text-xs font-semibold">{d.heading}</p>}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {(items.length ? items : [0, 1, 2, 3]).map((it: any, i: number) => (
          <div key={i} className="rounded border bg-muted/30 p-2 space-y-1">
            {it?.eyebrow && <p className="text-[8px] uppercase text-muted-foreground">{it.eyebrow}</p>}
            <p className="text-[10px] font-semibold leading-tight">{it?.title || "Benefit"}</p>
            <p className="text-[9px] text-muted-foreground line-clamp-2">{it?.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function BlockPreviewInner({ type, data }: { type: string; data: any }) {
  switch (type) {
    case "hero":
      return <HeroPreview d={data} />;
    case "value_props":
      return <ValuePropsPreview d={data} />;
    case "featured_categories":
      return <FeaturedListPreview d={data} label="Category" />;
    case "featured_products":
      return <FeaturedListPreview d={data} label="Product" />;
    case "testimonials":
      return <TestimonialsPreview d={data} />;
    case "cta_banner":
      return <CtaBannerPreview d={data} />;
    case "rich_text":
      return <RichTextPreview d={data} />;
    case "category_bento":
      return <CategoryBentoPreview d={data} />;
    case "two_column_banners":
      return <ColumnsBannerPreview d={data} cols={2} />;
    case "three_column_banners":
      return <ColumnsBannerPreview d={data} cols={3} />;
    case "benefits_grid":
      return <BenefitsGridPreview d={data} />;
    default:
      return (
        <div className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
          No preview available for this block type.
        </div>
      );
  }
}
