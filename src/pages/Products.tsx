import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft, Plus, Pencil, Trash2, Upload, ShoppingBag,
  Store, Globe, Loader2, Package, ImageIcon, LogOut, UserCircle,
  Code, Copy, Check, ExternalLink, Info, LayoutGrid, List,
  ArrowUpDown, SlidersHorizontal, RefreshCw, Link2, Unlink
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";

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
  print_areas?: Record<string, { x: number; y: number; width: number; height: number }> | null;
};

const CATEGORIES = ["T-Shirts", "Hoodies", "Mugs", "Phone Cases", "Tote Bags", "Hats", "Other"];

function UniversalSnippetDialog() {
  const [copied, setCopied] = useState(false);
  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const snippet = `<!-- Customizer Studio — paste in your site's <head> or before </body> -->
<script
  src="${baseUrl}/customizer-loader.js"
  data-api-url="${apiUrl}"
  data-base-url="${baseUrl}"
  data-anon-key="${anonKey}"
></script>`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    toast({ title: "Copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Code className="h-4 w-4" /> Get Embed Script
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Universal Embed Script</DialogTitle>
          <DialogDescription>
            One script tag — all your products automatically work with the customizer.
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: The script */}
        <div>
          <h4 className="text-sm font-semibold mb-2">1. Add this to your site's header</h4>
          <div className="relative">
            <Button
              size="sm"
              variant="outline"
              className="absolute top-3 right-3 gap-1.5 z-10"
              onClick={handleCopy}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
            <pre className="rounded-lg bg-muted p-4 pr-24 text-xs overflow-x-auto whitespace-pre-wrap break-all font-mono leading-relaxed">
              {snippet}
            </pre>
          </div>
        </div>

        {/* Step 2: Usage examples */}
        <div>
          <h4 className="text-sm font-semibold mb-2">2. Add buttons to your product pages</h4>
          <div className="space-y-3">
            <div className="rounded-lg border p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Product picker (shows all products)</p>
              <code className="text-xs bg-muted px-2 py-1 rounded block font-mono">
                {'<button data-customizer>Customize</button>'}
              </code>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Specific product (by name)</p>
              <code className="text-xs bg-muted px-2 py-1 rounded block font-mono">
                {'<button data-customizer data-product-name="Classic T-Shirt">Customize</button>'}
              </code>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Specific product (by ID)</p>
              <code className="text-xs bg-muted px-2 py-1 rounded block font-mono">
                {'<button data-customizer data-product-id="abc-123">Customize</button>'}
              </code>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p>The script loads automatically, fetches your active products, and handles everything. No per-product code needed.</p>
            <p>Listen for results with: <code className="text-xs bg-muted px-1 py-0.5 rounded">document.addEventListener('customizer:complete', e =&gt; console.log(e.detail))</code></p>
            <Link to="/developers" className="inline-flex items-center gap-1 text-primary hover:underline text-xs font-medium">
              Full documentation & advanced options <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


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
  const [imageLeft, setImageLeft] = useState(product?.image_side1 || "");
  const [imageRight, setImageRight] = useState(product?.image_side2 || "");
  const [isActive, setIsActive] = useState(product?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [printAreas, setPrintAreas] = useState<Record<string, { x: number; y: number; width: number; height: number }>>(
    (product?.print_areas as any) || {}
  );

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
      image_front: imageFront || null,
      image_back: imageBack || null,
      image_side1: imageLeft || null,
      image_side2: imageRight || null,
      is_active: isActive,
      print_areas: Object.keys(printAreas).length > 0 ? printAreas : {},
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
        {IMAGE_SIDES.map(({ key, label, value, setter }) => (
          <div key={key} className="space-y-2">
            <Label>{label} Image</Label>
            {value ? (
              <div className="relative group rounded-lg overflow-hidden border aspect-square bg-muted">
                <img src={value} alt={label} className="w-full h-full object-cover" />
                <button
                  onClick={() => setter("")}
                  className="absolute top-2 right-2 rounded-full bg-background/80 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
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
        ))}
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

  const handleConnect = async () => {
    if (!storeUrl.trim() || !token.trim()) {
      toast({ title: "Enter both store URL and access token", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      // Save credentials
      const integrationPayload = {
        user_id: user?.id,
        platform: "shopify" as const,
        store_url: storeUrl.trim().replace(/\/$/, ""),
        credentials: { access_token: token.trim() },
      };

      if (integration) {
        await supabase.from("store_integrations").update(integrationPayload).eq("id", integration.id);
      } else {
        await supabase.from("store_integrations").insert(integrationPayload);
      }

      // Import products
      const { data, error } = await supabase.functions.invoke("import-shopify-products", {
        body: { store_url: storeUrl.trim().replace(/\/$/, ""), access_token: token.trim(), user_id: user?.id },
      });
      if (error) throw error;
      toast({ title: `Connected! Imported ${data.imported_count} products from Shopify` });
      await fetchIntegration();
      onDone();
    } catch (err: any) {
      toast({ title: "Shopify import failed", description: err.message, variant: "destructive" });
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

  return (
    <div className="space-y-6">
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">How to get your Shopify credentials</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ol className="list-decimal list-inside space-y-2">
            <li>Log in to your <strong className="text-foreground">Shopify Admin</strong> at <code className="text-xs bg-muted px-1.5 py-0.5 rounded">your-store.myshopify.com/admin</code></li>
            <li>Go to <strong className="text-foreground">Settings → Apps and sales channels → Develop apps</strong></li>
            <li>Click <strong className="text-foreground">Create an app</strong> and give it a name (e.g. "Customizer Studio")</li>
            <li>Under <strong className="text-foreground">Configuration → Storefront API</strong>, select the scopes: <code className="text-xs bg-muted px-1.5 py-0.5 rounded">unauthenticated_read_product_listings</code></li>
            <li>Click <strong className="text-foreground">Install app</strong>, then copy the <strong className="text-foreground">Storefront API access token</strong></li>
          </ol>
          <p>Your <strong className="text-foreground">Store URL</strong> is your Shopify domain, e.g. <code className="text-xs bg-muted px-1.5 py-0.5 rounded">https://your-store.myshopify.com</code></p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><ShoppingBag className="h-5 w-5" /> Connect Shopify</CardTitle>
          <CardDescription>Enter your Shopify store URL and a Storefront API access token. Credentials will be saved for future syncs.</CardDescription>
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
          <Button onClick={handleConnect} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            Connect & Import
          </Button>
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

export default function Products() {
  const { user, signOut } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState<Product | null | undefined>(undefined);
  const [showAddForm, setShowAddForm] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "name-asc" | "name-desc" | "price-asc" | "price-desc">("newest");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

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
    <div className="bg-background">
      <div className="p-6 lg:p-8 max-w-5xl">
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
                {products.length > 0 && (
                  <div className="flex items-center justify-between gap-4 rounded-lg border border-dashed bg-muted/30 p-4 mb-6">
                    <div className="flex items-start gap-3 text-sm">
                      <Info className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                      <p className="text-muted-foreground">
                        Your products are ready! Add one script to your store and every product gets a customizer button.{" "}
                        <Link to="/developers" className="text-primary hover:underline font-medium">Full docs →</Link>
                      </p>
                    </div>
                    <UniversalSnippetDialog />
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                  <p className="text-sm text-muted-foreground">{filteredAndSortedProducts.length} of {products.length} product{products.length !== 1 ? "s" : ""}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Category filter */}
                    <Select value={filterCategory} onValueChange={setFilterCategory}>
                      <SelectTrigger className="w-[140px] h-9 text-xs">
                        <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredAndSortedProducts.map((p) => (
                      <Card key={p.id} className="overflow-hidden group">
                        <div className="aspect-square bg-muted relative">
                          {p.image_front ? (
                            <img src={p.image_front} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="h-12 w-12 text-muted-foreground/40" />
                            </div>
                          )}
                          {!p.is_active && (
                            <span className="absolute top-2 left-2 bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full">Inactive</span>
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
                ) : (
                  <div className="rounded-lg border overflow-hidden">
                    <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 items-center px-4 py-2.5 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
                      <span className="w-10" />
                      <span>Product</span>
                      <span className="w-24 text-right">Price</span>
                      <span className="w-20 text-center">Status</span>
                      <span className="w-20 text-right">Actions</span>
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
                          <p className="text-xs text-muted-foreground">{p.category}</p>
                        </div>
                        <span className="w-24 text-right text-sm font-medium tabular-nums">${p.base_price.toFixed(2)}</span>
                        <span className="w-20 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${p.is_active ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                            {p.is_active ? "Active" : "Inactive"}
                          </span>
                        </span>
                        <div className="w-20 flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingProduct(p)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteProduct(p.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
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
