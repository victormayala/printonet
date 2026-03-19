import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Plus, Pencil, Trash2, ImageIcon } from "lucide-react";
import { toast } from "sonner";

interface InventoryProduct {
  id: string;
  name: string;
  description: string | null;
  category: string;
  base_price: number;
  image_front: string | null;
  image_back: string | null;
  image_side1: string | null;
  image_side2: string | null;
  variants: any;
  is_active: boolean;
  created_at: string;
}

const CATEGORIES = ["T-Shirts", "Hoodies", "Mugs", "Phone Cases", "Tote Bags", "Hats", "Other"];

function ImageUploadField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const [uploading, setUploading] = useState(false);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file);
    if (error) {
      toast.error("Upload failed: " + error.message);
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
    onChange(urlData.publicUrl);
    setUploading(false);
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium">{label}</Label>
      {value ? (
        <div className="relative group">
          <img src={value} alt={label} className="w-full h-32 object-cover rounded-lg border border-border" />
          <button
            onClick={() => onChange(null)}
            className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition-colors">
          <ImageIcon className="h-6 w-6 text-muted-foreground mb-1" />
          <span className="text-xs text-muted-foreground">{uploading ? "Uploading..." : "Click to upload"}</span>
          <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      )}
    </div>
  );
}

function ProductForm({
  product,
  onSave,
  onClose,
}: {
  product?: InventoryProduct;
  onSave: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(product?.name || "");
  const [description, setDescription] = useState(product?.description || "");
  const [category, setCategory] = useState(product?.category || "T-Shirts");
  const [basePrice, setBasePrice] = useState(product?.base_price?.toString() || "0");
  const [imageFront, setImageFront] = useState<string | null>(product?.image_front || null);
  const [imageBack, setImageBack] = useState<string | null>(product?.image_back || null);
  const [imageSide1, setImageSide1] = useState<string | null>(product?.image_side1 || null);
  const [imageSide2, setImageSide2] = useState<string | null>(product?.image_side2 || null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Product name is required");
      return;
    }
    setSaving(true);

    const data = {
      name: name.trim(),
      description: description.trim() || null,
      category,
      base_price: parseFloat(basePrice) || 0,
      image_front: imageFront,
      image_back: imageBack,
      image_side1: imageSide1,
      image_side2: imageSide2,
    };

    let error;
    if (product) {
      ({ error } = await supabase.from("inventory_products").update(data).eq("id", product.id));
    } else {
      ({ error } = await supabase.from("inventory_products").insert(data));
    }

    if (error) {
      toast.error("Save failed: " + error.message);
    } else {
      toast.success(product ? "Product updated" : "Product created");
      onSave();
      onClose();
    }
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
      <div className="space-y-2">
        <Label>Product Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Classic T-Shirt" />
      </div>

      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Product description..." rows={3} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Base Price ($)</Label>
          <Input type="number" step="0.01" min="0" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} />
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold">Product Images</h4>
        <p className="text-xs text-muted-foreground">Upload images for each side. Only sides with images will appear in the customizer.</p>
        <div className="grid grid-cols-2 gap-3">
          <ImageUploadField label="Front" value={imageFront} onChange={setImageFront} />
          <ImageUploadField label="Back" value={imageBack} onChange={setImageBack} />
          <ImageUploadField label="Side 1 (Left)" value={imageSide1} onChange={setImageSide1} />
          <ImageUploadField label="Side 2 (Right)" value={imageSide2} onChange={setImageSide2} />
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={saving} className="flex-1">
          {saving ? "Saving..." : product ? "Update Product" : "Create Product"}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </form>
  );
}

export default function Inventory() {
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<InventoryProduct | undefined>();

  async function fetchProducts() {
    setLoading(true);
    const { data, error } = await supabase
      .from("inventory_products")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setProducts(data as InventoryProduct[]);
    setLoading(false);
  }

  useEffect(() => {
    fetchProducts();
  }, []);

  async function deleteProduct(id: string) {
    if (!confirm("Delete this product?")) return;
    const { error } = await supabase.from("inventory_products").delete().eq("id", id);
    if (error) toast.error("Delete failed");
    else {
      toast.success("Product deleted");
      fetchProducts();
    }
  }

  function openEdit(product: InventoryProduct) {
    setEditingProduct(product);
    setDialogOpen(true);
  }

  function openCreate() {
    setEditingProduct(undefined);
    setDialogOpen(true);
  }

  const imageCount = (p: InventoryProduct) =>
    [p.image_front, p.image_back, p.image_side1, p.image_side2].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/products">
              <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
            </Link>
            <div>
              <h1 className="font-display text-xl font-bold">Product Inventory</h1>
              <p className="text-sm text-muted-foreground">Manage products for the customizer</p>
            </div>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Add Product
          </Button>
        </div>
      </div>

      {/* Product Grid */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {loading ? (
          <div className="text-center py-20 text-muted-foreground">Loading products...</div>
        ) : products.length === 0 ? (
          <div className="text-center py-20">
            <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No products yet</h3>
            <p className="text-muted-foreground mb-6">Add your first product to start customizing</p>
            <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" /> Add Product</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((p) => (
              <div key={p.id} className="bg-card border border-border rounded-xl overflow-hidden hover:shadow-lg transition-shadow group">
                <div className="h-48 bg-muted flex items-center justify-center overflow-hidden">
                  {p.image_front ? (
                    <img src={p.image_front} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="h-12 w-12 text-muted-foreground" />
                  )}
                </div>
                <div className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{p.name}</h3>
                      <p className="text-sm text-muted-foreground">{p.category}</p>
                    </div>
                    <span className="text-sm font-semibold text-primary">${p.base_price}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{imageCount(p)} image{imageCount(p) !== 1 ? "s" : ""} uploaded</p>
                  <div className="flex gap-2 pt-2">
                    <Link to={`/design/inv-${p.id}`} className="flex-1">
                      <Button variant="default" size="sm" className="w-full">Customize</Button>
                    </Link>
                    <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => deleteProduct(p.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Edit Product" : "Add New Product"}</DialogTitle>
          </DialogHeader>
          <ProductForm
            product={editingProduct}
            onSave={fetchProducts}
            onClose={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
