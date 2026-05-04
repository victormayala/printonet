import { useState, useEffect } from "react";
import PrintAreaEditor, { type PrintArea } from "@/components/PrintAreaEditor";
import PrintAreaOverlay from "@/components/PrintAreaOverlay";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft, Plus, Pencil, Trash2, Upload, ShoppingBag,
  Store, Globe, Loader2, Package, ImageIcon, LogOut, UserCircle,
  Code, Copy, Check, ExternalLink, Info, LayoutGrid, List, Eye,
  ArrowUpDown, SlidersHorizontal, RefreshCw, Link2, Unlink, Sparkles,
  Truck, Search, Download, Send, MoreVertical
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";

type Product = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  base_price: number;
  sale_price?: number | null;
  image_front: string | null;
  image_back: string | null;
  image_side1: string | null;
  image_side2: string | null;
  variants: any;
  is_active: boolean;
  created_at: string;
  print_areas?: Record<string, { x: number; y: number; width: number; height: number }> | null;
  product_type?: "single" | "variable" | null;
  status?: "draft" | "published" | null;
  weight?: number | null;
  weight_unit?: "lbs" | "kg" | null;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  dimension_unit?: "in" | "cm" | null;
  category_id?: string | null;
  subcategory_id?: string | null;
};

const CATEGORIES = ["T-Shirts", "Hoodies", "Mugs", "Phone Cases", "Tote Bags", "Hats", "Other"];

function CategoryCombobox({
  value,
  onChange,
  extraOptions = [],
  onCategoryRenamed,
}: {
  value: string;
  onChange: (v: string) => void;
  extraOptions?: string[];
  onCategoryRenamed?: (oldName: string, newName: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [renaming, setRenaming] = useState(false);
  const options = Array.from(
    new Set([...CATEGORIES, ...extraOptions, ...(value ? [value] : [])])
  );
  const trimmed = search.trim();
  const showCreate =
    trimmed.length > 0 && !options.some((o) => o.toLowerCase() === trimmed.toLowerCase());

  const startEdit = (e: React.MouseEvent, opt: string) => {
    e.stopPropagation();
    setEditing(opt);
    setEditValue(opt);
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditValue("");
  };

  const commitRename = async (oldName: string) => {
    const newName = editValue.trim();
    if (!newName || newName === oldName) {
      cancelEdit();
      return;
    }
    if (options.some((o) => o.toLowerCase() === newName.toLowerCase() && o !== oldName)) {
      toast({ title: "Category already exists", variant: "destructive" });
      return;
    }
    setRenaming(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase
        .from("inventory_products")
        .update({ category: newName })
        .eq("user_id", user.id)
        .eq("category", oldName);
      if (error) {
        toast({ title: "Rename failed", description: error.message, variant: "destructive" });
        setRenaming(false);
        return;
      }
    }
    if (value === oldName) onChange(newName);
    onCategoryRenamed?.(oldName, newName);
    toast({ title: `Renamed to "${newName}"` });
    setRenaming(false);
    cancelEdit();
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) cancelEdit(); }}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={value ? "" : "text-muted-foreground"}>{value || "Select or type a category"}</span>
          <ArrowUpDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search or type new..." value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>No matches.</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => {
                const isEditing = editing === opt;
                return (
                  <CommandItem
                    key={opt}
                    value={opt}
                    onSelect={() => {
                      if (isEditing) return;
                      onChange(opt);
                      setSearch("");
                      setOpen(false);
                    }}
                    className="group"
                  >
                    <Check className={`mr-2 h-4 w-4 shrink-0 ${value === opt ? "opacity-100" : "opacity-0"}`} />
                    {isEditing ? (
                      <div className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
                        <Input
                          autoFocus
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); commitRename(opt); }
                            if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
                          }}
                          className="h-7 text-sm"
                          disabled={renaming}
                        />
                        <Button
                          type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0"
                          onClick={(e) => { e.stopPropagation(); commitRename(opt); }}
                          disabled={renaming}
                        >
                          {renaming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        </Button>
                        <Button
                          type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0"
                          onClick={(e) => { e.stopPropagation(); cancelEdit(); }}
                          disabled={renaming}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span className="flex-1 truncate">{opt}</span>
                        <button
                          type="button"
                          onClick={(e) => startEdit(e, opt)}
                          className="ml-2 opacity-0 group-hover:opacity-100 hover:text-primary transition-opacity"
                          title="Rename category"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </CommandItem>
                );
              })}
              {showCreate && (
                <CommandItem
                  value={`__create_${trimmed}`}
                  onSelect={() => {
                    onChange(trimmed);
                    setSearch("");
                    setOpen(false);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add "{trimmed}"
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

const COLOR_NAME_MAP: Record<string, string> = {
  black: '#000000', white: '#ffffff', red: '#e53e3e', blue: '#3b82f6', navy: '#1e3a5f',
  green: '#38a169', forest: '#228b22', gray: '#6b7280', grey: '#6b7280', charcoal: '#36454f',
  heather: '#b0b0b0', maroon: '#800000', burgundy: '#800020', purple: '#7c3aed', pink: '#ec4899',
  orange: '#f97316', yellow: '#eab308', gold: '#d4a017', brown: '#8b4513', tan: '#d2b48c',
  beige: '#f5f5dc', cream: '#fffdd0', ivory: '#fffff0', coral: '#ff7f50', teal: '#0d9488',
  cyan: '#06b6d4', aqua: '#00ffff', lime: '#84cc16', olive: '#808000', khaki: '#c3b091',
  silver: '#c0c0c0', sand: '#c2b280', stone: '#928e85', slate: '#708090', steel: '#71797e',
  indigo: '#4f46e5', violet: '#8b5cf6', lavender: '#e6e6fa', mint: '#98fb98', sage: '#9caf88',
  rust: '#b7410e', wine: '#722f37', plum: '#8e4585', mauve: '#e0b0ff', rose: '#f43f5e',
  peach: '#ffcba4', apricot: '#fbceb1', cardinal: '#c41e3a', scarlet: '#ff2400', royal: '#4169e1',
  'royal blue': '#4169e1', 'dark green': '#006400', 'light blue': '#add8e6', 'light grey': '#d3d3d3',
  'dark grey': '#555555', 'dark gray': '#555555', 'light gray': '#d3d3d3', 'ash': '#b2beb5',
  'athletic heather': '#b8b8b8', 'athlhthr': '#b8b8b8', 'heather grey': '#9e9e9e', 'dust': '#c4b7a6',
  'natural': '#f5f0e1', 'oatmeal': '#d8c8a8', 'coyote': '#a0785a', 'denim': '#6f8faf',
  'carolina blue': '#56a0d3', 'kelly green': '#4cbb17', 'safety green': '#6eff00', 'safety orange': '#ff6700',
  'neon': '#39ff14', 'hot pink': '#ff69b4', 'fuchsia': '#ff00ff', 'magenta': '#ff00ff',
  'turquoise': '#40e0d0', 'charcoal heather': '#555555', 'oxford': '#6e7c7c',
};

function resolveVariantHex(variant: any): string {
  if (variant.hex) return variant.hex;
  if (!variant.color) return '#ccc';
  const key = variant.color.toLowerCase().trim();
  return COLOR_NAME_MAP[key] || '#ccc';
}

function AddVariantDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdd: (variant: any) => void;
}) {
  const [color, setColor] = useState("");
  const [hex, setHex] = useState("#000000");
  const [image, setImage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [sizesText, setSizesText] = useState("S, M, L, XL");
  const [defaultPrice, setDefaultPrice] = useState("0");

  const reset = () => {
    setColor("");
    setHex("#000000");
    setImage("");
    setSizesText("S, M, L, XL");
    setDefaultPrice("0");
  };

  const upload = async (file: File) => {
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${Date.now()}-variant.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file);
    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    setImage(data.publicUrl);
    setUploading(false);
  };

  const handleAdd = () => {
    if (!color.trim()) {
      toast({ title: "Color name is required", variant: "destructive" });
      return;
    }
    const sizes = sizesText
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((size) => ({
        size,
        sku: `${color.trim().toUpperCase().replace(/\s+/g, "-")}-${size}`,
        price: Number(defaultPrice) || 0,
      }));
    onAdd({
      color: color.trim(),
      hex,
      image: image || null,
      colorFrontImage: image || null,
      sizes,
      pricing: { margin: 0, embroidery_fee: 0, dtg_fee: 0 },
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add variant</DialogTitle>
          <DialogDescription>Create a color variant with one or more sizes.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-[1fr,auto] gap-3 items-end">
            <div className="space-y-2">
              <Label>Color name</Label>
              <Input value={color} onChange={(e) => setColor(e.target.value)} placeholder="e.g. Navy Blue" />
            </div>
            <div className="space-y-2">
              <Label>Swatch</Label>
              <input
                type="color"
                value={hex}
                onChange={(e) => setHex(e.target.value)}
                className="h-10 w-14 rounded-md border cursor-pointer bg-background"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Variant image (optional)</Label>
            {image ? (
              <div className="relative w-24 h-24 rounded-md border overflow-hidden bg-muted">
                <img src={image} alt="" className="w-full h-full object-contain" />
                <button
                  type="button"
                  onClick={() => setImage("")}
                  className="absolute top-1 right-1 rounded-full bg-background/80 p-1"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 rounded-md border-2 border-dashed h-20 cursor-pointer hover:border-primary/40 transition-colors">
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Upload image</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }}
                />
              </label>
            )}
          </div>
          <div className="space-y-2">
            <Label>Sizes (comma-separated)</Label>
            <Input value={sizesText} onChange={(e) => setSizesText(e.target.value)} placeholder="S, M, L, XL, 2XL" />
            <p className="text-[11px] text-muted-foreground">SKUs will be auto-generated as COLOR-SIZE.</p>
          </div>
          <div className="space-y-2">
            <Label>Default price per size ($)</Label>
            <Input
              type="number" step="0.01" min="0"
              value={defaultPrice}
              onChange={(e) => setDefaultPrice(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancel</Button>
          <Button onClick={handleAdd}>Add variant</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProductForm({
  product,
  onSave,
  onCancel,
  knownCategories = [],
  onCategoryRenamed,
}: {
  product?: Product | null;
  onSave: () => void;
  onCancel: () => void;
  knownCategories?: string[];
  onCategoryRenamed?: (oldName: string, newName: string) => void;
}) {
  const [name, setName] = useState(product?.name || "");
  const [category, setCategory] = useState(product?.category || "T-Shirts");
  const [categoryId, setCategoryId] = useState<string | null>(product?.category_id || null);
  const [subcategoryId, setSubcategoryId] = useState<string | null>(product?.subcategory_id || null);
  const { data: categoryRows } = useCategories();
  const categoryTree = buildCategoryTree(categoryRows ?? []);
  const selectedRoot = categoryTree.find((c) => c.id === categoryId);
  const [description, setDescription] = useState(product?.description || "");
  const [basePrice, setBasePrice] = useState(product?.base_price?.toString() || "0");
  const [salePrice, setSalePrice] = useState(product?.sale_price != null ? String(product.sale_price) : "");
  const [imageFront, setImageFront] = useState(product?.image_front || "");
  const [imageBack, setImageBack] = useState(product?.image_back || "");
  const [imageLeft, setImageLeft] = useState(product?.image_side1 || "");
  const [imageRight, setImageRight] = useState(product?.image_side2 || "");
  const [isActive, setIsActive] = useState(product?.is_active ?? true);
  const [productType, setProductType] = useState<"single" | "variable">(product?.product_type || "single");
  const [status, setStatus] = useState<"draft" | "published">(product?.status || "draft");
  const [weight, setWeight] = useState(product?.weight?.toString() || "");
  const [weightUnit, setWeightUnit] = useState<"lbs" | "kg">(product?.weight_unit || "lbs");
  const [length, setLength] = useState(product?.length?.toString() || "");
  const [pwidth, setPwidth] = useState(product?.width?.toString() || "");
  const [pheight, setPheight] = useState(product?.height?.toString() || "");
  const [dimensionUnit, setDimensionUnit] = useState<"in" | "cm">(product?.dimension_unit || "in");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [printAreas, setPrintAreas] = useState<Record<string, { x: number; y: number; width: number; height: number }>>(
    (product?.print_areas as any) || {}
  );
  const [detecting, setDetecting] = useState<string | null>(null);

  // ============ Variants (Shopify-style inline manager) ============
  const [variants, setVariants] = useState<any[]>(() => {
    const initial = Array.isArray(product?.variants) ? (product!.variants as any[]) : [];
    return initial.map((v: any) => ({
      ...v,
      pricing: v.pricing || { margin: 0, embroidery_fee: 0, dtg_fee: 0 },
    }));
  });
  const [selectedVariantIdx, setSelectedVariantIdx] = useState(0);
  const [showAddVariant, setShowAddVariant] = useState(false);

  useEffect(() => {
    const initial = Array.isArray(product?.variants) ? (product!.variants as any[]) : [];
    setVariants(
      initial.map((v: any) => ({
        ...v,
        pricing: v.pricing || { margin: 0, embroidery_fee: 0, dtg_fee: 0 },
      }))
    );
    setSelectedVariantIdx(0);
  }, [product?.id]);

  const productBaseCost = parseFloat(basePrice) || 0;
  const selectedVariant = variants[selectedVariantIdx];

  // Per-variant base cost = min non-zero SKU price; falls back to product base price.
  // Lets switching colors reflect actual cost (e.g. 2XL or color upcharges).
  const variantBaseCost = (v: any): number => {
    const sizes = Array.isArray(v?.sizes) ? v.sizes : [];
    const prices = sizes.map((s: any) => Number(s?.price) || 0).filter((n: number) => n > 0);
    if (prices.length > 0) return Math.min(...prices);
    return productBaseCost;
  };
  const baseCostNum = selectedVariant ? variantBaseCost(selectedVariant) : productBaseCost;

  const updateVariantPricing = (idx: number, field: "margin" | "embroidery_fee" | "dtg_fee", value: string) => {
    setVariants((prev) =>
      prev.map((v, i) =>
        i === idx ? { ...v, pricing: { ...(v.pricing || {}), [field]: value } } : v
      )
    );
  };

  const updateVariantSize = (vIdx: number, sIdx: number, patch: any) => {
    setVariants((prev) =>
      prev.map((v, i) => {
        if (i !== vIdx) return v;
        const sizes = [...(v.sizes || [])];
        sizes[sIdx] = { ...sizes[sIdx], ...patch };
        return { ...v, sizes };
      })
    );
  };

  const computeVariantFinalPrice = (v: any) => {
    const p = v?.pricing || {};
    const cost = variantBaseCost(v);
    return cost + (Number(p.margin) || 0) + (Number(p.embroidery_fee) || 0) + (Number(p.dtg_fee) || 0);
  };

  const applyPricingToAllColors = () => {
    if (!selectedVariant?.pricing) return;
    const src = selectedVariant.pricing;
    const finalPrice = computeVariantFinalPrice(selectedVariant);
    setVariants((prev) =>
      prev.map((v) => ({
        ...v,
        pricing: { ...src },
        sizes: (v.sizes || []).map((s: any) => ({ ...s, price: finalPrice })),
      }))
    );
    toast({ title: "Pricing applied to all colors" });
  };

  const applyFinalPriceToVariantSizes = (vIdx: number) => {
    const v = variants[vIdx];
    const finalPrice = computeVariantFinalPrice(v);
    setVariants((prev) =>
      prev.map((vv, i) =>
        i === vIdx
          ? { ...vv, sizes: (vv.sizes || []).map((s: any) => ({ ...s, price: finalPrice })) }
          : vv
      )
    );
  };

  const removeVariant = (idx: number) => {
    setVariants((prev) => prev.filter((_, i) => i !== idx));
    setSelectedVariantIdx((prev) => Math.max(0, Math.min(prev, variants.length - 2)));
  };

  const addManualVariant = (variant: any) => {
    setVariants((prev) => {
      const next = [...prev, variant];
      setSelectedVariantIdx(next.length - 1);
      return next;
    });
  };

  const autoDetectPrintArea = async (imageUrl: string, sideKey: string) => {
    const printAreaKey = sideKey === "left" ? "side1" : sideKey === "right" ? "side2" : sideKey;
    setDetecting(sideKey);
    try {
      const { data, error } = await supabase.functions.invoke("detect-print-area", {
        body: { imageUrl },
      });
      if (error) throw error;
      if (data?.printArea) {
        setPrintAreas((prev) => ({ ...prev, [printAreaKey]: data.printArea }));
        toast({ title: `Print area detected for ${sideKey}` });
      } else {
        throw new Error("No print area detected");
      }
    } catch (err: any) {
      toast({ title: "Detection failed", description: err.message, variant: "destructive" });
    } finally {
      setDetecting(null);
    }
  };

  const IMAGE_SIDES = [
    { key: "front", label: "Front", value: imageFront, setter: setImageFront },
    { key: "back", label: "Back", value: imageBack, setter: setImageBack },
    { key: "left", label: "Left", value: imageLeft, setter: setImageLeft },
    { key: "right", label: "Right", value: imageRight, setter: setImageRight },
  ];

  const uploadImage = async (file: File, side: string) => {
    setUploading(side);
    const ext = file.name.split(".").pop();
    const path = `${Date.now()}-${side}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file);
    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      setUploading(null);
      return;
    }
    const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
    const sideConfig = IMAGE_SIDES.find(s => s.key === side);
    if (sideConfig) sideConfig.setter(urlData.publicUrl);
    setUploading(null);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      name: name.trim(),
      category,
      description: description.trim() || null,
      base_price: parseFloat(basePrice) || 0,
      sale_price: salePrice.trim() === "" ? null : (parseFloat(salePrice) || null),
      image_front: imageFront || null,
      image_back: imageBack || null,
      image_side1: imageLeft || null,
      image_side2: imageRight || null,
      is_active: isActive,
      product_type: productType,
      status,
      weight: weight === "" ? null : Number(weight),
      weight_unit: weightUnit,
      length: length === "" ? null : Number(length),
      width: pwidth === "" ? null : Number(pwidth),
      height: pheight === "" ? null : Number(pheight),
      dimension_unit: dimensionUnit,
      print_areas: Object.keys(printAreas).length > 0 ? printAreas : {},
      ...(productType === "variable" ? {
        variants: variants.map((v) => ({
          ...v,
          pricing: {
            margin: Number(v.pricing?.margin) || 0,
            embroidery_fee: Number(v.pricing?.embroidery_fee) || 0,
            dtg_fee: Number(v.pricing?.dtg_fee) || 0,
          },
          sizes: (v.sizes || []).map((s: any) => ({ ...s, price: Number(s.price) || 0 })),
        })),
      } : { variants: [] }),
      ...(product ? {} : { user_id: user?.id }),
    };

    let error;
    if (product) {
      ({ error } = await supabase.from("inventory_products").update(payload).eq("id", product.id));
    } else {
      ({ error } = await supabase.from("inventory_products").insert(payload));
    }

    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: product ? "Product updated" : "Product added" });
      onSave();
    }
  };

  return (
    <div className="space-y-5">
      {/* Product Type + Status */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Product Type</Label>
          <Select value={productType} onValueChange={(v) => setProductType(v as "single" | "variable")}>
            <SelectTrigger>
              <SelectValue placeholder="Select product type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="single">Single Product</SelectItem>
              <SelectItem value="variable">Variable Product</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as "draft" | "published")}>
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Classic T-Shirt" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Category</Label>
          <CategoryCombobox
            value={category}
            onChange={setCategory}
            extraOptions={knownCategories}
            onCategoryRenamed={onCategoryRenamed}
          />
          <p className="text-[11px] text-muted-foreground">Pick one or type to add a new category.</p>
        </div>
        <div className="space-y-2">
          <Label>Regular Price</Label>
          <Input type="number" step="0.01" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>
            Sale Price <span className="text-xs text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input
            type="number"
            step="0.01"
            value={salePrice}
            onChange={(e) => setSalePrice(e.target.value)}
            placeholder="—"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        {IMAGE_SIDES.map(({ key, label, value, setter }) => {
          const printAreaKey = key === "left" ? "side1" : key === "right" ? "side2" : key;
          return (
            <div key={key} className="space-y-2">
              <Label>{label} Image</Label>
              {value ? (
                <>
                  <div className="relative group rounded-lg overflow-hidden border aspect-square bg-muted">
                    <img src={value} alt={label} className="w-full h-full object-contain" />
                    {printAreas[printAreaKey] && (
                      <PrintAreaOverlay imageUrl={value} printArea={printAreas[printAreaKey]} />
                    )}
                    <button
                      onClick={() => setter("")}
                      className="absolute top-2 right-2 rounded-full bg-background/80 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <PrintAreaEditor
                      imageUrl={value}
                      sideLabel={label}
                      value={printAreas[printAreaKey] || null}
                      onChange={(area) => {
                        if (area) {
                          setPrintAreas((prev) => ({ ...prev, [printAreaKey]: area }));
                        } else {
                          setPrintAreas((prev) => {
                            const next = { ...prev };
                            delete next[printAreaKey];
                            return next;
                          });
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs"
                      disabled={detecting === key}
                      onClick={() => autoDetectPrintArea(value, key)}
                    >
                      {detecting === key ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      Auto-Detect
                    </Button>
                  </div>
                </>
              ) : (
                <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed aspect-square cursor-pointer hover:border-primary/40 transition-colors">
                  {uploading === key ? (
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Upload {label.toLowerCase()}</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadImage(f, key);
                    }}
                  />
                </label>
              )}
            </div>
          );
        })}
      </div>

      {/* ============ Variants (color list + per-color pricing) ============ */}
      {productType === "variable" && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <Label className="text-base">Variants</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                {variants.length} color{variants.length !== 1 ? "s" : ""}
                {variants.length > 0 && ` · Base cost $${baseCostNum.toFixed(2)}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setShowAddVariant(true)} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Add variant
              </Button>
              {variants.length > 0 && (
                <Button type="button" size="sm" variant="outline" onClick={applyPricingToAllColors} disabled={!selectedVariant}>
                  Apply pricing to all colors
                </Button>
              )}
            </div>
          </div>

          {variants.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <Package className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground mb-3">No variants yet. Add colors and sizes to get started.</p>
              <Button type="button" size="sm" onClick={() => setShowAddVariant(true)} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Add your first variant
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <div className="flex h-[480px]">
                {/* Left rail: color list */}
                <div className="w-64 border-r overflow-y-auto shrink-0 bg-muted/20">
                  {variants.map((v, idx) => {
                    const img = v.image || v.colorFrontImage || v.colorSwatchImage;
                    const isSelected = idx === selectedVariantIdx;
                    return (
                      <div
                        key={idx}
                        className={`group w-full flex items-center gap-2.5 px-3 py-2 text-left border-b transition-colors ${
                          isSelected ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-muted/40"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedVariantIdx(idx)}
                          className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
                        >
                          {img ? (
                            <img src={img} alt={v.color} className="w-9 h-9 object-contain rounded bg-background border shrink-0" />
                          ) : (
                            <div
                              className="w-9 h-9 rounded border shrink-0"
                              style={{ background: resolveVariantHex(v) }}
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium truncate">{v.color || "—"}</p>
                            <p className="text-[10px] text-muted-foreground">{v.sizes?.length || 0} sizes</p>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeVariant(idx)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 text-destructive"
                          title="Remove variant"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Right pane: selected variant detail */}
                <div className="flex-1 overflow-y-auto p-4">
                  {selectedVariant ? (
                    <div className="space-y-4">
                      <div className="flex gap-4">
                        <div className="w-40 h-40 rounded-lg border bg-muted/20 flex items-center justify-center overflow-hidden shrink-0">
                          {(selectedVariant.image || selectedVariant.colorFrontImage) ? (
                            <img
                              src={selectedVariant.image || selectedVariant.colorFrontImage}
                              alt={selectedVariant.color}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-semibold truncate">{selectedVariant.color}</h3>
                          </div>
                          <div className="rounded-lg border p-3 space-y-2 bg-muted/10">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Pricing</p>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Label className="text-[10px]">Base cost</Label>
                                <Input type="text" value={`$${baseCostNum.toFixed(2)}`} readOnly className="h-8 mt-1 bg-muted text-xs" />
                              </div>
                              <div>
                                <Label className="text-[10px]">Profit margin ($)</Label>
                                <Input
                                  type="number" step="0.01" min="0"
                                  value={selectedVariant.pricing?.margin ?? ""}
                                  onChange={(e) => updateVariantPricing(selectedVariantIdx, "margin", e.target.value)}
                                  className="h-8 mt-1 text-xs"
                                />
                              </div>
                              <div>
                                <Label className="text-[10px]">Embroidery fee ($)</Label>
                                <Input
                                  type="number" step="0.01" min="0"
                                  value={selectedVariant.pricing?.embroidery_fee ?? ""}
                                  onChange={(e) => updateVariantPricing(selectedVariantIdx, "embroidery_fee", e.target.value)}
                                  className="h-8 mt-1 text-xs"
                                />
                              </div>
                              <div>
                                <Label className="text-[10px]">DTG fee ($)</Label>
                                <Input
                                  type="number" step="0.01" min="0"
                                  value={selectedVariant.pricing?.dtg_fee ?? ""}
                                  onChange={(e) => updateVariantPricing(selectedVariantIdx, "dtg_fee", e.target.value)}
                                  className="h-8 mt-1 text-xs"
                                />
                              </div>
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t">
                              <div>
                                <p className="text-[10px] text-muted-foreground">Final price</p>
                                <p className="text-xl font-bold text-primary">${computeVariantFinalPrice(selectedVariant).toFixed(2)}</p>
                              </div>
                              <Button type="button" size="sm" variant="secondary" onClick={() => applyFinalPriceToVariantSizes(selectedVariantIdx)}>
                                Apply to all sizes
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Sizes</Label>
                        <div className="rounded-lg border overflow-hidden">
                          <div className="grid grid-cols-[1fr,2fr,1fr] gap-3 px-3 py-1.5 bg-muted/40 text-[10px] font-medium text-muted-foreground border-b">
                            <span>Size</span>
                            <span>SKU</span>
                            <span className="text-right">Price ($)</span>
                          </div>
                          {selectedVariant.sizes?.length ? (
                            [...selectedVariant.sizes]
                              .map((s: any, originalIdx: number) => ({ s, originalIdx }))
                              .sort((a, b) => {
                                const order = ["XXS","XS","S","SM","M","MD","L","LG","XL","XLG","2XL","XXL","3XL","XXXL","4XL","5XL","6XL","7XL"];
                                const norm = (v: string) => (v || "").toString().toUpperCase().trim();
                                const ai = order.indexOf(norm(a.s.size));
                                const bi = order.indexOf(norm(b.s.size));
                                if (ai === -1 && bi === -1) return norm(a.s.size).localeCompare(norm(b.s.size));
                                if (ai === -1) return 1;
                                if (bi === -1) return -1;
                                return ai - bi;
                              })
                              .map(({ s, originalIdx: sIdx }) => (
                              <div key={sIdx} className="grid grid-cols-[1fr,2fr,1fr] gap-3 px-3 py-1.5 border-b last:border-b-0 items-center">
                                <span className="text-xs font-medium">{s.size || "—"}</span>
                                <Input
                                  value={s.sku || ""}
                                  onChange={(e) => updateVariantSize(selectedVariantIdx, sIdx, { sku: e.target.value })}
                                  className="h-7 text-xs"
                                  placeholder="SKU"
                                />
                                <Input
                                  type="number" step="0.01" min="0"
                                  value={s.price ?? ""}
                                  onChange={(e) => updateVariantSize(selectedVariantIdx, sIdx, { price: e.target.value })}
                                  className="h-7 text-xs text-right"
                                />
                              </div>
                            ))
                          ) : (
                            <div className="px-3 py-4 text-center text-xs text-muted-foreground">No sizes</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Select a color to edit</div>
                  )}
                </div>
              </div>
            </div>
          )}

          <AddVariantDialog
            open={showAddVariant}
            onOpenChange={setShowAddVariant}
            onAdd={addManualVariant}
          />
        </div>
      )}

      {/* ============ Shipping ============ */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-muted-foreground" />
          <Label className="text-base">Shipping</Label>
        </div>
        <div className="rounded-lg border p-4 space-y-4 bg-muted/10">
          <div className="grid grid-cols-[1fr,auto] gap-3 items-end">
            <div className="space-y-2">
              <Label className="text-xs">Weight</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Unit</Label>
              <Select value={weightUnit} onValueChange={(v) => setWeightUnit(v as "lbs" | "kg")}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lbs">lbs</SelectItem>
                  <SelectItem value="kg">kg</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Dimensions</Label>
              <Select value={dimensionUnit} onValueChange={(v) => setDimensionUnit(v as "in" | "cm")}>
                <SelectTrigger className="w-24 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">in</SelectItem>
                  <SelectItem value="cm">cm</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Input
                type="number" step="0.01" min="0"
                value={length}
                onChange={(e) => setLength(e.target.value)}
                placeholder="Length"
              />
              <Input
                type="number" step="0.01" min="0"
                value={pwidth}
                onChange={(e) => setPwidth(e.target.value)}
                placeholder="Width"
              />
              <Input
                type="number" step="0.01" min="0"
                value={pheight}
                onChange={(e) => setPheight(e.target.value)}
                placeholder="Height"
              />
            </div>
          </div>
        </div>
      </div>


      <div className="flex items-center gap-3">
        <Switch checked={isActive} onCheckedChange={setIsActive} />
        <Label>Active (visible to customers)</Label>
      </div>
      <div className="flex gap-3 pt-2">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {product ? "Update Product" : "Add Product"}
        </Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

function ShopifyImport({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const [storeUrl, setStoreUrl] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [integration, setIntegration] = useState<any>(null);
  const [loadingIntegration, setLoadingIntegration] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [authUrl, setAuthUrl] = useState<string | null>(null);

  const fetchIntegration = async () => {
    if (!user) return;
    setLoadingIntegration(true);
    const { data } = await supabase
      .from("store_integrations")
      .select("*")
      .eq("user_id", user.id)
      .eq("platform", "shopify")
      .maybeSingle();
    setIntegration(data);
    if (data) {
      setStoreUrl(data.store_url);
      setToken((data.credentials as any)?.access_token || "");
    }
    setLoadingIntegration(false);
  };

  useEffect(() => { fetchIntegration(); }, [user]);

  const normalizeStoreUrl = (value: string) => value.trim().replace(/\/$/, "");

  const getEdgeFunctionErrorMessage = async (error: any) => {
    const fallback = error?.message || "Shopify connection failed";
    const response = error?.context;

    if (!(response instanceof Response)) return fallback;

    try {
      const body = await response.clone().json();
      if (typeof body?.error === "string" && body.error.trim()) {
        return body.error;
      }
    } catch {}

    try {
      const text = await response.clone().text();
      if (text.trim()) return text;
    } catch {}

    return fallback;
  };

  const getFriendlyShopifyErrorMessage = (message: string) => {
    if (/read_products scope/i.test(message)) {
      return "This token is missing Shopify Admin API product access. Enable read_products and write_products in your custom app, update or reinstall the app, then paste the new Admin API access token.";
    }

    if (/invalid api key or access token|unauthorized|401/i.test(message)) {
      return "Shopify rejected this token. Use the Admin API access token from your custom app, not the Storefront token.";
    }

    return message;
  };

  const handleConnect = async () => {
    const normalizedStoreUrl = normalizeStoreUrl(storeUrl);
    const accessToken = token.trim();

    if (!normalizedStoreUrl || !accessToken) {
      toast({ title: "Enter both store URL and access token", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("import-shopify-products", {
        body: { store_url: normalizedStoreUrl, access_token: accessToken, user_id: user?.id },
      });

      if (error) {
        const rawMessage = await getEdgeFunctionErrorMessage(error);
        throw new Error(getFriendlyShopifyErrorMessage(rawMessage));
      }

      const integrationPayload = {
        user_id: user?.id,
        platform: "shopify" as const,
        store_url: normalizedStoreUrl,
        credentials: { access_token: accessToken },
        last_synced_at: new Date().toISOString(),
      };

      const { error: saveError } = integration
        ? await supabase.from("store_integrations").update(integrationPayload).eq("id", integration.id)
        : await supabase.from("store_integrations").insert(integrationPayload);

      if (saveError) throw saveError;

      toast({ title: `Connected! Imported ${data.imported_count} products from Shopify` });
      await fetchIntegration();
      onDone();
    } catch (err: any) {
      toast({ title: "Shopify connection failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!integration) return;
    setSyncing(true);
    try {
      const creds = integration.credentials;
      const { data, error } = await supabase.functions.invoke("import-shopify-products", {
        body: {
          store_url: integration.store_url,
          access_token: creds.access_token,
          user_id: user?.id,
          is_sync: true,
        },
      });

      if (error) {
        const rawMessage = await getEdgeFunctionErrorMessage(error);
        throw new Error(getFriendlyShopifyErrorMessage(rawMessage));
      }

      toast({ title: `Synced! Imported ${data.imported_count} of ${data.total} products from Shopify` });
      await fetchIntegration();
      onDone();
    } catch (err: any) {
      toast({ title: "Shopify sync failed", description: err.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!integration) return;
    setDisconnecting(true);
    await supabase.from("store_integrations").delete().eq("id", integration.id);
    setIntegration(null);
    setStoreUrl("");
    setToken("");
    setDisconnecting(false);
    toast({ title: "Shopify disconnected" });
  };

  if (loadingIntegration) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (integration) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShoppingBag className="h-5 w-5" /> Shopify Connected
            </CardTitle>
            <CardDescription>
              Connected to <strong>{integration.store_url}</strong>
              {integration.last_synced_at && (
                <> · Last synced {new Date(integration.last_synced_at).toLocaleDateString()} at {new Date(integration.last_synced_at).toLocaleTimeString()}</>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Button onClick={handleSync} disabled={syncing} className="gap-2">
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Sync Products
            </Button>
            <Button variant="outline" onClick={handleDisconnect} disabled={disconnecting} className="gap-2 text-destructive hover:text-destructive">
              {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
              Disconnect
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }


  const handleOAuthConnect = async () => {
    if (!storeUrl.trim()) {
      toast({ variant: "destructive", title: "Please enter your Shopify store URL or name" });
      return;
    }
    setLoading(true);
    setAuthUrl(null);
    try {
      const { data, error } = await supabase.functions.invoke("shopify-oauth-init", {
        body: {
          shop: storeUrl.trim(),
          user_id: user?.id,
          redirect_url: window.location.origin + "/products",
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.authorization_url) {
        setAuthUrl(data.authorization_url);
      } else {
        throw new Error("No authorization URL returned");
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: err.message || "Failed to start Shopify connection" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><ShoppingBag className="h-5 w-5" /> Connect Shopify</CardTitle>
          <CardDescription>Enter your store name or URL, then authorize with Shopify. We'll request product, inventory, and Online Store permissions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Store URL or Name</Label>
            <Input value={storeUrl} onChange={(e) => { setStoreUrl(e.target.value); setAuthUrl(null); }} placeholder="your-store or your-store.myshopify.com" />
            <p className="text-xs text-muted-foreground">You'll be redirected to Shopify to authorize access — no manual tokens needed.</p>
          </div>
          {!authUrl ? (
            <Button onClick={handleOAuthConnect} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              Connect with Shopify
            </Button>
          ) : (
            <div className="space-y-3">
              <a
                href={authUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                Open Shopify to Authorize
              </a>
              <p className="text-xs text-muted-foreground">
                Click the link above to open Shopify in a new tab and authorize access. Once done, you'll be redirected back automatically.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function WooCommerceImport({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const [siteUrl, setSiteUrl] = useState("");
  const [consumerKey, setConsumerKey] = useState("");
  const [consumerSecret, setConsumerSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [integration, setIntegration] = useState<any>(null);
  const [loadingIntegration, setLoadingIntegration] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  const fetchIntegration = async () => {
    if (!user) return;
    setLoadingIntegration(true);
    const { data } = await supabase
      .from("store_integrations")
      .select("*")
      .eq("user_id", user.id)
      .eq("platform", "woocommerce")
      .maybeSingle();
    setIntegration(data);
    if (data) {
      setSiteUrl(data.store_url);
      setConsumerKey((data.credentials as any)?.consumer_key || "");
      setConsumerSecret((data.credentials as any)?.consumer_secret || "");
    }
    setLoadingIntegration(false);
  };

  useEffect(() => { fetchIntegration(); }, [user]);

  const handleConnect = async () => {
    if (!siteUrl.trim() || !consumerKey.trim() || !consumerSecret.trim()) {
      toast({ title: "All fields are required", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const integrationPayload = {
        user_id: user?.id,
        platform: "woocommerce" as const,
        store_url: siteUrl.trim().replace(/\/$/, ""),
        credentials: { consumer_key: consumerKey.trim(), consumer_secret: consumerSecret.trim() },
      };

      if (integration) {
        await supabase.from("store_integrations").update(integrationPayload).eq("id", integration.id);
      } else {
        await supabase.from("store_integrations").insert(integrationPayload);
      }

      const { data, error } = await supabase.functions.invoke("import-woocommerce-products", {
        body: {
          site_url: siteUrl.trim().replace(/\/$/, ""),
          consumer_key: consumerKey.trim(),
          consumer_secret: consumerSecret.trim(),
          user_id: user?.id,
        },
      });
      if (error) throw error;
      toast({ title: `Connected! Imported ${data.imported_count} products from WooCommerce` });
      await fetchIntegration();
      onDone();
    } catch (err: any) {
      toast({ title: "WooCommerce import failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!integration) return;
    setSyncing(true);
    try {
      const creds = integration.credentials;
      const { data, error } = await supabase.functions.invoke("import-woocommerce-products", {
        body: {
          site_url: integration.store_url,
          consumer_key: creds.consumer_key,
          consumer_secret: creds.consumer_secret,
          user_id: user?.id,
          is_sync: true,
        },
      });
      if (error) throw error;
      toast({ title: `Synced! ${data.imported_count} new, ${data.updated_count} updated out of ${data.total} products` });
      await fetchIntegration();
      onDone();
    } catch (err: any) {
      toast({ title: "Sync failed", description: err.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!integration) return;
    setDisconnecting(true);
    await supabase.from("store_integrations").delete().eq("id", integration.id);
    setIntegration(null);
    setSiteUrl("");
    setConsumerKey("");
    setConsumerSecret("");
    setDisconnecting(false);
    toast({ title: "WooCommerce disconnected" });
  };

  if (loadingIntegration) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (integration) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Globe className="h-5 w-5" /> WooCommerce Connected
            </CardTitle>
            <CardDescription>
              Connected to <strong>{integration.store_url}</strong>
              {integration.last_synced_at && (
                <> · Last synced {new Date(integration.last_synced_at).toLocaleDateString()} at {new Date(integration.last_synced_at).toLocaleTimeString()}</>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Button onClick={handleSync} disabled={syncing} className="gap-2">
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Sync Products
            </Button>
            <Button variant="outline" onClick={handleDisconnect} disabled={disconnecting} className="gap-2 text-destructive hover:text-destructive">
              {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
              Disconnect
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">How to get your WooCommerce credentials</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ol className="list-decimal list-inside space-y-2">
            <li>Log in to your <strong className="text-foreground">WordPress Admin</strong> dashboard</li>
            <li>Go to <strong className="text-foreground">WooCommerce → Settings → Advanced → REST API</strong></li>
            <li>Click <strong className="text-foreground">Add key</strong> and fill in a description (e.g. "Customizer Studio")</li>
            <li>Set <strong className="text-foreground">Permissions</strong> to <code className="text-xs bg-muted px-1.5 py-0.5 rounded">Read</code></li>
            <li>Click <strong className="text-foreground">Generate API key</strong></li>
            <li>Copy the <strong className="text-foreground">Consumer Key</strong> (starts with <code className="text-xs bg-muted px-1.5 py-0.5 rounded">ck_</code>) and <strong className="text-foreground">Consumer Secret</strong> (starts with <code className="text-xs bg-muted px-1.5 py-0.5 rounded">cs_</code>)</li>
          </ol>
          <p>Your <strong className="text-foreground">Site URL</strong> is your WordPress domain, e.g. <code className="text-xs bg-muted px-1.5 py-0.5 rounded">https://your-store.com</code></p>
          <p className="text-xs text-muted-foreground/70">Note: Your site must have SSL (HTTPS) enabled for the REST API to work.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Globe className="h-5 w-5" /> Connect WooCommerce</CardTitle>
          <CardDescription>Enter your WordPress site URL and WooCommerce REST API credentials. Credentials will be saved for future syncs.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>WordPress Site URL</Label>
            <Input value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} placeholder="https://your-store.com" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Consumer Key</Label>
              <Input value={consumerKey} onChange={(e) => setConsumerKey(e.target.value)} placeholder="ck_..." />
            </div>
            <div className="space-y-2">
              <Label>Consumer Secret</Label>
              <Input value={consumerSecret} onChange={(e) => setConsumerSecret(e.target.value)} type="password" placeholder="cs_..." />
            </div>
          </div>
          <Button onClick={handleConnect} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            Connect & Import
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function SSActivewearImport({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const [accountNumber, setAccountNumber] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [integration, setIntegration] = useState<any>(null);
  const [loadingIntegration, setLoadingIntegration] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  // Catalog browser state
  const [searchQuery, setSearchQuery] = useState("");
  const [appliedSearchQuery, setAppliedSearchQuery] = useState("");
  const [catalogResults, setCatalogResults] = useState<any[]>([]);
  const [browsing, setBrowsing] = useState(false);
  const [importing, setImporting] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [importedStyleIds, setImportedStyleIds] = useState<Set<number>>(new Set());
  const [selectedStyleIds, setSelectedStyleIds] = useState<Set<number>>(new Set());
  const [bulkImporting, setBulkImporting] = useState(false);
  const [hasLoadedCatalog, setHasLoadedCatalog] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [categories, setCategories] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [detailStyle, setDetailStyle] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const handleViewDetails = async (styleID: number) => {
    const creds = getCredentials();
    setDetailsOpen(true);
    setLoadingDetails(true);
    setDetailStyle(null);
    try {
      const { data, error } = await supabase.functions.invoke("import-ssactivewear-products", {
        body: { action: "details", ...creds, style_id: styleID },
      });
      if (error) throw error;
      setDetailStyle(data);
    } catch (err: any) {
      toast({ title: "Failed to load details", description: err.message, variant: "destructive" });
      setDetailsOpen(false);
    } finally {
      setLoadingDetails(false);
    }
  };

  const fetchIntegration = async () => {
    if (!user) return;
    setLoadingIntegration(true);
    const { data } = await supabase
      .from("store_integrations")
      .select("*")
      .eq("user_id", user.id)
      .eq("platform", "ssactivewear")
      .maybeSingle();
    setIntegration(data);
    if (data) {
      setAccountNumber((data.credentials as any)?.account_number || "");
      setApiKey((data.credentials as any)?.api_key || "");
    }
    setLoadingIntegration(false);
  };

  const fetchImportedStyleIds = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("inventory_products")
      .select("supplier_source")
      .eq("user_id", user.id)
      .not("supplier_source", "is", null);
    if (data) {
      const ids = new Set<number>();
      data.forEach((p: any) => {
        if (p.supplier_source?.provider === "ssactivewear" && p.supplier_source?.style_id) {
          ids.add(Number(p.supplier_source.style_id));
        }
      });
      setImportedStyleIds(ids);
    }
  };

  useEffect(() => {
    fetchIntegration();
    fetchImportedStyleIds();
  }, [user]);

  const getCredentials = () => {
    if (integration) {
      const creds = integration.credentials as any;
      return { account_number: creds.account_number, api_key: creds.api_key };
    }
    return { account_number: accountNumber.trim(), api_key: apiKey.trim() };
  };

  const handleConnect = async () => {
    if (!accountNumber.trim() || !apiKey.trim()) {
      toast({ title: "Enter both Account Number and API Key", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      // Test credentials by browsing
      const { data, error } = await supabase.functions.invoke("import-ssactivewear-products", {
        body: {
          action: "browse",
          account_number: accountNumber.trim(),
          api_key: apiKey.trim(),
          search: "t-shirt",
        },
      });
      if (error) throw error;

      // Save credentials
      const payload = {
        user_id: user?.id,
        platform: "ssactivewear" as const,
        store_url: "api.ssactivewear.com",
        credentials: { account_number: accountNumber.trim(), api_key: apiKey.trim() },
      };
      if (integration) {
        await supabase.from("store_integrations").update(payload).eq("id", integration.id);
      } else {
        await supabase.from("store_integrations").insert(payload);
      }
      toast({ title: "S&S Activewear connected successfully!" });
      await fetchIntegration();
    } catch (err: any) {
      toast({ title: "Connection failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const updateCategoriesFromStyles = (styles: any[]) => {
    const styleCategories = Array.from(
      new Set(styles.map((style: any) => style.baseCategory).filter(Boolean)),
    ) as string[];

    setCategories((prev) => {
      if (prev.length > 0) return prev;
      return styleCategories.sort();
    });
  };

  const handleBrowse = async (query?: string, page = 1, cat?: string) => {
    const creds = getCredentials();
    if (!creds.account_number || !creds.api_key) return;

    const nextSearch = query !== undefined ? query : appliedSearchQuery;
    const activeCat = cat !== undefined ? cat : categoryFilter;

    setBrowsing(true);
    if (page === 1) setSelectedStyleIds(new Set());

    try {
      const { data, error } = await supabase.functions.invoke("import-ssactivewear-products", {
        body: {
          action: "browse",
          ...creds,
          search: nextSearch.trim() || undefined,
          category: activeCat !== "all" ? activeCat : undefined,
          page,
          per_page: 50,
        },
      });
      if (error) throw error;

      const styles = data.styles || [];
      if (page === 1) {
        setCatalogResults(styles);
      } else {
        setCatalogResults((prev) => [...prev, ...styles]);
      }

      setAppliedSearchQuery(nextSearch);
      setCurrentPage(data.page || page);
      setTotalPages(data.total_pages || 1);
      setTotalResults(data.total || 0);
      setHasLoadedCatalog(true);
      updateCategoriesFromStyles(styles);

      if (!styles.length && page === 1) {
        toast({
          title: "No results found",
          description: nextSearch.trim()
            ? "Try a different search term or category."
            : "Try a different category.",
        });
      }
    } catch (err: any) {
      toast({ title: "Browse failed", description: err.message, variant: "destructive" });
    } finally {
      setBrowsing(false);
    }
  };

  const handleCategoryChange = (cat: string) => {
    setCategoryFilter(cat);
    handleBrowse(appliedSearchQuery, 1, cat);
  };

  // Auto-load catalog when connected
  useEffect(() => {
    if (integration && !hasLoadedCatalog) {
      handleBrowse("", 1, "all");
    }
  }, [integration]);

  const handleImportStyle = async (styleID: number) => {
    const creds = getCredentials();
    setImporting(styleID);
    try {
      const { data, error } = await supabase.functions.invoke("import-ssactivewear-products", {
        body: { action: "import", ...creds, style_id: styleID, user_id: user?.id },
      });
      if (error) throw error;
      toast({ title: `Imported! ${data.imported} new, ${data.updated} updated` });
      setImportedStyleIds((prev) => new Set(prev).add(styleID));
      setSelectedStyleIds((prev) => { const n = new Set(prev); n.delete(styleID); return n; });
      onDone();
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    } finally {
      setImporting(null);
    }
  };

  const handleBulkImport = async () => {
    if (selectedStyleIds.size === 0) return;
    const creds = getCredentials();
    setBulkImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("import-ssactivewear-products", {
        body: {
          action: "sync",
          ...creds,
          style_ids: Array.from(selectedStyleIds),
          user_id: user?.id,
        },
      });
      if (error) throw error;
      toast({ title: `Imported ${data.imported} new, ${data.updated} updated products` });
      setImportedStyleIds((prev) => {
        const n = new Set(prev);
        selectedStyleIds.forEach((id) => n.add(id));
        return n;
      });
      setSelectedStyleIds(new Set());
      onDone();
    } catch (err: any) {
      toast({ title: "Bulk import failed", description: err.message, variant: "destructive" });
    } finally {
      setBulkImporting(false);
    }
  };

  const toggleSelect = (styleID: number) => {
    setSelectedStyleIds((prev) => {
      const n = new Set(prev);
      if (n.has(styleID)) n.delete(styleID); else n.add(styleID);
      return n;
    });
  };

  const toggleSelectAll = () => {
    if (selectedStyleIds.size === catalogResults.length) {
      setSelectedStyleIds(new Set());
    } else {
      setSelectedStyleIds(new Set(catalogResults.map((s) => s.styleID)));
    }
  };

  const handleSyncAll = async () => {
    const creds = getCredentials();
    if (importedStyleIds.size === 0) {
      toast({ title: "No supplier products to sync" });
      return;
    }
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("import-ssactivewear-products", {
        body: {
          action: "sync",
          ...creds,
          style_ids: Array.from(importedStyleIds),
          user_id: user?.id,
        },
      });
      if (error) throw error;
      toast({ title: `Synced! ${data.imported} new, ${data.updated} updated` });
      await fetchIntegration();
      // Update last_synced_at
      if (integration) {
        await supabase.from("store_integrations").update({ last_synced_at: new Date().toISOString() }).eq("id", integration.id);
      }
      onDone();
    } catch (err: any) {
      toast({ title: "Sync failed", description: err.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!integration) return;
    setDisconnecting(true);
    await supabase.from("store_integrations").delete().eq("id", integration.id);
    setIntegration(null);
    setAccountNumber("");
    setApiKey("");
    setCatalogResults([]);
    setDisconnecting(false);
    toast({ title: "S&S Activewear disconnected" });
  };

  if (loadingIntegration) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (integration) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Truck className="h-5 w-5" /> S&S Activewear Connected
            </CardTitle>
            <CardDescription>
              Account: <strong>{(integration.credentials as any)?.account_number}</strong>
              {integration.last_synced_at && (
                <> · Last synced {new Date(integration.last_synced_at).toLocaleDateString()} at {new Date(integration.last_synced_at).toLocaleTimeString()}</>
              )}
              {importedStyleIds.size > 0 && (
                <> · <strong>{importedStyleIds.size}</strong> products imported</>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3 flex-wrap">
            <Button onClick={handleSyncAll} disabled={syncing || importedStyleIds.size === 0} className="gap-2">
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Sync All Prices
            </Button>
            <Button variant="outline" onClick={handleDisconnect} disabled={disconnecting} className="gap-2 text-destructive hover:text-destructive">
              {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
              Disconnect
            </Button>
          </CardContent>
        </Card>

        {/* Catalog Browser */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Browse S&S Catalog</CardTitle>
            <CardDescription>Search and import blank products from S&S Activewear</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search styles (e.g. 't-shirt', 'hoodie', 'Gildan 2000')"
                onKeyDown={(e) => e.key === "Enter" && handleBrowse(searchQuery, 1, categoryFilter)}
                className="flex-1"
              />
              {categories.length > 0 && (
                <Select value={categoryFilter} onValueChange={handleCategoryChange}>
                  <SelectTrigger className="w-[200px] shrink-0">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button onClick={() => handleBrowse(searchQuery, 1, categoryFilter)} disabled={browsing} className="gap-2 shrink-0">
                {browsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Search
              </Button>
              {(searchQuery || categoryFilter !== "all") && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => {
                    setSearchQuery("");
                    setCategoryFilter("all");
                    handleBrowse("", 1, "all");
                  }}
                  title="Clear filters"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>

            {browsing && catalogResults.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin" />
                <p className="text-sm">Loading S&amp;S Activewear catalog…</p>
              </div>
            )}

            {hasLoadedCatalog && totalResults > 0 && (
              <p className="text-xs text-muted-foreground">
                Showing {catalogResults.length} of {totalResults} results
                {currentPage < totalPages && " — load more below"}
              </p>
            )}

            {catalogResults.length > 0 && (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedStyleIds.size === catalogResults.length && catalogResults.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-input"
                      />
                      Select all ({catalogResults.length})
                    </label>
                    {selectedStyleIds.size > 0 && (
                      <span className="text-sm text-muted-foreground">{selectedStyleIds.size} selected</span>
                    )}
                  </div>
                  {selectedStyleIds.size > 0 && (
                    <Button onClick={handleBulkImport} disabled={bulkImporting} className="gap-2">
                      {bulkImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      Import {selectedStyleIds.size} Selected
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {catalogResults.map((style) => {
                    const isImported = importedStyleIds.has(style.styleID);
                    const isSelected = selectedStyleIds.has(style.styleID);
                    return (
                      <Card
                        key={style.styleID}
                        className={`overflow-hidden cursor-pointer transition-all ${isSelected ? "ring-2 ring-primary" : ""}`}
                        onClick={() => toggleSelect(style.styleID)}
                      >
                        <div className="aspect-square bg-muted relative">
                          {style.styleImage ? (
                            <img src={style.styleImage} alt={style.styleName} className="w-full h-full object-contain p-2" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="h-12 w-12 text-muted-foreground/40" />
                            </div>
                          )}
                          <div className="absolute top-2 left-2 flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => { e.stopPropagation(); toggleSelect(style.styleID); }}
                              className="rounded border-input h-4 w-4"
                            />
                            {isImported && (
                              <Badge variant="secondary">Imported</Badge>
                            )}
                          </div>
                          {style.baseCategory && (
                            <Badge variant="outline" className="absolute top-2 right-2 text-[10px] bg-background/80">
                              {style.baseCategory}
                            </Badge>
                          )}
                        </div>
                        <CardContent className="p-3 space-y-2">
                          <div>
                            <p className="text-xs text-muted-foreground">{style.brandName}</p>
                            <h4 className="font-semibold text-sm truncate">{style.styleName}</h4>
                            {style.title && <p className="text-xs text-muted-foreground truncate">{style.title}</p>}
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>${Number(style.customerPrice || 0).toFixed(2)}</span>
                              {style.colorCount > 0 && <span>· {style.colorCount} colors</span>}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5 h-8 text-xs"
                                onClick={(e) => { e.stopPropagation(); handleViewDetails(style.styleID); }}
                              >
                                <Eye className="h-3.5 w-3.5" />
                                Details
                              </Button>
                              <Button
                                size="sm"
                                variant={isImported ? "outline" : "default"}
                                className="gap-1.5 h-8 text-xs"
                                disabled={importing === style.styleID}
                                onClick={(e) => { e.stopPropagation(); handleImportStyle(style.styleID); }}
                              >
                                {importing === style.styleID ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : isImported ? (
                                  <RefreshCw className="h-3.5 w-3.5" />
                                ) : (
                                  <Download className="h-3.5 w-3.5" />
                                )}
                                {isImported ? "Re-import" : "Import"}
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
                {currentPage < totalPages && (
                  <div className="flex justify-center pt-2">
                    <Button
                      variant="outline"
                      onClick={() => handleBrowse(appliedSearchQuery, currentPage + 1, categoryFilter)}
                      disabled={browsing}
                      className="gap-2"
                    >
                      {browsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
                      Load More (Page {currentPage + 1} of {totalPages})
                    </Button>
                  </div>
                )}
              </>
            )}

            {!browsing && hasLoadedCatalog && catalogResults.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No products found. Try a different search term.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Variant Details Dialog */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {loadingDetails ? "Loading..." : detailStyle ? `${detailStyle.brandName} ${detailStyle.styleName}` : "Style Details"}
              </DialogTitle>
              {detailStyle?.title && (
                <DialogDescription>{detailStyle.title}</DialogDescription>
              )}
            </DialogHeader>
            {loadingDetails ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : detailStyle ? (
              <div className="space-y-4">
                {detailStyle.description && (
                  <p className="text-sm text-muted-foreground">{detailStyle.description}</p>
                )}
                <div className="text-sm">
                  <span className="font-medium">{detailStyle.variants?.length || 0}</span> colors available
                </div>
                <div className="space-y-3">
                  {detailStyle.variants?.map((variant: any, idx: number) => (
                    <div key={idx} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center gap-3">
                        {(variant.hex || variant.color) && (
                          <div
                            className="w-6 h-6 rounded-full border shadow-sm shrink-0"
                            style={{ backgroundColor: resolveVariantHex(variant) }}
                            title={variant.color || resolveVariantHex(variant)}
                          />
                        )}
                        {(variant.colorFrontImage || variant.image || variant.gallery?.[0]) && (
                          <img src={variant.colorFrontImage || variant.image || variant.gallery?.[0]} alt={variant.color} className="w-12 h-12 object-contain rounded bg-muted" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{variant.color}</p>
                          <p className="text-xs text-muted-foreground">{variant.sizes?.length || 0} sizes</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {variant.sizes?.map((s: any, sIdx: number) => (
                          <Badge key={sIdx} variant="secondary" className="text-[11px] font-normal gap-1">
                            {s.size}
                            <span className="text-muted-foreground">— ${Number(s.price).toFixed(2)}</span>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">How to get your S&S Activewear credentials</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ol className="list-decimal list-inside space-y-2">
            <li>Log in to your <strong className="text-foreground">S&S Activewear</strong> account at <code className="text-xs bg-muted px-1.5 py-0.5 rounded">ssactivewear.com</code></li>
            <li>Go to <strong className="text-foreground">My Account → API Access</strong></li>
            <li>Your <strong className="text-foreground">Account Number</strong> is shown at the top of your account page</li>
            <li>Generate or copy your <strong className="text-foreground">API Key</strong> from the API Access section</li>
          </ol>
          <p className="text-xs text-muted-foreground/70">Need an account? Visit <a href="https://www.ssactivewear.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">ssactivewear.com</a> to register as a distributor.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Truck className="h-5 w-5" /> Connect S&S Activewear</CardTitle>
          <CardDescription>Enter your S&S Activewear account number and API key to browse and import products.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Account Number</Label>
            <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="Your S&S account number" />
          </div>
          <div className="space-y-2">
            <Label>API Key</Label>
            <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} type="password" placeholder="Your API key" />
          </div>
          <Button onClick={handleConnect} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            Connect
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function SanMarImport({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const [sanmarUsername, setSanmarUsername] = useState("");
  const [sanmarPassword, setSanmarPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [integration, setIntegration] = useState<any>(null);
  const [loadingIntegration, setLoadingIntegration] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [appliedSearchQuery, setAppliedSearchQuery] = useState("");
  const [catalogResults, setCatalogResults] = useState<any[]>([]);
  const [browsing, setBrowsing] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [importedStyleIds, setImportedStyleIds] = useState<Set<string>>(new Set());
  const [selectedStyleIds, setSelectedStyleIds] = useState<Set<string>>(new Set());
  const [bulkImporting, setBulkImporting] = useState(false);
  const [hasLoadedCatalog, setHasLoadedCatalog] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [categories, setCategories] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [detailStyle, setDetailStyle] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvProgress, setCsvProgress] = useState<{ total: number; imported: number; updated: number } | null>(null);

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    e.target.value = "";
    setCsvImporting(true);
    setCsvProgress(null);

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) { toast({ title: "Empty or invalid CSV file", variant: "destructive" }); setCsvImporting(false); return; }

      // Detect delimiter (tab for .txt files like sanmar_dip.txt, comma for .csv)
      const firstLine = lines[0];
      const delimiter = firstLine.includes("\t") ? "\t" : ",";

      // Parse header to find column indices
      const headers = firstLine.split(delimiter).map((h) => h.trim().replace(/^"|"$/g, "").toUpperCase());

      // Map known SanMar column names to indices
      const col = (name: string) => {
        const idx = headers.indexOf(name);
        return idx;
      };

      const iStyle = col("STYLE#") !== -1 ? col("STYLE#") : col("STYLE");
      const iUniqueKey = col("UNIQUE_KEY");
      const iTitle = col("PRODUCT_TITLE");
      const iDesc = col("PRODUCT_DESCRIPTION");
      const iBrand = col("BRAND_NAME");
      const iColor = col("COLOR_NAME");
      const iCatalogColor = col("CATALOG_COLOR");
      const iSize = col("SIZE");
      const iPiecePrice = col("PIECE_PRICE");
      const iCasePrice = col("CASE_PRICE");
      const iPieceSalePrice = col("PIECE_SALE_PRICE");
      const iCaseSalePrice = col("CASE_SALE_PRICE");
      const iCategory = col("CATEGORY");
      const iProductImage = col("PRODUCT_IMAGE");
      const iColorProductImage = col("COLOR_PRODUCT_IMAGE");
      const iFrontModel = col("FRONT_MODEL");
      const iBackModel = col("BACK_MODEL");
      const iSideModel = col("SIDE_MODEL");
      const iFrontFlat = col("FRONT_FLAT");
      const iBackFlat = col("BACK_FLAT");
      const iColorSwatchImage = col("COLOR_SWATCH_IMAGE");
      const iColorSquareImage = col("COLOR_SQUARE_IMAGE");
      const iProductStatus = col("PRODUCT_STATUS");
      const iInventoryKey = col("INVENTORY_KEY");

      if (iStyle === -1) {
        toast({ title: "Could not find STYLE# column", description: "Make sure this is a SanMar product data CSV (SDL, EPDD, or BulkInfo format).", variant: "destructive" });
        setCsvImporting(false);
        return;
      }

      // Parse CSV values (handles quoted fields)
      const parseRow = (line: string): string[] => {
        const vals: string[] = [];
        let current = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') { inQuotes = !inQuotes; continue; }
          if (ch === delimiter.charAt(0) && !inQuotes) { vals.push(current.trim()); current = ""; continue; }
          current += ch;
        }
        vals.push(current.trim());
        return vals;
      };

      const getVal = (row: string[], idx: number) => (idx >= 0 && idx < row.length ? row[idx] : "");

      // Group rows by style
      const styleMap = new Map<string, any[]>();
      for (let i = 1; i < lines.length; i++) {
        const row = parseRow(lines[i]);
        const style = getVal(row, iStyle);
        if (!style) continue;
        // Skip discontinued unless they have inventory
        const status = getVal(row, iProductStatus);
        if (status === "Discontinued") continue;
        if (!styleMap.has(style)) styleMap.set(style, []);
        styleMap.get(style)!.push(row);
      }

      const totalStyles = styleMap.size;
      let imported = 0;
      let updated = 0;

      setCsvProgress({ total: totalStyles, imported: 0, updated: 0 });

      // Process in batches
      const entries = Array.from(styleMap.entries());
      for (let batch = 0; batch < entries.length; batch += 10) {
        const chunk = entries.slice(batch, batch + 10);
        await Promise.all(chunk.map(async ([styleId, rows]) => {
          const firstRow = rows[0];
          const brandName = getVal(firstRow, iBrand) || "SanMar";
          const productTitle = getVal(firstRow, iTitle) || "";
          const description = getVal(firstRow, iDesc) || "";
          const category = getVal(firstRow, iCategory) || "Apparel";

          // Group by color
          const colorMap = new Map<string, any[]>();
          for (const row of rows) {
            const colorName = getVal(row, iColor) || getVal(row, iCatalogColor) || "Default";
            if (!colorMap.has(colorName)) colorMap.set(colorName, []);
            colorMap.get(colorName)!.push(row);
          }

          const variants = Array.from(colorMap.entries()).map(([colorName, skus]) => {
            const first = skus[0];
            return {
              color: colorName,
              hex: null,
              image: getVal(first, iColorProductImage) || getVal(first, iFrontModel) || null,
              sizes: skus.map((s) => ({
                size: getVal(s, iSize) || "OS",
                sku: getVal(s, iUniqueKey) || getVal(s, iInventoryKey) || `${styleId}-${colorName}-${getVal(s, iSize) || "OS"}`,
                price: parseFloat(getVal(s, iPiecePrice) || "0"),
                casePrice: parseFloat(getVal(s, iCasePrice) || "0"),
                salePrice: parseFloat(getVal(s, iPieceSalePrice) || "0"),
                qty: 0,
              })),
            };
          });

          const imageFront = getVal(firstRow, iColorProductImage) || getVal(firstRow, iFrontModel) || getVal(firstRow, iProductImage) || null;
          const imageBack = getVal(firstRow, iBackModel) || getVal(firstRow, iBackFlat) || null;

          const supplierSource = {
            provider: "sanmar",
            style_id: styleId,
            style_name: styleId,
            brand: brandName,
            last_synced: new Date().toISOString(),
            import_method: "csv",
          };

          const { data: existing } = await supabase
            .from("inventory_products")
            .select("id")
            .eq("user_id", user.id)
            .filter("supplier_source->>provider", "eq", "sanmar")
            .filter("supplier_source->>style_id", "eq", styleId)
            .maybeSingle();

          const payload = {
            name: `${brandName} ${styleId}`.trim(),
            category: category.toLowerCase() || "apparel",
            description: productTitle || description || null,
            base_price: parseFloat(getVal(firstRow, iPiecePrice) || "0"),
            image_front: imageFront,
            image_back: imageBack,
            image_side1: getVal(firstRow, iSideModel) || null,
            image_side2: null as string | null,
            variants,
            is_active: true,
            supplier_source: supplierSource,
            user_id: user.id,
          };

          if (existing) {
            await supabase.from("inventory_products").update(payload).eq("id", existing.id);
            updated++;
          } else {
            await supabase.from("inventory_products").insert(payload);
            imported++;
          }
          setCsvProgress({ total: totalStyles, imported, updated });
        }));
      }

      toast({ title: `CSV Import Complete`, description: `${imported} new products imported, ${updated} updated out of ${totalStyles} styles.` });
      setCsvProgress(null);
      onDone();
      fetchImportedStyleIds();
    } catch (err: any) {
      toast({ title: "CSV import failed", description: err.message, variant: "destructive" });
    } finally {
      setCsvImporting(false);
    }
  };

  const handleViewDetails = async (styleID: string) => {
    const creds = getCredentials();
    setDetailsOpen(true);
    setLoadingDetails(true);
    setDetailStyle(null);
    try {
      const { data, error } = await supabase.functions.invoke("import-sanmar-products", {
        body: { action: "details", ...creds, style_id: styleID },
      });
      if (error) throw error;
      setDetailStyle(data);
    } catch (err: any) {
      toast({ title: "Failed to load details", description: err.message, variant: "destructive" });
      setDetailsOpen(false);
    } finally {
      setLoadingDetails(false);
    }
  };

  const fetchIntegration = async () => {
    if (!user) return;
    setLoadingIntegration(true);
    const { data } = await supabase.from("store_integrations").select("*").eq("user_id", user.id).eq("platform", "sanmar").maybeSingle();
    setIntegration(data);
    if (data) {
      setSanmarUsername((data.credentials as any)?.username || "");
      setSanmarPassword((data.credentials as any)?.password || "");
    }
    setLoadingIntegration(false);
  };

  const fetchImportedStyleIds = async () => {
    if (!user) return;
    const { data } = await supabase.from("inventory_products").select("supplier_source").eq("user_id", user.id).not("supplier_source", "is", null);
    if (data) {
      const ids = new Set<string>();
      data.forEach((p: any) => {
        if (p.supplier_source?.provider === "sanmar" && p.supplier_source?.style_id) ids.add(String(p.supplier_source.style_id));
      });
      setImportedStyleIds(ids);
    }
  };

  useEffect(() => { fetchIntegration(); fetchImportedStyleIds(); }, [user]);

  const getCredentials = () => {
    if (integration) {
      const creds = integration.credentials as any;
      return { username: creds.username, password: creds.password };
    }
    return { username: sanmarUsername.trim(), password: sanmarPassword.trim() };
  };

  const handleConnect = async () => {
    if (!sanmarUsername.trim() || !sanmarPassword.trim()) { toast({ title: "Enter Username and Password", variant: "destructive" }); return; }
    setLoading(true);
    try {
      // Save credentials — validation happens when the user searches the catalog
      const payload = { user_id: user?.id, platform: "sanmar" as const, store_url: "ws.sanmar.com", credentials: { username: sanmarUsername.trim(), password: sanmarPassword.trim() } };
      const { error: insertError } = integration
        ? await supabase.from("store_integrations").update(payload).eq("id", integration.id)
        : await supabase.from("store_integrations").insert(payload);
      if (insertError) throw new Error(insertError.message);
      toast({ title: "SanMar credentials saved!", description: "Search the catalog below to browse products." });
      await fetchIntegration();
    } catch (err: any) { toast({ title: "Connection failed", description: err.message, variant: "destructive" }); } finally { setLoading(false); }
  };

  const handleBrowse = async (query?: string, page = 1, cat?: string) => {
    const creds = getCredentials();
    if (!creds.username || !creds.password) return;
    const nextSearch = query !== undefined ? query : appliedSearchQuery;
    const activeCat = cat !== undefined ? cat : categoryFilter;
    setBrowsing(true);
    if (page === 1) setSelectedStyleIds(new Set());
    try {
      const { data, error } = await supabase.functions.invoke("import-sanmar-products", { body: { action: "browse", ...creds, search: nextSearch.trim() || undefined, category: activeCat !== "all" ? activeCat : undefined, page, per_page: 50 } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const styles = data.styles || [];
      if (page === 1) setCatalogResults(styles); else setCatalogResults((prev) => [...prev, ...styles]);
      setAppliedSearchQuery(nextSearch); setCurrentPage(data.page || page); setTotalPages(data.total_pages || 1); setTotalResults(data.total || 0); setHasLoadedCatalog(true);
      if (!styles.length && page === 1) toast({ title: "No results found", description: nextSearch.trim() ? "Try a different search term or category." : "Try a different category." });
    } catch (err: any) { toast({ title: "Browse failed", description: err.message, variant: "destructive" }); } finally { setBrowsing(false); }
  };

  // Curated list of popular SanMar style numbers.
  // Used to populate the catalog grid on first load (SanMar's API doesn't support keyword search).
  const POPULAR_SANMAR_STYLES = [
    // T-Shirts
    "PC61", "PC54", "PC55", "PC450", "DT6000", "BC3001", "G500", "G800", "ST350", "PC78",
    // Polos
    "K500", "K420", "L500", "ST650", "K100",
    // Hoodies & Sweatshirts
    "PC78H", "PC90H", "ST254", "F170", "DT6100",
    // Outerwear & Jackets
    "J317", "J790", "JST50", "F217",
    // Headwear
    "C112", "STC12", "NE1000", "C913",
    // Bags
    "BG200", "BG408",
    // Ladies / V-neck
    "LPC54V", "LPC61",
  ];

  const loadPopularStyles = async () => {
    const creds = getCredentials();
    if (!creds.username || !creds.password) return;
    setBrowsing(true);
    setSelectedStyleIds(new Set());
    try {
      const results = await Promise.all(
        POPULAR_SANMAR_STYLES.map(async (styleId) => {
          try {
            const { data } = await supabase.functions.invoke("import-sanmar-products", {
              body: { action: "browse", ...creds, search: styleId, page: 1, per_page: 1 },
            });
            return data?.styles?.[0] || null;
          } catch {
            return null;
          }
        })
      );
      const styles = results.filter(Boolean);
      setCatalogResults(styles);
      setAppliedSearchQuery("");
      setCurrentPage(1);
      setTotalPages(1);
      setTotalResults(styles.length);
      setHasLoadedCatalog(true);
      if (!styles.length) toast({ title: "Could not load popular styles", description: "Check your SanMar API access.", variant: "destructive" });
    } catch (err: any) {
      toast({ title: "Failed to load popular styles", description: err.message, variant: "destructive" });
    } finally {
      setBrowsing(false);
    }
  };

  const handleCategoryChange = (cat: string) => { setCategoryFilter(cat); handleBrowse(appliedSearchQuery, 1, cat); };
  useEffect(() => { if (integration && !hasLoadedCatalog) { loadPopularStyles(); } }, [integration]);
  useEffect(() => { if (!integration) return; supabase.functions.invoke("import-sanmar-products", { body: { action: "categories", ...getCredentials() } }).then(({ data }) => { if (data?.categories) setCategories(data.categories); }); }, [integration]);

  const handleImportStyle = async (styleID: string) => {
    const creds = getCredentials(); setImporting(styleID);
    try {
      const { data, error } = await supabase.functions.invoke("import-sanmar-products", { body: { action: "import", ...creds, style_id: styleID, user_id: user?.id } });
      if (error) throw error;
      toast({ title: `Imported! ${data.imported} new, ${data.updated} updated` });
      setImportedStyleIds((prev) => new Set(prev).add(styleID));
      setSelectedStyleIds((prev) => { const n = new Set(prev); n.delete(styleID); return n; });
      onDone();
    } catch (err: any) { toast({ title: "Import failed", description: err.message, variant: "destructive" }); } finally { setImporting(null); }
  };

  const handleBulkImport = async () => {
    if (selectedStyleIds.size === 0) return;
    const creds = getCredentials(); setBulkImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("import-sanmar-products", { body: { action: "sync", ...creds, style_ids: Array.from(selectedStyleIds), user_id: user?.id } });
      if (error) throw error;
      toast({ title: `Imported ${data.imported} new, ${data.updated} updated products` });
      setImportedStyleIds((prev) => { const n = new Set(prev); selectedStyleIds.forEach((id) => n.add(id)); return n; });
      setSelectedStyleIds(new Set()); onDone();
    } catch (err: any) { toast({ title: "Bulk import failed", description: err.message, variant: "destructive" }); } finally { setBulkImporting(false); }
  };

  const toggleSelect = (styleID: string) => { setSelectedStyleIds((prev) => { const n = new Set(prev); if (n.has(styleID)) n.delete(styleID); else n.add(styleID); return n; }); };
  const toggleSelectAll = () => { if (selectedStyleIds.size === catalogResults.length) setSelectedStyleIds(new Set()); else setSelectedStyleIds(new Set(catalogResults.map((s) => s.styleID))); };

  const handleSyncAll = async () => {
    const creds = getCredentials();
    if (importedStyleIds.size === 0) { toast({ title: "No supplier products to sync" }); return; }
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("import-sanmar-products", { body: { action: "sync", ...creds, style_ids: Array.from(importedStyleIds), user_id: user?.id } });
      if (error) throw error;
      toast({ title: `Synced! ${data.imported} new, ${data.updated} updated` });
      if (integration) await supabase.from("store_integrations").update({ last_synced_at: new Date().toISOString() }).eq("id", integration.id);
      onDone();
    } catch (err: any) { toast({ title: "Sync failed", description: err.message, variant: "destructive" }); } finally { setSyncing(false); }
  };

  const handleDisconnect = async () => {
    if (!integration) return; setDisconnecting(true);
    await supabase.from("store_integrations").delete().eq("id", integration.id);
    setIntegration(null); setSanmarUsername(""); setSanmarPassword(""); setCatalogResults([]); setDisconnecting(false);
    toast({ title: "SanMar disconnected" });
  };

  if (loadingIntegration) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  if (integration) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Package className="h-5 w-5" /> SanMar Connected</CardTitle>
            <CardDescription>
              Account: <strong>{(integration.credentials as any)?.username}</strong>
              {integration.last_synced_at && <> · Last synced {new Date(integration.last_synced_at).toLocaleDateString()} at {new Date(integration.last_synced_at).toLocaleTimeString()}</>}
              {importedStyleIds.size > 0 && <> · <strong>{importedStyleIds.size}</strong> products imported</>}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3 flex-wrap">
            <Button onClick={handleSyncAll} disabled={syncing || importedStyleIds.size === 0} className="gap-2">
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Sync All Prices
            </Button>
            <Button variant="outline" onClick={handleDisconnect} disabled={disconnecting} className="gap-2 text-destructive hover:text-destructive">
              {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />} Disconnect
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Browse SanMar Catalog</CardTitle>
            <CardDescription>Popular styles load automatically. Search by style number for anything else.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Enter a style number (e.g. PC61, DT6000, ST350)" onKeyDown={(e) => e.key === "Enter" && handleBrowse(searchQuery, 1, categoryFilter)} className="flex-1" />
              {categories.length > 0 && (
                <Select value={categoryFilter} onValueChange={handleCategoryChange}>
                  <SelectTrigger className="w-[200px] shrink-0"><SelectValue placeholder="Category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <Button onClick={() => handleBrowse(searchQuery, 1, categoryFilter)} disabled={browsing} className="gap-2 shrink-0">
                {browsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Search
              </Button>
              <Button variant="outline" onClick={loadPopularStyles} disabled={browsing} className="gap-2 shrink-0" title="Show curated popular styles">
                <Package className="h-4 w-4" /> Popular
              </Button>
              {(searchQuery || categoryFilter !== "all") && (
                <Button variant="ghost" size="icon" className="shrink-0" onClick={() => { setSearchQuery(""); setCategoryFilter("all"); loadPopularStyles(); }} title="Clear filters"><Trash2 className="h-4 w-4" /></Button>
              )}
            </div>
            {browsing && catalogResults.length === 0 && (
              <div className="text-center py-12 text-muted-foreground"><Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin" /><p className="text-sm">Loading popular SanMar styles…</p></div>
            )}
            {hasLoadedCatalog && totalResults > 0 && <p className="text-xs text-muted-foreground">Showing {catalogResults.length} of {totalResults} results{currentPage < totalPages && " — load more below"}</p>}
            {catalogResults.length > 0 && (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={selectedStyleIds.size === catalogResults.length && catalogResults.length > 0} onChange={toggleSelectAll} className="rounded border-input" />
                      Select all ({catalogResults.length})
                    </label>
                    {selectedStyleIds.size > 0 && <span className="text-sm text-muted-foreground">{selectedStyleIds.size} selected</span>}
                  </div>
                  {selectedStyleIds.size > 0 && (
                    <Button onClick={handleBulkImport} disabled={bulkImporting} className="gap-2">
                      {bulkImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Import {selectedStyleIds.size} Selected
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {catalogResults.map((style) => {
                    const isImported = importedStyleIds.has(style.styleID);
                    const isSelected = selectedStyleIds.has(style.styleID);
                    return (
                      <Card key={style.styleID} className={`overflow-hidden cursor-pointer transition-all ${isSelected ? "ring-2 ring-primary" : ""}`} onClick={() => toggleSelect(style.styleID)}>
                        <div className="aspect-square bg-muted relative">
                          {style.styleImage ? <img src={style.styleImage} alt={style.styleName} className="w-full h-full object-contain p-2" /> : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="h-12 w-12 text-muted-foreground/40" /></div>}
                          <div className="absolute top-2 left-2 flex items-center gap-2">
                            <input type="checkbox" checked={isSelected} onChange={(e) => { e.stopPropagation(); toggleSelect(style.styleID); }} className="rounded border-input h-4 w-4" />
                            {isImported && <Badge variant="secondary">Imported</Badge>}
                          </div>
                          {style.baseCategory && <Badge variant="outline" className="absolute top-2 right-2 text-[10px] bg-background/80">{style.baseCategory}</Badge>}
                        </div>
                        <CardContent className="p-3 space-y-2">
                          <div>
                            <p className="text-xs text-muted-foreground">{style.brandName}</p>
                            <h4 className="font-semibold text-sm truncate">{style.styleName}</h4>
                            {style.title && <p className="text-xs text-muted-foreground truncate">{style.title}</p>}
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>${Number(style.customerPrice || 0).toFixed(2)}</span>
                              {style.colorCount > 0 && <span>· {style.colorCount} colors</span>}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={(e) => { e.stopPropagation(); handleViewDetails(style.styleID); }}><Eye className="h-3.5 w-3.5" /> Details</Button>
                              <Button size="sm" variant={isImported ? "outline" : "default"} className="gap-1.5 h-8 text-xs" disabled={importing === style.styleID} onClick={(e) => { e.stopPropagation(); handleImportStyle(style.styleID); }}>
                                {importing === style.styleID ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isImported ? <RefreshCw className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
                                {isImported ? "Re-import" : "Import"}
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
                {currentPage < totalPages && (
                  <div className="flex justify-center pt-2">
                    <Button variant="outline" onClick={() => handleBrowse(appliedSearchQuery, currentPage + 1, categoryFilter)} disabled={browsing} className="gap-2">
                      {browsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />} Load More (Page {currentPage + 1} of {totalPages})
                    </Button>
                  </div>
                )}
              </>
            )}
            {!browsing && catalogResults.length === 0 && (
              <div className="text-center py-8 text-muted-foreground space-y-3">
                <Search className="h-10 w-10 mx-auto opacity-40" />
                <p className="text-sm">Search by style number or load curated popular styles to get started.</p>
                <Button onClick={loadPopularStyles} className="gap-2"><Package className="h-4 w-4" /> Load Popular Styles</Button>
                <p className="text-xs text-muted-foreground/60 pt-1">Note: SanMar's API only supports exact style number lookups, not keyword search.</p>
              </div>
            )}
          </CardContent>
        </Card>
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{loadingDetails ? "Loading..." : detailStyle ? `${detailStyle.brandName} ${detailStyle.styleName}` : "Style Details"}</DialogTitle>
              {detailStyle?.title && <DialogDescription>{detailStyle.title}</DialogDescription>}
            </DialogHeader>
            {loadingDetails ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div> : detailStyle ? (
              <div className="space-y-4">
                {detailStyle.description && <p className="text-sm text-muted-foreground">{detailStyle.description}</p>}
                <div className="text-sm"><span className="font-medium">{detailStyle.variants?.length || 0}</span> colors available</div>
                <div className="space-y-3">
                  {detailStyle.variants?.map((variant: any, idx: number) => (
                    <div key={idx} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center gap-3">
                        {<div className="w-6 h-6 rounded-full border shadow-sm shrink-0" style={{ backgroundColor: resolveVariantHex(variant) }} title={resolveVariantHex(variant)} />}
                        {(variant.colorFrontImage || variant.image || variant.gallery?.[0]) && <img src={variant.colorFrontImage || variant.image || variant.gallery?.[0]} alt={variant.color} className="w-12 h-12 object-contain rounded bg-muted" />}
                        <div className="flex-1 min-w-0"><p className="font-medium text-sm">{variant.color}</p><p className="text-xs text-muted-foreground">{variant.sizes?.length || 0} sizes</p></div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {variant.sizes?.map((s: any, sIdx: number) => <Badge key={sIdx} variant="secondary" className="text-[11px] font-normal gap-1">{s.size} <span className="text-muted-foreground">— ${Number(s.price).toFixed(2)}</span></Badge>)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-dashed">
        <CardHeader className="pb-3"><CardTitle className="text-base">How to get your SanMar credentials</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ol className="list-decimal list-inside space-y-2">
            <li>You need a <strong className="text-foreground">SanMar distributor account</strong>. If you don't have one, register at <a href="https://www.sanmar.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">sanmar.com</a></li>
            <li>Your <strong className="text-foreground">Customer Number</strong> is your SanMar account number</li>
            <li>Your <strong className="text-foreground">Username</strong> and <strong className="text-foreground">Password</strong> are your SanMar.com login credentials</li>
            <li>To enable API access, email <strong className="text-foreground">sanmarintegrations@sanmar.com</strong> with your customer number</li>
          </ol>
          <p className="text-xs text-muted-foreground/70">SanMar will send an integration agreement for e-signature. Access is typically enabled within 1-2 business days.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Upload className="h-4 w-4" /> Import from CSV / SFTP File</CardTitle>
          <CardDescription>Already have product data files from SanMar's SFTP? Upload them directly — no API connection needed.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <label className="cursor-pointer">
              <input type="file" accept=".csv,.txt,.tsv" onChange={handleCsvUpload} className="hidden" disabled={csvImporting} />
              <Button variant="outline" className="gap-2 pointer-events-none" disabled={csvImporting}>
                {csvImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {csvImporting ? "Importing..." : "Choose CSV File"}
              </Button>
            </label>
            <span className="text-xs text-muted-foreground">Supports .csv, .txt, .tsv (SDL, EPDD, BulkInfo, sanmar_dip.txt)</span>
          </div>
          {csvProgress && (
            <div className="space-y-1.5">
              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${Math.round(((csvProgress.imported + csvProgress.updated) / Math.max(csvProgress.total, 1)) * 100)}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">
                Processing {csvProgress.imported + csvProgress.updated} of {csvProgress.total} styles ({csvProgress.imported} new, {csvProgress.updated} updated)
              </p>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            <strong>SFTP access:</strong> Host: ftp.sanmar.com · Port: 2200 · Protocol: SFTP. Download files using an SFTP client (FileZilla, WinSCP), then upload here.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Package className="h-5 w-5" /> Connect SanMar API</CardTitle>
          <CardDescription>Or connect via API to browse and import products directly (requires Web Services access).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2"><Label>SanMar.com Username</Label><Input value={sanmarUsername} onChange={(e) => setSanmarUsername(e.target.value)} placeholder="Your SanMar.com username" /></div>
          <div className="space-y-2"><Label>SanMar.com Password</Label><Input value={sanmarPassword} onChange={(e) => setSanmarPassword(e.target.value)} type="password" placeholder="Your SanMar.com password" /></div>
          <Button onClick={handleConnect} disabled={loading} className="gap-2">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Connect</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function ProductCardImage({ product, hasVariantImages, children }: { product: Product; hasVariantImages: boolean; children: React.ReactNode }) {
  const [activeVariantIdx, setActiveVariantIdx] = useState<number | null>(null);
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const activeImage = activeVariantIdx !== null && variants[activeVariantIdx]?.image
    ? variants[activeVariantIdx].image
    : product.image_front;

  return (
    <div className="aspect-square bg-white relative">
      {activeImage ? (
        <img src={activeImage} alt={product.name} className="w-full h-full object-contain p-1 transition-all" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <ImageIcon className="h-12 w-12 text-muted-foreground/40" />
        </div>
      )}
      {children}
    </div>
  );
}

// ============ Variant Manager Dialog (Shopify-style) ============
function VariantManagerDialog({
  product,
  onClose,
  onSaved,
}: {
  product: Product | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [variants, setVariants] = useState<any[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (product && Array.isArray(product.variants)) {
      // Ensure each variant has a pricing object
      const normalized = product.variants.map((v: any) => ({
        ...v,
        pricing: v.pricing || { margin: 0, embroidery_fee: 0, dtg_fee: 0 },
      }));
      setVariants(normalized);
      setSelectedIdx(0);
    } else {
      setVariants([]);
    }
  }, [product?.id]);

  if (!product) return null;

  const selected = variants[selectedIdx];

  // Derive per-variant base cost from its SKU prices (min non-zero), so switching
  // colors reflects the actual cost (e.g. 2XL upcharge), with product.base_price as fallback.
  const variantBaseCost = (v: any): number => {
    const sizes = Array.isArray(v?.sizes) ? v.sizes : [];
    const prices = sizes
      .map((s: any) => Number(s?.price) || 0)
      .filter((n: number) => n > 0);
    if (prices.length > 0) return Math.min(...prices);
    return Number(product.base_price) || 0;
  };
  const baseCost = selected ? variantBaseCost(selected) : Number(product.base_price) || 0;

  const updateVariant = (idx: number, patch: any) => {
    setVariants((prev) => prev.map((v, i) => (i === idx ? { ...v, ...patch } : v)));
  };

  const updatePricing = (idx: number, field: "margin" | "embroidery_fee" | "dtg_fee", value: number) => {
    setVariants((prev) =>
      prev.map((v, i) =>
        i === idx ? { ...v, pricing: { ...(v.pricing || {}), [field]: value } } : v
      )
    );
  };

  const updateSize = (vIdx: number, sIdx: number, patch: any) => {
    setVariants((prev) =>
      prev.map((v, i) => {
        if (i !== vIdx) return v;
        const sizes = [...(v.sizes || [])];
        sizes[sIdx] = { ...sizes[sIdx], ...patch };
        return { ...v, sizes };
      })
    );
  };

  const computeFinalPrice = (v: any) => {
    const p = v?.pricing || {};
    const cost = variantBaseCost(v);
    return cost + Number(p.margin || 0) + Number(p.embroidery_fee || 0) + Number(p.dtg_fee || 0);
  };

  const applyPricingToAll = () => {
    if (!selected?.pricing) return;
    const src = selected.pricing;
    const finalPrice = computeFinalPrice(selected);
    setVariants((prev) =>
      prev.map((v) => ({
        ...v,
        pricing: { ...src },
        sizes: (v.sizes || []).map((s: any) => ({ ...s, price: finalPrice })),
      }))
    );
    toast({ title: "Pricing applied to all colors" });
  };

  const applyFinalPriceToVariantSizes = (vIdx: number) => {
    const v = variants[vIdx];
    const finalPrice = computeFinalPrice(v);
    setVariants((prev) =>
      prev.map((vv, i) =>
        i === vIdx
          ? { ...vv, sizes: (vv.sizes || []).map((s: any) => ({ ...s, price: finalPrice })) }
          : vv
      )
    );
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("inventory_products")
      .update({ variants })
      .eq("id", product.id);
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Variant prices updated" });
      onSaved();
    }
  };

  return (
    <Dialog open={!!product} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-[1280px] p-0 gap-0 overflow-hidden h-[85vh] flex flex-col">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate">{product.name}</DialogTitle>
              <DialogDescription className="mt-1">
                {product.category} · {variants.length} color{variants.length !== 1 ? "s" : ""} · Base cost ${baseCost.toFixed(2)}
              </DialogDescription>
            </div>
            <Button size="sm" variant="outline" onClick={applyPricingToAll} disabled={!selected}>
              Apply pricing to all colors
            </Button>
          </div>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          {/* Left rail: color list */}
          <div className="w-72 border-r overflow-y-auto shrink-0 bg-muted/20">
            {variants.map((v, idx) => {
              const img = v.image || v.colorFrontImage || v.colorSwatchImage;
              const isSelected = idx === selectedIdx;
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedIdx(idx)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left border-b transition-colors ${
                    isSelected ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-muted/40"
                  }`}
                >
                  <div
                    className="w-5 h-5 rounded-full border shrink-0"
                    style={{ backgroundColor: resolveVariantHex(v) }}
                  />
                  {img ? (
                    <img src={img} alt={v.color} className="w-10 h-10 object-contain rounded bg-background border shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded bg-background border flex items-center justify-center shrink-0">
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{v.color || "—"}</p>
                    <p className="text-xs text-muted-foreground">{v.sizes?.length || 0} sizes</p>
                  </div>
                </button>
              );
            })}
            {variants.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">No variants</div>
            )}
          </div>

          {/* Right pane: selected variant detail */}
          <div className="flex-1 overflow-y-auto p-6">
            {selected ? (
              <div className="space-y-6">
                {/* Image + color header */}
                <div className="flex gap-6">
                  <div className="w-64 h-64 rounded-lg border bg-muted/20 flex items-center justify-center overflow-hidden shrink-0">
                    {(selected.image || selected.colorFrontImage) ? (
                      <img
                        src={selected.image || selected.colorFrontImage}
                        alt={selected.color}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <ImageIcon className="h-12 w-12 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-full border"
                        style={{ backgroundColor: resolveVariantHex(selected) }}
                      />
                      <h3 className="text-lg font-semibold">{selected.color}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {selected.sizes?.length || 0} size{selected.sizes?.length !== 1 ? "s" : ""}
                    </p>

                    {/* Pricing block */}
                    <div className="rounded-lg border p-4 space-y-3 bg-muted/10">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Pricing
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Base cost</Label>
                          <Input
                            type="text"
                            value={`$${baseCost.toFixed(2)}`}
                            readOnly
                            className="h-9 mt-1 bg-muted"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Profit margin ($)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={selected.pricing?.margin ?? 0}
                            onChange={(e) =>
                              updatePricing(selectedIdx, "margin", parseFloat(e.target.value) || 0)
                            }
                            className="h-9 mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Embroidery fee ($)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={selected.pricing?.embroidery_fee ?? 0}
                            onChange={(e) =>
                              updatePricing(selectedIdx, "embroidery_fee", parseFloat(e.target.value) || 0)
                            }
                            className="h-9 mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">DTG fee ($)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={selected.pricing?.dtg_fee ?? 0}
                            onChange={(e) =>
                              updatePricing(selectedIdx, "dtg_fee", parseFloat(e.target.value) || 0)
                            }
                            className="h-9 mt-1"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t">
                        <div>
                          <p className="text-xs text-muted-foreground">Final price</p>
                          <p className="text-2xl font-bold text-primary">
                            ${computeFinalPrice(selected).toFixed(2)}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => applyFinalPriceToVariantSizes(selectedIdx)}
                        >
                          Apply to all sizes
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sizes grid */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Sizes
                  </Label>
                  <div className="rounded-lg border overflow-hidden">
                    <div className="grid grid-cols-[1fr,2fr,1fr] gap-3 px-3 py-2 bg-muted/40 text-xs font-medium text-muted-foreground border-b">
                      <span>Size</span>
                      <span>SKU</span>
                      <span className="text-right">Price ($)</span>
                    </div>
                    {selected.sizes?.length ? (
                      selected.sizes.map((s: any, sIdx: number) => (
                        <div key={sIdx} className="grid grid-cols-[1fr,2fr,1fr] gap-3 px-3 py-2 border-b last:border-b-0 items-center">
                          <span className="text-sm font-medium">{s.size || "—"}</span>
                          <Input
                            value={s.sku || ""}
                            onChange={(e) => updateSize(selectedIdx, sIdx, { sku: e.target.value })}
                            className="h-8 text-xs"
                            placeholder="SKU"
                          />
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={s.price ?? 0}
                            onChange={(e) =>
                              updateSize(selectedIdx, sIdx, { price: parseFloat(e.target.value) || 0 })
                            }
                            className="h-8 text-xs text-right"
                          />
                        </div>
                      ))
                    ) : (
                      <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                        No sizes for this color
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                Select a color to edit
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-end gap-2 shrink-0 bg-background">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Prices
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type ProductsTab = "products" | "shopify" | "woocommerce" | "suppliers";

export default function Products({ initialTab = "products", showStorefrontTabs = false }: { initialTab?: ProductsTab; showStorefrontTabs?: boolean } = {}) {
  const { user, signOut } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState<Product | null | undefined>(undefined);
  const [showAddForm, setShowAddForm] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "name-asc" | "name-desc" | "price-asc" | "price-desc">("newest");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Push to Store state
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [pushDialogOpen, setPushDialogOpen] = useState(false);
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [loadingIntegrations, setLoadingIntegrations] = useState(false);
  const [pushingIntegrationId, setPushingIntegrationId] = useState<string | null>(null);
  const [pushResults, setPushResults] = useState<{ created: number; updated: number; failed: number; errors: string[] } | null>(null);
  const [variantDetailProduct, setVariantDetailProduct] = useState<Product | null>(null);
  const [activeTab, setActiveTab] = useState(initialTab);
  useEffect(() => { setActiveTab(initialTab); }, [initialTab]);
  const [savingVariantPrices, setSavingVariantPrices] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [markupDialogOpen, setMarkupDialogOpen] = useState(false);
  const [markupType, setMarkupType] = useState<"flat" | "percent">("flat");
  const [markupValue, setMarkupValue] = useState("");
  const [applyingMarkup, setApplyingMarkup] = useState(false);

  const toggleProductSelect = (id: string) => {
    setSelectedProductIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const handlePushSingleProduct = async (productId: string) => {
    setSelectedProductIds(new Set([productId]));
    setPushResults(null);
    setPushDialogOpen(true);
    setLoadingIntegrations(true);
    const { data } = await supabase
      .from("store_integrations")
      .select("*")
      .eq("user_id", user?.id || "")
      .in("platform", ["shopify", "woocommerce"]);
    setIntegrations(data || []);
    setLoadingIntegrations(false);
  };

  const getPushedPlatforms = (product: Product): string[] => {
    const platforms: string[] = [];
    const src = (product as any).supplier_source;
    if (src?.external_ids?.woocommerce) platforms.push("WooCommerce");
    if (src?.external_ids?.shopify) platforms.push("Shopify");
    return platforms;
  };

  const toggleSelectAllProducts = () => {
    if (selectedProductIds.size === filteredAndSortedProducts.length) {
      setSelectedProductIds(new Set());
    } else {
      setSelectedProductIds(new Set(filteredAndSortedProducts.map((p) => p.id)));
    }
  };

  const openPushDialog = async () => {
    setPushResults(null);
    setPushDialogOpen(true);
    setLoadingIntegrations(true);
    const { data } = await supabase
      .from("store_integrations")
      .select("*")
      .eq("user_id", user?.id || "")
      .in("platform", ["shopify", "woocommerce"]);
    setIntegrations(data || []);
    setLoadingIntegrations(false);
  };

  const handlePushToStore = async (integration: any) => {
    setPushingIntegrationId(integration.id);
    setPushResults(null);
    try {
      const ids = Array.from(selectedProductIds);
      const creds = integration.credentials as any;

      // Invoke edge function ONCE PER PRODUCT to stay under the 150s edge timeout.
      // Run with limited concurrency to avoid overwhelming the destination store.
      const concurrency = 3;
      let created = 0;
      let updated = 0;
      let failed = 0;
      const errors: string[] = [];

      const runOne = async (productId: string) => {
        try {
          let resp: any;
          let invokeErr: any;
          if (integration.platform === "woocommerce") {
            ({ data: resp, error: invokeErr } = await supabase.functions.invoke("export-to-woocommerce", {
              body: {
                product_ids: [productId],
                site_url: integration.store_url,
                consumer_key: creds.consumer_key,
                consumer_secret: creds.consumer_secret,
                user_id: user?.id,
              },
            }));
          } else if (integration.platform === "shopify") {
            ({ data: resp, error: invokeErr } = await supabase.functions.invoke("export-to-shopify", {
              body: {
                product_ids: [productId],
                store_url: integration.store_url,
                access_token: creds.access_token,
                user_id: user?.id,
              },
            }));
          }
          if (invokeErr) throw invokeErr;
          created += resp?.created || 0;
          updated += resp?.updated || 0;
          failed += resp?.failed || 0;
          if (resp?.errors?.length) errors.push(...resp.errors);
        } catch (err: any) {
          failed++;
          errors.push(`Product ${productId}: ${err.message || "unknown error"}`);
        }
      };

      const queue = [...ids];
      const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
        while (queue.length > 0) {
          const next = queue.shift();
          if (next) await runOne(next);
        }
      });
      await Promise.all(workers);

      const data = { created, updated, failed, errors };
      setPushResults(data);
      if (failed === 0) {
        toast({ title: `Pushed ${created} new, ${updated} updated to ${integration.platform}` });
        setSelectedProductIds(new Set());
        fetchProducts();
      } else {
        toast({ title: `Pushed with ${failed} error(s)`, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Push failed", description: err.message, variant: "destructive" });
    } finally {
      setPushingIntegrationId(null);
    }
  };

  const filteredAndSortedProducts = (() => {
    let result = [...products];
    if (filterCategory !== "all") {
      result = result.filter((p) => p.category === filterCategory);
    }
    if (filterStatus !== "all") {
      result = result.filter((p) => (filterStatus === "active" ? p.is_active : !p.is_active));
    }
    switch (sortBy) {
      case "oldest": result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()); break;
      case "name-asc": result.sort((a, b) => a.name.localeCompare(b.name)); break;
      case "name-desc": result.sort((a, b) => b.name.localeCompare(a.name)); break;
      case "price-asc": result.sort((a, b) => a.base_price - b.base_price); break;
      case "price-desc": result.sort((a, b) => b.base_price - a.base_price); break;
      default: result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return result;
  })();

  const fetchProducts = async () => {
    setLoading(true);
    // Use rpc or a broader query — the RLS only allows viewing active products
    // so inactive ones won't show. For a dashboard we need all.
    // Since RLS is (is_active = true) for SELECT, we'll work with that limitation.
    const { data, error } = await supabase.from("inventory_products").select("*").order("created_at", { ascending: false });
    if (!error && data) setProducts(data as unknown as Product[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const deleteProduct = async (id: string) => {
    const { error } = await supabase.from("inventory_products").delete().eq("id", id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Product deleted" });
      setDeleteConfirmId(null);
      fetchProducts();
    }
  };

  const bulkDeleteProducts = async () => {
    if (selectedProductIds.size === 0) return;
    setBulkDeleting(true);
    const ids = Array.from(selectedProductIds);
    let failed = 0;
    for (const id of ids) {
      const { error } = await supabase.from("inventory_products").delete().eq("id", id);
      if (error) failed++;
    }
    setBulkDeleting(false);
    if (failed > 0) {
      toast({ title: `Deleted ${ids.length - failed} products, ${failed} failed`, variant: "destructive" });
    } else {
      toast({ title: `Deleted ${ids.length} product${ids.length !== 1 ? "s" : ""}` });
    }
    setSelectedProductIds(new Set());
    setDeleteConfirmId(null);
    fetchProducts();
  };

  const applyMarkupToProducts = async (productIds: string[]) => {
    const val = parseFloat(markupValue);
    if (isNaN(val) || val === 0) {
      toast({ title: "Enter a valid markup amount", variant: "destructive" });
      return;
    }
    setApplyingMarkup(true);
    let updated = 0;
    let failed = 0;
    for (const id of productIds) {
      const product = products.find((p) => p.id === id);
      if (!product || !Array.isArray(product.variants)) { failed++; continue; }
      const newVariants = product.variants.map((v: any) => ({
        ...v,
        sizes: v.sizes?.map((s: any) => ({
          ...s,
          price: markupType === "flat"
            ? Math.round((Number(s.price) + val) * 100) / 100
            : Math.round(Number(s.price) * (1 + val / 100) * 100) / 100,
        })),
      }));
      const newBasePrice = markupType === "flat"
        ? Math.round((product.base_price + val) * 100) / 100
        : Math.round(product.base_price * (1 + val / 100) * 100) / 100;
      const { error } = await supabase
        .from("inventory_products")
        .update({ variants: newVariants, base_price: newBasePrice })
        .eq("id", id);
      if (error) failed++;
      else updated++;
    }
    setApplyingMarkup(false);
    setMarkupDialogOpen(false);
    setMarkupValue("");
    if (failed > 0) {
      toast({ title: `Markup applied to ${updated} products, ${failed} failed`, variant: "destructive" });
    } else {
      toast({ title: `Markup applied to ${updated} product${updated !== 1 ? "s" : ""}` });
    }
    fetchProducts();
  };

  return (
    <div className="bg-background">
      <div className="p-4 sm:p-6 lg:p-8">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ProductsTab)}>
          {showStorefrontTabs ? (
            <TabsList className="mb-6 w-full sm:w-auto flex-wrap">
              <TabsTrigger value="shopify" className="gap-2 flex-1 sm:flex-none"><ShoppingBag className="h-4 w-4" /> Shopify</TabsTrigger>
              <TabsTrigger value="woocommerce" className="gap-2 flex-1 sm:flex-none"><Globe className="h-4 w-4" /> WooCommerce</TabsTrigger>
            </TabsList>
          ) : (
            <TabsList className="sr-only">
              <TabsTrigger value="products">Products</TabsTrigger>
              <TabsTrigger value="shopify">Shopify</TabsTrigger>
              <TabsTrigger value="woocommerce">WooCommerce</TabsTrigger>
              <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
            </TabsList>
          )}

          <TabsContent value="products">
            {showAddForm || editingProduct !== undefined ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setShowAddForm(false); setEditingProduct(undefined); }}>
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <CardTitle>{editingProduct ? "Edit Product" : "Add Product"}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <ProductForm
                    product={editingProduct}
                    knownCategories={Array.from(new Set(products.map((p) => p.category).filter(Boolean)))}
                    onCategoryRenamed={(oldName, newName) => {
                      setProducts((prev) => prev.map((p) => p.category === oldName ? { ...p, category: newName } : p));
                    }}
                    onSave={() => { setShowAddForm(false); setEditingProduct(undefined); fetchProducts(); }}
                    onCancel={() => { setShowAddForm(false); setEditingProduct(undefined); }}
                  />
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center justify-between gap-3 mb-6">
                  <div className="flex items-center gap-3 flex-wrap">
                    {filteredAndSortedProducts.length > 0 && (
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedProductIds.size === filteredAndSortedProducts.length && filteredAndSortedProducts.length > 0}
                          onChange={toggleSelectAllProducts}
                          className="rounded border-input"
                        />
                        Select all
                      </label>
                    )}
                    {selectedProductIds.size > 0 ? (
                      <>
                        <span className="text-sm text-muted-foreground">{selectedProductIds.size} selected</span>
                        <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={openPushDialog}>
                          <Send className="h-3.5 w-3.5" />
                          Push to Store
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={() => { setMarkupDialogOpen(true); setMarkupValue(""); setMarkupType("flat"); }}>
                          <SlidersHorizontal className="h-3.5 w-3.5" />
                          Set Markup
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1.5 h-8 text-destructive hover:text-destructive" disabled={bulkDeleting} onClick={() => setDeleteConfirmId("bulk")}>
                          {bulkDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          Delete ({selectedProductIds.size})
                        </Button>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">{filteredAndSortedProducts.length} of {products.length} product{products.length !== 1 ? "s" : ""}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                    {/* Category filter */}
                    <Select value={filterCategory} onValueChange={setFilterCategory}>
                      <SelectTrigger className="w-[140px] h-9 text-xs">
                        <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {Array.from(new Set([...CATEGORIES, ...products.map(p => p.category).filter(Boolean)])).map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Status filter */}
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="w-[120px] h-9 text-xs">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Sort */}
                    <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                      <SelectTrigger className="w-[140px] h-9 text-xs">
                        <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                        <SelectValue placeholder="Sort" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newest">Newest First</SelectItem>
                        <SelectItem value="oldest">Oldest First</SelectItem>
                        <SelectItem value="name-asc">Name A→Z</SelectItem>
                        <SelectItem value="name-desc">Name Z→A</SelectItem>
                        <SelectItem value="price-asc">Price Low→High</SelectItem>
                        <SelectItem value="price-desc">Price High→Low</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* View toggle */}
                    <div className="flex items-center rounded-md border">
                      <Button
                        variant={viewMode === "grid" ? "secondary" : "ghost"}
                        size="icon"
                        className="h-9 w-9 rounded-r-none"
                        onClick={() => setViewMode("grid")}
                      >
                        <LayoutGrid className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={viewMode === "list" ? "secondary" : "ghost"}
                        size="icon"
                        className="h-9 w-9 rounded-l-none"
                        onClick={() => setViewMode("list")}
                      >
                        <List className="h-4 w-4" />
                      </Button>
                    </div>

                    <Button onClick={() => { setShowAddForm(true); setEditingProduct(null); }} className="gap-2 h-9">
                      <Plus className="h-4 w-4" /> Add Product
                    </Button>
                  </div>
                </div>

                {loading ? (
                  <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                ) : products.length === 0 ? (
                  <Card className="flex flex-col items-center py-16 text-center">
                    <Package className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="font-medium mb-1">No products yet</p>
                    <p className="text-sm text-muted-foreground mb-4">Add products manually or import from Shopify / WooCommerce.</p>
                    <Button onClick={() => { setShowAddForm(true); setEditingProduct(null); }} className="gap-2">
                      <Plus className="h-4 w-4" /> Add Your First Product
                    </Button>
                  </Card>
                ) : filteredAndSortedProducts.length === 0 ? (
                  <Card className="flex flex-col items-center py-12 text-center">
                    <SlidersHorizontal className="h-10 w-10 text-muted-foreground mb-3" />
                    <p className="font-medium mb-1">No matching products</p>
                    <p className="text-sm text-muted-foreground">Try adjusting your filters.</p>
                  </Card>
                ) : viewMode === "grid" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {filteredAndSortedProducts.map((p) => {
                      const hasVariantImages = Array.isArray(p.variants) && p.variants.some((v: any) => v.image);
                      return (
                      <Card key={p.id} className={`overflow-hidden group cursor-pointer transition-all ${selectedProductIds.has(p.id) ? "ring-2 ring-primary" : ""}`} onClick={() => toggleProductSelect(p.id)}>
                        <ProductCardImage product={p} hasVariantImages={hasVariantImages}>
                          <div className="absolute top-2 left-2">
                            <input
                              type="checkbox"
                              checked={selectedProductIds.has(p.id)}
                              onChange={(e) => { e.stopPropagation(); toggleProductSelect(p.id); }}
                              className="rounded border-input h-4 w-4"
                            />
                          </div>
                          {!p.is_active && (
                            <span className="absolute bottom-2 left-2 bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full">Inactive</span>
                          )}
                          <div className="absolute top-2 right-2" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="icon" variant="secondary" className="h-8 w-8" title="Actions">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem onClick={() => window.open(`/preview/${p.id}`, '_blank')}>
                                  <Eye className="h-4 w-4 mr-2" /> Preview
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setEditingProduct(p)}>
                                  <Pencil className="h-4 w-4 mr-2" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handlePushSingleProduct(p.id)}>
                                  <Send className="h-4 w-4 mr-2" /> Push to Store
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteConfirmId(p.id)}>
                                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </ProductCardImage>
                        <CardContent className="p-4">
                          <h3 className="font-semibold truncate">{p.name}</h3>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-sm text-muted-foreground">{p.category}</span>
                            <span className="text-sm font-medium">${p.base_price.toFixed(2)}</span>
                          </div>
                          {getPushedPlatforms(p).length > 0 && (
                            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                              {getPushedPlatforms(p).map((platform) => (
                                <Badge key={platform} variant="outline" className="text-[10px] h-5">
                                  {platform === "Shopify" ? <ShoppingBag className="h-2.5 w-2.5 mr-1" /> : <Globe className="h-2.5 w-2.5 mr-1" />}
                                  {platform}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {Array.isArray(p.variants) && p.variants.length > 0 && (
                            <div className="mt-2 space-y-1.5">
                              <button
                                className="flex items-center gap-1 flex-wrap cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={(e) => { e.stopPropagation(); setVariantDetailProduct(p); }}
                                title="View all variants"
                              >
                                {p.variants.slice(0, 8).map((v: any, i: number) => (
                                  <div
                                    key={i}
                                    className="w-4 h-4 rounded-full border shadow-sm shrink-0"
                                    style={{ backgroundColor: resolveVariantHex(v) }}
                                    title={v.color}
                                  />
                                ))}
                                {p.variants.length > 8 && (
                                  <span className="text-[10px] text-muted-foreground">+{p.variants.length - 8}</span>
                                )}
                              </button>
                              <p className="text-[11px] text-muted-foreground">
                                {p.variants.length} color{p.variants.length !== 1 ? 's' : ''}
                                {p.variants[0]?.sizes?.length > 0 && ` · ${p.variants[0].sizes.length} size${p.variants[0].sizes.length !== 1 ? 's' : ''}`}
                              </p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-lg border overflow-hidden overflow-x-auto">
                    <div className="min-w-[600px]">
                    <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 items-center px-4 py-2.5 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
                      <span className="w-10" />
                      <span>Product</span>
                      <span className="w-24 text-right">Price</span>
                      <span className="w-20 text-center">Status</span>
                      <span className="w-24 text-right">Actions</span>
                    </div>
                    {filteredAndSortedProducts.map((p) => (
                      <div key={p.id} className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 items-center px-4 py-3 border-b last:border-b-0 hover:bg-muted/30 transition-colors group">
                        <div className="w-10 h-10 rounded-md bg-muted overflow-hidden shrink-0">
                          {p.image_front ? (
                            <img src={p.image_front} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{p.name}</p>
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-muted-foreground">{p.category}</p>
                            {Array.isArray(p.variants) && p.variants.length > 0 && (
                              <button
                                className="flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={(e) => { e.stopPropagation(); setVariantDetailProduct(p); }}
                                title="View all variants"
                              >
                                {p.variants.slice(0, 5).map((v: any, i: number) => (
                                  <div
                                    key={i}
                                    className="w-3 h-3 rounded-full border shadow-sm"
                                    style={{ backgroundColor: resolveVariantHex(v) }}
                                    title={v.color}
                                  />
                                ))}
                                {p.variants.length > 5 && (
                                  <span className="text-[10px] text-muted-foreground">+{p.variants.length - 5}</span>
                                )}
                                <span className="text-[10px] text-muted-foreground ml-1">
                                  · {p.variants[0]?.sizes?.length || 0} sizes
                                </span>
                              </button>
                            )}
                          </div>
                        </div>
                        <span className="w-24 text-right text-sm font-medium tabular-nums">${p.base_price.toFixed(2)}</span>
                        <span className="w-20 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${p.is_active ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                            {p.is_active ? "Active" : "Inactive"}
                          </span>
                        </span>
                        <div className="w-28 flex justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-8 w-8" title="Actions">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onClick={() => window.open(`/preview/${p.id}`, '_blank')}>
                                <Eye className="h-4 w-4 mr-2" /> Preview
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setEditingProduct(p)}>
                                <Pencil className="h-4 w-4 mr-2" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handlePushSingleProduct(p.id)}>
                                <Send className="h-4 w-4 mr-2" /> Push to Store
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteConfirmId(p.id)}>
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="shopify">
            {activeTab === "shopify" && <ShopifyImport onDone={fetchProducts} />}
          </TabsContent>

          <TabsContent value="woocommerce">
            {activeTab === "woocommerce" && <WooCommerceImport onDone={fetchProducts} />}
          </TabsContent>

          <TabsContent value="suppliers">
            {activeTab === "suppliers" && (
              <Tabs defaultValue="ssactivewear" className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="ssactivewear" className="gap-2"><Truck className="h-4 w-4" /> S&S Activewear</TabsTrigger>
                  <TabsTrigger value="sanmar" className="gap-2"><Package className="h-4 w-4" /> SanMar</TabsTrigger>
                </TabsList>
                <TabsContent value="ssactivewear">
                  <SSActivewearImport onDone={fetchProducts} />
                </TabsContent>
                <TabsContent value="sanmar">
                  <div><SanMarImport onDone={fetchProducts} /></div>
                </TabsContent>
              </Tabs>
            )}
          </TabsContent>
        </Tabs>

        {/* Variant Detail Dialog — Shopify-style two-pane manager */}
        <VariantManagerDialog
          product={variantDetailProduct}
          onClose={() => setVariantDetailProduct(null)}
          onSaved={() => { fetchProducts(); setVariantDetailProduct(null); }}
        />

        {/* Push to Store Dialog */}
        <Dialog open={pushDialogOpen} onOpenChange={setPushDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" /> Push to Store
              </DialogTitle>
              <DialogDescription>
                Push {selectedProductIds.size} selected product{selectedProductIds.size !== 1 ? "s" : ""} to a connected store.
              </DialogDescription>
            </DialogHeader>

            {loadingIntegrations ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : integrations.length === 0 ? (
              <div className="text-center py-6 space-y-2">
                <Store className="h-10 w-10 mx-auto text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No stores connected. Connect a Shopify or WooCommerce store first.</p>
              </div>
            ) : pushResults ? (
              <div className="space-y-3">
                <div className="rounded-lg border p-4 space-y-2">
                  <p className="text-sm font-medium">Push Complete</p>
                  <div className="flex gap-4 text-sm">
                    {pushResults.created > 0 && <span className="text-emerald-600">{pushResults.created} created</span>}
                    {pushResults.updated > 0 && <span className="text-blue-600">{pushResults.updated} updated</span>}
                    {pushResults.failed > 0 && <span className="text-destructive">{pushResults.failed} failed</span>}
                  </div>
                  {pushResults.errors?.length > 0 && (
                    <div className="mt-2 text-xs text-destructive space-y-1">
                      {pushResults.errors.map((e, i) => <p key={i}>{e}</p>)}
                    </div>
                  )}
                </div>
                <Button variant="outline" className="w-full" onClick={() => setPushDialogOpen(false)}>
                  Close
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {integrations.map((integ) => (
                  <Button
                    key={integ.id}
                    variant="outline"
                    className="w-full justify-start gap-3 h-auto py-3"
                    disabled={pushingIntegrationId !== null}
                    onClick={() => handlePushToStore(integ)}
                  >
                    {pushingIntegrationId === integ.id ? (
                      <Loader2 className="h-5 w-5 animate-spin shrink-0" />
                    ) : integ.platform === "shopify" ? (
                      <ShoppingBag className="h-5 w-5 shrink-0" />
                    ) : (
                      <Globe className="h-5 w-5 shrink-0" />
                    )}
                    <div className="text-left">
                      <p className="font-medium text-sm capitalize">{integ.platform}</p>
                      <p className="text-xs text-muted-foreground">{integ.store_url}</p>
                    </div>
                  </Button>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Bulk Markup Dialog */}
        <Dialog open={markupDialogOpen} onOpenChange={setMarkupDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <SlidersHorizontal className="h-5 w-5" /> Set Markup
              </DialogTitle>
              <DialogDescription>
                Apply a markup to all variant prices across {selectedProductIds.size} selected product{selectedProductIds.size !== 1 ? "s" : ""}. This will update both base price and all variant size prices.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Select value={markupType} onValueChange={(v) => setMarkupType(v as "flat" | "percent")}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flat">$ Flat Amount</SelectItem>
                    <SelectItem value="percent">% Percentage</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  step="0.01"
                  placeholder={markupType === "flat" ? "e.g. 5.00" : "e.g. 20"}
                  value={markupValue}
                  onChange={(e) => setMarkupValue(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {markupType === "flat"
                  ? `Adds $${markupValue || "0"} to every variant price.`
                  : `Increases every variant price by ${markupValue || "0"}%.`}
              </p>
              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={() => setMarkupDialogOpen(false)}>Cancel</Button>
                <Button
                  className="gap-2"
                  disabled={applyingMarkup || !markupValue}
                  onClick={() => applyMarkupToProducts(Array.from(selectedProductIds))}
                >
                  {applyingMarkup && <Loader2 className="h-4 w-4 animate-spin" />}
                  Apply Markup
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!deleteConfirmId} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete {deleteConfirmId === "bulk" ? `${selectedProductIds.size} Products` : "Product"}?</DialogTitle>
              <DialogDescription>
                {deleteConfirmId === "bulk"
                  ? `This will permanently remove ${selectedProductIds.size} selected product${selectedProductIds.size !== 1 ? "s" : ""} from your inventory. This action cannot be undone.`
                  : "This will permanently remove this product from your inventory. This action cannot be undone."}
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-3 justify-end pt-2">
              <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
              <Button
                variant="destructive"
                className="gap-2"
                disabled={bulkDeleting}
                onClick={() => {
                  if (deleteConfirmId === "bulk") {
                    bulkDeleteProducts();
                  } else if (deleteConfirmId) {
                    deleteProduct(deleteConfirmId);
                  }
                }}
              >
                {bulkDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
