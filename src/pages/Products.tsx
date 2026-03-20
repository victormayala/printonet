import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft, Plus, Pencil, Trash2, Upload, ShoppingBag,
  Store, Globe, Loader2, Package, ImageIcon
} from "lucide-react";

type Product = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  base_price: number;
  image_front: string | null;
  image_back: string | null;
  image_side1: string | null;
  image_side2: string | null;
  variants: any;
  is_active: boolean;
  created_at: string;
};

const CATEGORIES = ["T-Shirts", "Hoodies", "Mugs", "Phone Cases", "Tote Bags", "Hats", "Other"];

function ProductForm({
  product,
  onSave,
  onCancel,
}: {
  product?: Product | null;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(product?.name || "");
  const [category, setCategory] = useState(product?.category || "T-Shirts");
  const [description, setDescription] = useState(product?.description || "");
  const [basePrice, setBasePrice] = useState(product?.base_price?.toString() || "0");
  const [imageFront, setImageFront] = useState(product?.image_front || "");
  const [imageBack, setImageBack] = useState(product?.image_back || "");
  const [isActive, setIsActive] = useState(product?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

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
    const setter = side === "front" ? setImageFront : setImageBack;
    setter(urlData.publicUrl);
    setUploading(null);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      name: name.trim(),
      category,
      description: description.trim() || null,
      base_price: parseFloat(basePrice) || 0,
      image_front: imageFront || null,
      image_back: imageBack || null,
      is_active: isActive,
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
      <div className="space-y-2">
        <Label>Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Classic T-Shirt" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Category</Label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Base Price</Label>
          <Input type="number" step="0.01" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        {(["front", "back"] as const).map((side) => {
          const value = side === "front" ? imageFront : imageBack;
          return (
            <div key={side} className="space-y-2">
              <Label className="capitalize">{side} Image</Label>
              {value ? (
                <div className="relative group rounded-lg overflow-hidden border aspect-square bg-muted">
                  <img src={value} alt={side} className="w-full h-full object-cover" />
                  <button
                    onClick={() => (side === "front" ? setImageFront("") : setImageBack(""))}
                    className="absolute top-2 right-2 rounded-full bg-background/80 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed aspect-square cursor-pointer hover:border-primary/40 transition-colors">
                  {uploading === side ? (
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Upload {side}</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadImage(f, side);
                    }}
                  />
                </label>
              )}
            </div>
          );
        })}
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
  const [storeUrl, setStoreUrl] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);

  const handleImport = async () => {
    if (!storeUrl.trim() || !token.trim()) {
      toast({ title: "Enter both store URL and access token", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("import-shopify-products", {
        body: { store_url: storeUrl.trim().replace(/\/$/, ""), access_token: token.trim() },
      });
      if (error) throw error;
      toast({ title: `Imported ${data.imported_count} products from Shopify` });
      onDone();
    } catch (err: any) {
      toast({ title: "Shopify import failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><ShoppingBag className="h-5 w-5" /> Import from Shopify</CardTitle>
        <CardDescription>Enter your Shopify store URL and a Storefront API access token.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Store URL</Label>
          <Input value={storeUrl} onChange={(e) => setStoreUrl(e.target.value)} placeholder="https://your-store.myshopify.com" />
        </div>
        <div className="space-y-2">
          <Label>Storefront Access Token</Label>
          <Input value={token} onChange={(e) => setToken(e.target.value)} type="password" placeholder="shpat_..." />
        </div>
        <Button onClick={handleImport} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingBag className="h-4 w-4" />}
          Import Products
        </Button>
      </CardContent>
    </Card>
  );
}

function WooCommerceImport({ onDone }: { onDone: () => void }) {
  const [siteUrl, setSiteUrl] = useState("");
  const [consumerKey, setConsumerKey] = useState("");
  const [consumerSecret, setConsumerSecret] = useState("");
  const [loading, setLoading] = useState(false);

  const handleImport = async () => {
    if (!siteUrl.trim() || !consumerKey.trim() || !consumerSecret.trim()) {
      toast({ title: "All fields are required", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("import-woocommerce-products", {
        body: {
          site_url: siteUrl.trim().replace(/\/$/, ""),
          consumer_key: consumerKey.trim(),
          consumer_secret: consumerSecret.trim(),
        },
      });
      if (error) throw error;
      toast({ title: `Imported ${data.imported_count} products from WooCommerce` });
      onDone();
    } catch (err: any) {
      toast({ title: "WooCommerce import failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><Globe className="h-5 w-5" /> Import from WooCommerce</CardTitle>
        <CardDescription>Enter your WordPress site URL and WooCommerce REST API credentials.</CardDescription>
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
        <Button onClick={handleImport} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
          Import Products
        </Button>
      </CardContent>
    </Card>
  );
}

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState<Product | null | undefined>(undefined);
  const [showAddForm, setShowAddForm] = useState(false);

  const fetchProducts = async () => {
    setLoading(true);
    // Use rpc or a broader query — the RLS only allows viewing active products
    // so inactive ones won't show. For a dashboard we need all.
    // Since RLS is (is_active = true) for SELECT, we'll work with that limitation.
    const { data, error } = await supabase.from("inventory_products").select("*").order("created_at", { ascending: false });
    if (!error && data) setProducts(data as Product[]);
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
      fetchProducts();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-lg">
        <div className="container flex h-14 items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            <h1 className="text-lg font-bold">Products</h1>
          </div>
        </div>
      </header>

      <div className="container py-8 max-w-5xl">
        <Tabs defaultValue="products">
          <TabsList className="mb-6">
            <TabsTrigger value="products" className="gap-2"><Store className="h-4 w-4" /> My Products</TabsTrigger>
            <TabsTrigger value="shopify" className="gap-2"><ShoppingBag className="h-4 w-4" /> Shopify</TabsTrigger>
            <TabsTrigger value="woocommerce" className="gap-2"><Globe className="h-4 w-4" /> WooCommerce</TabsTrigger>
          </TabsList>

          <TabsContent value="products">
            {showAddForm || editingProduct !== undefined ? (
              <Card>
                <CardHeader>
                  <CardTitle>{editingProduct ? "Edit Product" : "Add Product"}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ProductForm
                    product={editingProduct}
                    onSave={() => { setShowAddForm(false); setEditingProduct(undefined); fetchProducts(); }}
                    onCancel={() => { setShowAddForm(false); setEditingProduct(undefined); }}
                  />
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="flex items-center justify-between mb-6">
                  <p className="text-sm text-muted-foreground">{products.length} product{products.length !== 1 ? "s" : ""}</p>
                  <Button onClick={() => { setShowAddForm(true); setEditingProduct(null); }} className="gap-2">
                    <Plus className="h-4 w-4" /> Add Product
                  </Button>
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
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {products.map((p) => (
                      <Card key={p.id} className="overflow-hidden group">
                        <div className="aspect-square bg-muted relative">
                          {p.image_front ? (
                            <img src={p.image_front} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="h-12 w-12 text-muted-foreground/40" />
                            </div>
                          )}
                          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button size="icon" variant="secondary" className="h-8 w-8" onClick={() => setEditingProduct(p)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="destructive" className="h-8 w-8" onClick={() => deleteProduct(p.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        <CardContent className="p-4">
                          <h3 className="font-semibold truncate">{p.name}</h3>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-sm text-muted-foreground">{p.category}</span>
                            <span className="text-sm font-medium">${p.base_price.toFixed(2)}</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="shopify">
            <ShopifyImport onDone={fetchProducts} />
          </TabsContent>

          <TabsContent value="woocommerce">
            <WooCommerceImport onDone={fetchProducts} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
