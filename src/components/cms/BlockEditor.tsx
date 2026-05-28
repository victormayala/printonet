import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { GripVertical, Loader2, Package, Search, X } from "lucide-react";
import { BLOCK_TYPES, type BlockType } from "@/lib/cms.types";
import { TextField, TextareaField, AssetField, SelectField, ArrayField, ColorField } from "./fields";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

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

function FeaturedProductsEditor({ storeId, data, onChange }: Props) {
  const d = data ?? {};
  return (
    <div className="space-y-3">
      <TextField label="Heading" value={d.heading} onChange={(v) => onChange({ ...d, heading: v })} />
      <TextareaField label="Subheading" value={d.subheading} onChange={(v) => onChange({ ...d, subheading: v })} />
      <FeaturedProductsPicker
        storeId={storeId}
        value={Array.isArray(d.store_product_ids) ? d.store_product_ids : []}
        onChange={(store_product_ids) => onChange({ ...d, store_product_ids })}
      />
    </div>
  );
}

type StoreProductOption = {
  product_id: string;
  name: string;
  category: string | null;
  base_price: number;
  image_front: string | null;
};

function FeaturedProductsPicker({
  storeId,
  value,
  onChange,
}: {
  storeId: string;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [picking, setPicking] = useState(false);

  const { data: options = [], isLoading } = useQuery<StoreProductOption[]>({
    queryKey: ["cms_featured_products_pool", storeId],
    enabled: !!storeId,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data: links, error } = await supabase
        .from("corporate_store_products")
        .select("product_id")
        .eq("store_id", storeId)
        .eq("is_active", true);
      if (error) throw error;
      const ids = (links ?? []).map((l) => l.product_id);
      if (ids.length === 0) return [];
      const { data: prods, error: pErr } = await supabase
        .from("inventory_products")
        .select("id,name,category,base_price,image_front")
        .in("id", ids);
      if (pErr) throw pErr;
      return (prods ?? [])
        .map((p) => ({
          product_id: p.id,
          name: p.name,
          category: p.category,
          base_price: Number(p.base_price ?? 0),
          image_front: p.image_front,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
  });

  const byId = useMemo(() => new Map(options.map((o) => [o.product_id, o])), [options]);
  const selected = value;
  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return options.filter((o) => {
      if (selected.includes(o.product_id)) return false;
      if (!q) return true;
      return o.name.toLowerCase().includes(q) || (o.category ?? "").toLowerCase().includes(q);
    });
  }, [options, selected, search]);

  const toggle = (id: string) => {
    if (selected.includes(id)) onChange(selected.filter((s) => s !== id));
    else if (selected.length < 12) onChange([...selected, id]);
  };

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...selected];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-medium">
          Featured products {selected.length > 0 && <span className="text-muted-foreground font-normal">({selected.length}/12)</span>}
        </Label>
        <Button type="button" size="sm" variant="outline" onClick={() => setPicking((v) => !v)}>
          {picking ? "Done" : selected.length === 0 ? "Pick products" : "Add more"}
        </Button>
      </div>

      {selected.length === 0 && !picking && (
        <div className="rounded-md border border-dashed bg-muted/30 p-6 text-center text-xs text-muted-foreground">
          No products selected yet. Click <span className="font-medium text-foreground">Pick products</span> to choose from this store.
        </div>
      )}

      {selected.length > 0 && (
        <div className="space-y-1.5">
          {selected.map((pid, i) => {
            const p = byId.get(pid);
            return (
              <div key={pid} className="flex items-center gap-2 rounded-md border bg-card p-2">
                <div className="flex flex-col">
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30 leading-none"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label="Move up"
                  >▲</button>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30 leading-none"
                    onClick={() => move(i, 1)}
                    disabled={i === selected.length - 1}
                    aria-label="Move down"
                  >▼</button>
                </div>
                {p?.image_front ? (
                  <img src={p.image_front} alt="" className="h-10 w-10 rounded object-cover bg-muted" />
                ) : (
                  <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{p?.name ?? pid}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {p ? `${p.category ?? "—"} · $${p.base_price.toFixed(2)}` : "Product not in this store"}
                  </p>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => toggle(pid)}
                  aria-label="Remove"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {picking && (
        <div className="rounded-md border bg-background">
          <div className="relative border-b p-2">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products in this store…"
              className="pl-8 h-9"
            />
          </div>
          <div className="max-h-[280px] overflow-y-auto">
            {isLoading ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Loading…
              </div>
            ) : options.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                This store has no products yet. Add products to the store first.
              </div>
            ) : filteredOptions.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                {selected.length >= 12
                  ? "Maximum of 12 products selected."
                  : search
                  ? "No products match your search."
                  : "All products are already selected."}
              </div>
            ) : (
              <div className="divide-y">
                {filteredOptions.map((p) => (
                  <label
                    key={p.product_id}
                    className="flex items-center gap-3 p-2 hover:bg-muted/40 cursor-pointer"
                  >
                    <Checkbox
                      checked={false}
                      disabled={selected.length >= 12}
                      onCheckedChange={() => toggle(p.product_id)}
                    />
                    {p.image_front ? (
                      <img src={p.image_front} alt="" className="h-9 w-9 rounded object-cover bg-muted" />
                    ) : (
                      <div className="h-9 w-9 rounded bg-muted flex items-center justify-center">
                        <Package className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {p.category ?? "—"} · ${p.base_price.toFixed(2)}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
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
            <ColorField label="Accent colour" value={it.accent_color} onChange={(v) => up({ accent_color: v } as any)} help="e.g. #FF6600" />
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
