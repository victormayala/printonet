import { BLOCK_TYPES, type BlockType } from "@/lib/cms.types";
import { TextField, TextareaField, AssetField, SelectField, ArrayField } from "./fields";

type Props<T = any> = {
  storeId: string;
  data: T;
  onChange: (next: T) => void;
};

function HeroEditor({ storeId, data, onChange }: Props) {
  const d = data ?? {};
  const set = (patch: any) => onChange({ ...d, ...patch });
  return (
    <div className="space-y-3">
      <TextField label="Eyebrow" value={d.eyebrow} onChange={(v) => set({ eyebrow: v })} maxLength={200} />
      <TextField label="Headline *" value={d.headline} onChange={(v) => set({ headline: v })} maxLength={200} />
      <TextareaField label="Subhead" value={d.subhead} onChange={(v) => set({ subhead: v })} maxLength={2000} />
      <AssetField label="Background image" storeId={storeId} value={d.image_url} onChange={(v) => set({ image_url: v })} />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="CTA label" value={d.cta_label} onChange={(v) => set({ cta_label: v })} />
        <TextField label="CTA link" value={d.cta_href} onChange={(v) => set({ cta_href: v })} />
        <TextField label="Secondary CTA label" value={d.secondary_cta_label} onChange={(v) => set({ secondary_cta_label: v })} />
        <TextField label="Secondary CTA link" value={d.secondary_cta_href} onChange={(v) => set({ secondary_cta_href: v })} />
      </div>
      <SelectField
        label="Alignment"
        value={(d.alignment ?? "left") as "left" | "center"}
        onChange={(v) => set({ alignment: v })}
        options={[
          { label: "Left", value: "left" },
          { label: "Center", value: "center" },
        ]}
      />
    </div>
  );
}

function ValuePropsEditor({ data, onChange }: Props) {
  const d = data ?? {};
  return (
    <div className="space-y-3">
      <TextField label="Heading" value={d.heading} onChange={(v) => onChange({ ...d, heading: v })} />
      <ArrayField
        label="Items"
        min={1}
        max={6}
        items={d.items ?? []}
        onChange={(items) => onChange({ ...d, items })}
        newItem={() => ({ icon: "", title: "", body: "" })}
        itemTitle={(it: any) => it.title || "Untitled"}
        render={(it: any, up) => (
          <>
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Icon name" value={it.icon} onChange={(v) => up({ icon: v } as any)} />
              <TextField label="Title *" value={it.title} onChange={(v) => up({ title: v } as any)} maxLength={80} />
            </div>
            <TextareaField label="Body" value={it.body} onChange={(v) => up({ body: v } as any)} maxLength={300} />
          </>
        )}
      />
    </div>
  );
}

function FeaturedCategoriesEditor({ data, onChange }: Props) {
  const d = data ?? {};
  return (
    <div className="space-y-3">
      <TextField label="Heading" value={d.heading} onChange={(v) => onChange({ ...d, heading: v })} />
      <TextareaField label="Subheading" value={d.subheading} onChange={(v) => onChange({ ...d, subheading: v })} />
      <ArrayField
        label="Category slugs"
        min={1}
        max={12}
        items={d.category_slugs ?? []}
        onChange={(category_slugs) => onChange({ ...d, category_slugs })}
        newItem={() => ""}
        itemTitle={(s: string) => s || "(empty)"}
        render={(s: string, _up, i) => (
          <TextField
            label={`Slug ${i + 1}`}
            value={s}
            onChange={(v) => {
              const next = [...(d.category_slugs ?? [])];
              next[i] = v;
              onChange({ ...d, category_slugs: next });
            }}
          />
        )}
      />
    </div>
  );
}

function FeaturedProductsEditor({ data, onChange }: Props) {
  const d = data ?? {};
  return (
    <div className="space-y-3">
      <TextField label="Heading" value={d.heading} onChange={(v) => onChange({ ...d, heading: v })} />
      <TextareaField label="Subheading" value={d.subheading} onChange={(v) => onChange({ ...d, subheading: v })} />
      <ArrayField
        label="Store product IDs"
        min={1}
        max={12}
        items={d.store_product_ids ?? []}
        onChange={(store_product_ids) => onChange({ ...d, store_product_ids })}
        newItem={() => ""}
        itemTitle={(s: string) => s || "(empty)"}
        render={(s: string, _up, i) => (
          <TextField
            label={`Product ID ${i + 1}`}
            value={s}
            onChange={(v) => {
              const next = [...(d.store_product_ids ?? [])];
              next[i] = v;
              onChange({ ...d, store_product_ids: next });
            }}
          />
        )}
      />
    </div>
  );
}

function TestimonialsEditor({ storeId, data, onChange }: Props) {
  const d = data ?? {};
  return (
    <div className="space-y-3">
      <TextField label="Heading" value={d.heading} onChange={(v) => onChange({ ...d, heading: v })} />
      <ArrayField
        label="Testimonials"
        min={1}
        max={8}
        items={d.items ?? []}
        onChange={(items) => onChange({ ...d, items })}
        newItem={() => ({ quote: "", author: "", role: "", avatar_url: "" })}
        itemTitle={(it: any) => it.author || "Untitled"}
        render={(it: any, up) => (
          <>
            <TextareaField label="Quote *" value={it.quote} onChange={(v) => up({ quote: v } as any)} maxLength={500} />
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Author *" value={it.author} onChange={(v) => up({ author: v } as any)} maxLength={80} />
              <TextField label="Role" value={it.role} onChange={(v) => up({ role: v } as any)} maxLength={80} />
            </div>
            <AssetField label="Avatar" storeId={storeId} value={it.avatar_url} onChange={(v) => up({ avatar_url: v } as any)} />
          </>
        )}
      />
    </div>
  );
}

function CtaBannerEditor({ storeId, data, onChange }: Props) {
  const d = data ?? {};
  const set = (p: any) => onChange({ ...d, ...p });
  return (
    <div className="space-y-3">
      <TextField label="Headline *" value={d.headline} onChange={(v) => set({ headline: v })} maxLength={200} />
      <TextareaField label="Body" value={d.body} onChange={(v) => set({ body: v })} maxLength={2000} />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="CTA label *" value={d.cta_label} onChange={(v) => set({ cta_label: v })} maxLength={60} />
        <TextField label="CTA link *" value={d.cta_href} onChange={(v) => set({ cta_href: v })} />
      </div>
      <AssetField label="Background image" storeId={storeId} value={d.background_image_url} onChange={(v) => set({ background_image_url: v })} />
    </div>
  );
}

function RichTextEditor({ data, onChange }: Props) {
  const d = data ?? {};
  return (
    <TextareaField
      label="Markdown *"
      value={d.markdown}
      onChange={(v) => onChange({ ...d, markdown: v })}
      rows={14}
      className="font-mono text-xs"
      maxLength={50_000}
    />
  );
}

function CategoryBentoEditor({ storeId, data, onChange }: Props) {
  const d = data ?? {};
  return (
    <div className="space-y-3">
      <TextField label="Eyebrow" value={d.eyebrow} onChange={(v) => onChange({ ...d, eyebrow: v })} />
      <TextField label="Heading" value={d.heading} onChange={(v) => onChange({ ...d, heading: v })} />
      <ArrayField
        label="Tiles (first tile is the 2×2 hero)"
        min={1}
        max={6}
        items={d.items ?? []}
        onChange={(items) => onChange({ ...d, items })}
        newItem={() => ({ image_url: "", label: "", sublabel: "", href: "" })}
        itemTitle={(it: any, i) => `${i === 0 ? "Hero tile — " : ""}${it.label || "Untitled"}`}
        render={(it: any, up) => (
          <>
            <AssetField label="Image" storeId={storeId} value={it.image_url} onChange={(v) => up({ image_url: v } as any)} />
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Label *" value={it.label} onChange={(v) => up({ label: v } as any)} maxLength={80} />
              <TextField label="Sublabel" value={it.sublabel} onChange={(v) => up({ sublabel: v } as any)} maxLength={80} />
            </div>
            <TextField label="Link" value={it.href} onChange={(v) => up({ href: v } as any)} />
          </>
        )}
      />
    </div>
  );
}

function ColumnBannersEditor({ storeId, data, onChange, max }: Props & { max: 2 | 3 }) {
  const d = data ?? {};
  return (
    <ArrayField
      label={`Columns (exactly ${max})`}
      min={1}
      max={max}
      items={d.items ?? []}
      onChange={(items) => onChange({ ...d, items })}
      newItem={() => ({ image_url: "", eyebrow: "", title: "", body: "", cta_label: "", cta_href: "" })}
      itemTitle={(it: any) => it.title || "Untitled"}
      render={(it: any, up) => (
        <>
          <AssetField label="Image" storeId={storeId} value={it.image_url} onChange={(v) => up({ image_url: v } as any)} />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Eyebrow" value={it.eyebrow} onChange={(v) => up({ eyebrow: v } as any)} />
            <TextField label="Title *" value={it.title} onChange={(v) => up({ title: v } as any)} maxLength={120} />
          </div>
          <TextareaField label="Body" value={it.body} onChange={(v) => up({ body: v } as any)} maxLength={300} />
          {max === 2 && (
            <div className="grid grid-cols-2 gap-3">
              <TextField label="CTA label" value={it.cta_label} onChange={(v) => up({ cta_label: v } as any)} maxLength={60} />
              <TextField label="CTA link" value={it.cta_href} onChange={(v) => up({ cta_href: v } as any)} />
            </div>
          )}
        </>
      )}
    />
  );
}

function BenefitsGridEditor({ data, onChange }: Props) {
  const d = data ?? {};
  return (
    <div className="space-y-3">
      <TextField label="Eyebrow" value={d.eyebrow} onChange={(v) => onChange({ ...d, eyebrow: v })} />
      <TextField label="Heading" value={d.heading} onChange={(v) => onChange({ ...d, heading: v })} />
      <ArrayField
        label="Benefits (max 4)"
        min={1}
        max={4}
        items={d.items ?? []}
        onChange={(items) => onChange({ ...d, items })}
        newItem={() => ({ eyebrow: "", title: "", body: "", accent_color: "" })}
        itemTitle={(it: any) => it.title || "Untitled"}
        render={(it: any, up) => (
          <>
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Eyebrow" value={it.eyebrow} onChange={(v) => up({ eyebrow: v } as any)} maxLength={40} />
              <TextField label="Title *" value={it.title} onChange={(v) => up({ title: v } as any)} maxLength={80} />
            </div>
            <TextareaField label="Body" value={it.body} onChange={(v) => up({ body: v } as any)} maxLength={300} />
            <TextField label="Accent colour (e.g. #FF6600)" value={it.accent_color} onChange={(v) => up({ accent_color: v } as any)} maxLength={20} />
          </>
        )}
      />
    </div>
  );
}

export function BlockEditor({ storeId, type, data, onChange }: Props & { type: string }) {
  switch (type as BlockType) {
    case "hero":
      return <HeroEditor storeId={storeId} data={data} onChange={onChange} />;
    case "value_props":
      return <ValuePropsEditor storeId={storeId} data={data} onChange={onChange} />;
    case "featured_categories":
      return <FeaturedCategoriesEditor storeId={storeId} data={data} onChange={onChange} />;
    case "featured_products":
      return <FeaturedProductsEditor storeId={storeId} data={data} onChange={onChange} />;
    case "testimonials":
      return <TestimonialsEditor storeId={storeId} data={data} onChange={onChange} />;
    case "cta_banner":
      return <CtaBannerEditor storeId={storeId} data={data} onChange={onChange} />;
    case "rich_text":
      return <RichTextEditor storeId={storeId} data={data} onChange={onChange} />;
    case "category_bento":
      return <CategoryBentoEditor storeId={storeId} data={data} onChange={onChange} />;
    case "two_column_banners":
      return <ColumnBannersEditor storeId={storeId} data={data} onChange={onChange} max={2} />;
    case "three_column_banners":
      return <ColumnBannersEditor storeId={storeId} data={data} onChange={onChange} max={3} />;
    case "benefits_grid":
      return <BenefitsGridEditor storeId={storeId} data={data} onChange={onChange} />;
    default:
      return (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-muted-foreground">
          Unknown block type <code>{type}</code>. Use the JSON tab to edit raw data.
        </div>
      );
  }
}

export { BLOCK_TYPES };
