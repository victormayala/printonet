import { useEffect, useMemo, useState } from "react";
import shopifyLogo from "@/assets/shopify-logo.svg";
import wooLogo from "@/assets/woocommerce-logo.svg";

const MULTI_TLDS = ["co.uk", "org.uk", "ac.uk", "gov.uk", "com.au", "net.au", "org.au", "co.nz", "co.jp", "com.br", "co.za"];
const LOVABLE_DNS_VERIFICATION_VALUE =
  "lovable_verify=c0a3b6651e14fb5b40fd0fd11b160b1ba3a8cc2fff755b5a79d281e311af2be0";

function DnsPreview({ domainDraft }: { domainDraft: string }) {
  const SERVER_IP = "185.158.133.1";
  const { host, txtHost, txtValue } = useMemo(() => {
    const raw = (domainDraft || "").trim().toLowerCase();
    const domain = raw
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "")
      .replace(/^www\./, "");
    const parts = domain.split(".").filter(Boolean);
    const hasDomain = parts.length >= 2;
    const endsWithMultiTld = MULTI_TLDS.some((t) => domain.endsWith(`.${t}`));
    const isApex =
      !!domain && parts.length >= 2 && (endsWithMultiTld ? parts.length === 3 : parts.length === 2);
    const subdomain =
      isApex || parts.length < 2 ? "" : parts.slice(0, endsWithMultiTld ? -3 : -2).join(".");
    return {
      host: !domain || isApex ? "@" : subdomain || "@",
      txtHost: !domain || isApex ? "_lovable" : `_lovable.${subdomain}`,
      txtValue: hasDomain ? LOVABLE_DNS_VERIFICATION_VALUE : "Enter a domain to reveal the verification value",
    };
  }, [domainDraft]);

  return (
    <div className="rounded-md border bg-muted/40 p-3 space-y-3 text-sm">
      <p className="font-medium">DNS setup</p>
      <p className="text-muted-foreground text-xs">
        At your domain registrar (GoDaddy, Cloudflare, Namecheap, etc.), add the following two records.
        Then add this same domain in <span className="font-medium">Project Settings → Domains</span> on
        Lovable so SSL can be issued.
      </p>

      <div className="space-y-1">
        <p className="text-xs font-semibold">1. A record</p>
        <div className="grid grid-cols-[70px_1fr] gap-x-3 gap-y-1 font-mono text-xs rounded border bg-background p-2">
          <span className="text-muted-foreground">Type</span>
          <span>A</span>
          <span className="text-muted-foreground">Host</span>
          <span>{host}</span>
          <span className="text-muted-foreground">Value</span>
          <span>{SERVER_IP}</span>
          <span className="text-muted-foreground">TTL</span>
          <span>Auto / 3600</span>
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-semibold">2. TXT record (ownership verification)</p>
        <div className="grid grid-cols-[70px_1fr] gap-x-3 gap-y-1 font-mono text-xs rounded border bg-background p-2">
          <span className="text-muted-foreground">Type</span>
          <span>TXT</span>
          <span className="text-muted-foreground">Host</span>
          <span>{txtHost}</span>
          <span className="text-muted-foreground">Value</span>
          <span className="break-all">{txtValue}</span>
          <span className="text-muted-foreground">TTL</span>
          <span>Auto / 3600</span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        DNS changes can take up to 24 hours to propagate. SSL is issued automatically once DNS resolves correctly.
      </p>
    </div>
  );
}
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  LayoutDashboard,
  Loader2,
  Mail,
  Package,
  Paintbrush,
  Pause,
  PauseCircle,
  Pencil,
  Play,
  ShoppingBag,
  Trash2,
  Truck,
  Type,
  Users,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { CorporateStore } from "@/types/corporateStore";

import { StoreCustomizableProducts } from "@/components/StoreCustomizableProducts";
import { StoreCustomizerSettings } from "@/components/StoreCustomizerSettings";
import { StoreCustomers } from "@/components/StoreCustomers";
import { StoreShippingTax } from "@/components/StoreShippingTax";
import { StoreContentCMS } from "@/components/StoreContentCMS";
import { StoreOverviewStats } from "@/components/StoreOverviewStats";
import { EditStoreDialog } from "@/pages/CorporateStores";
import { ShopifyImport, WooCommerceImport } from "@/pages/Products";
import { Link2 } from "lucide-react";
import { IntegrationScriptPanel, isScriptMarkedInstalled } from "@/components/IntegrationScriptPanel";


function StatusBadge({ status }: { status: CorporateStore["status"] }) {
  if (status === "active") {
    return (
      <Badge variant="default" className="gap-1">
        <CheckCircle2 className="h-3 w-3" /> Active
      </Badge>
    );
  }
  if (status === "failed") {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertCircle className="h-3 w-3" /> Failed
      </Badge>
    );
  }
  if (status === "paused") {
    return (
      <Badge variant="outline" className="gap-1">
        <PauseCircle className="h-3 w-3" /> Paused
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <Clock className="h-3 w-3 animate-pulse" /> Provisioning
    </Badge>
  );
}

function CopyField({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <Input readOnly value={value} className={mono ? "font-mono text-sm" : "text-sm"} />
        <Button type="button" variant="outline" size="icon" onClick={onCopy} aria-label={`Copy ${label}`}>
          {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}


function ColorSwatch({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-10 w-10 rounded-md border shrink-0"
        style={{ background: value }}
        aria-hidden
      />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-mono text-sm">{value}</p>
      </div>
    </div>
  );
}

export default function CorporateStoreDetails() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmPause, setConfirmPause] = useState(false);
  const [busy, setBusy] = useState<null | "pause" | "resume" | "delete">(null);
  const [editOpen, setEditOpen] = useState(false);
  const [domainDraft, setDomainDraft] = useState("");
  const [savingDomain, setSavingDomain] = useState(false);
  const [editBrandingOpen, setEditBrandingOpen] = useState(false);
  const [scriptInstalled, setScriptInstalled] = useState(false);
  const currentTab = searchParams.get("tab") ?? "overview";
  const setCurrentTab = (tab: string) => {
    const next = new URLSearchParams(searchParams);
    if (tab === "overview") next.delete("tab");
    else next.set("tab", tab);
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    if (!id) return;
    const sync = () => setScriptInstalled(isScriptMarkedInstalled(id));
    sync();
    window.addEventListener("customizer-script-install-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("customizer-script-install-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, [id]);

  const openEditDomain = () => {
    setDomainDraft(store?.custom_domain ?? "");
    setEditOpen(true);
  };

  const saveDomain = async () => {
    if (!store) return;
    const trimmed = domainDraft.trim().toLowerCase();
    if (trimmed && !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(trimmed)) {
      toast({ title: "Invalid domain", description: "Enter a domain like merch.yourbrand.com", variant: "destructive" });
      return;
    }
    setSavingDomain(true);
    try {
      const { error } = await supabase
        .from("corporate_stores")
        .update({ custom_domain: trimmed || null })
        .eq("id", store.id);
      if (error) throw error;
      toast({ title: "Custom domain updated" });
      setEditOpen(false);
      queryClient.invalidateQueries({ queryKey: ["corporate_store", id, user?.id] });
      queryClient.invalidateQueries({ queryKey: ["corporate_stores", user?.id] });
    } catch (e) {
      toast({
        title: "Could not update domain",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSavingDomain(false);
    }
  };

  const { data: store, isLoading, error } = useQuery({
    queryKey: ["corporate_store", id, user?.id],
    enabled: !!id && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("corporate_stores")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as CorporateStore | null;
    },
  });

  const { data: integrationConnected } = useQuery({
    queryKey: ["store_integration_connected", store?.id, store?.store_type, user?.id],
    enabled: !!user?.id && !!store && (store.store_type === "shopify" || store.store_type === "woocommerce"),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_integrations")
        .select("id")
        .eq("user_id", user!.id)
        .eq("platform", store!.store_type)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });

  const runManage = async (action: "pause" | "resume" | "delete") => {
    if (!store) return;
    setBusy(action);
    try {
      if (action === "delete") {
        const { error } = await supabase
          .from("corporate_stores")
          .delete()
          .eq("id", store.id);
        if (error) throw error;
      } else {
        const newStatus = action === "pause" ? "paused" : "active";
        const { error } = await supabase
          .from("corporate_stores")
          .update({ status: newStatus, error_message: null })
          .eq("id", store.id);
        if (error) throw error;
      }
      toast({
        title:
          action === "delete"
            ? "Store deleted"
            : action === "pause"
              ? "Store paused"
              : "Store resumed",
      });
      queryClient.invalidateQueries({ queryKey: ["corporate_stores", user?.id] });
      if (action === "delete") {
        navigate("/corporate-stores");
      } else {
        queryClient.invalidateQueries({ queryKey: ["corporate_store", id, user?.id] });
      }
    } catch (e) {
      toast({
        title: `Could not ${action} store`,
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusy(null);
      if (action === "delete") setConfirmDelete(false);
      if (action === "pause") setConfirmPause(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading store…
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/corporate-stores">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
            <p>Store not found.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (store.store_type === "website") {
    return <Navigate to={`/websites/${store.id}`} replace />;
  }


  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1280px] mx-auto">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/corporate-stores")}>
          <ArrowLeft className="h-4 w-4" /> Back to corporate stores
        </Button>
      </div>

      {/* Header */}
      <header className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start gap-5 min-w-0">
            {store.store_type === "shopify" ? (
              <img
                src={shopifyLogo}
                alt="Shopify"
                className="h-16 w-16 rounded-xl object-contain bg-muted border shrink-0 p-1"
              />
            ) : store.store_type === "woocommerce" ? (
              <img
                src={wooLogo}
                alt="WooCommerce"
                className="h-16 w-16 rounded-xl object-contain bg-muted border shrink-0 p-1"
              />
            ) : store.logo_url ? (
              <img
                src={store.logo_url}
                alt=""
                className="h-16 w-16 rounded-xl object-contain bg-muted border shrink-0"
              />
            ) : (
              <div
                className="h-16 w-16 rounded-xl border shrink-0"
                style={{ background: store.primary_color }}
              />
            )}
            <div className="min-w-0 space-y-1.5">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold tracking-tight truncate">
                  {store.store_type === "shopify"
                    ? store.name.replace(/\s*\(Shopify\)\s*$/i, "")
                    : store.store_type === "woocommerce"
                    ? store.name.replace(/\s*\(WooCommerce\)\s*$/i, "")
                    : store.name}
                </h1>
                {(store.store_type === "shopify" || store.store_type === "woocommerce") && integrationConnected === false ? (
                  <Badge variant="destructive" className="gap-1">
                    <AlertCircle className="h-3 w-3" /> Disconnected
                  </Badge>
                ) : (
                  <StatusBadge status={store.status} />
                )}
                {store.store_type === "corporate" && (
                  <Badge variant="secondary" className="gap-1">
                    <Package className="h-3 w-3" /> Corporate
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground font-medium">
                Created{" "}
                <span className="text-foreground">
                  {new Date(store.created_at).toLocaleDateString()}
                </span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {store.tenant_slug && (
              <div className="flex items-center gap-2 lg:pr-4 lg:border-r lg:border-border">
                <Button asChild variant="outline">
                  <a
                    href={
                      store.custom_domain
                        ? `https://${store.custom_domain}`
                        : `https://stores.printonet.com/${store.tenant_slug}`
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Globe className="h-4 w-4" /> Visit store
                  </a>
                </Button>
              </div>
            )}

            {/* Administrative */}
            <div className="flex items-center gap-2">
              {store.status === "active" && (
                <Button
                  variant="outline"
                  onClick={() => setConfirmPause(true)}
                  disabled={busy !== null}
                >
                  {busy === "pause" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Pause className="h-4 w-4" />
                  )}
                  Pause
                </Button>
              )}
              {store.status === "paused" && (
                <Button
                  variant="outline"
                  onClick={() => runManage("resume")}
                  disabled={busy !== null}
                >
                  {busy === "resume" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  Resume
                </Button>
              )}
              <Button
                variant="ghost"
                onClick={() => setConfirmDelete(true)}
                disabled={busy !== null}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            </div>
          </div>
        </div>
      </header>

      {store.error_message && store.status === "failed" && (
        <Card className="border-destructive/40">
          <CardContent className="pt-6">
            <div className="flex items-start gap-2 text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm">Provisioning error</p>
                <p className="text-sm">{store.error_message}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={currentTab} onValueChange={setCurrentTab} className="space-y-6">
        <TabsList className="bg-muted/60 border h-auto flex-wrap gap-1 p-1.5">
          <TabsTrigger value="overview" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md rounded-lg px-4 py-2">
            <LayoutDashboard className="h-4 w-4" /> Overview
          </TabsTrigger>
          <TabsTrigger value="products" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md rounded-lg px-4 py-2">
            <ShoppingBag className="h-4 w-4" /> Products
          </TabsTrigger>
          <TabsTrigger value="shipping-tax" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md rounded-lg px-4 py-2">
            <Truck className="h-4 w-4" /> Pricing, Shipping & Tax
          </TabsTrigger>
          <TabsTrigger value="customers" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md rounded-lg px-4 py-2">
            <Users className="h-4 w-4" /> Customers
          </TabsTrigger>
          <Separator orientation="vertical" className="h-6 mx-1 bg-border" />
          <TabsTrigger value="branding" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md rounded-lg px-4 py-2">
            <Paintbrush className="h-4 w-4" /> Branding
          </TabsTrigger>
          <TabsTrigger value="content" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md rounded-lg px-4 py-2">
            <Type className="h-4 w-4" /> Content
          </TabsTrigger>
          {(store.store_type === "shopify" || store.store_type === "woocommerce") && (
            <TabsTrigger value="integration" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md rounded-lg px-4 py-2">
              <Link2 className="h-4 w-4" /> Integration
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-0">
          <StoreOverviewStats store={store} />
        </TabsContent>

        <TabsContent forceMount value="products" className="mt-0 data-[state=inactive]:hidden">
          <StoreCustomizableProducts store={store} />
        </TabsContent>

        <TabsContent forceMount value="shipping-tax" className="mt-0 data-[state=inactive]:hidden">
          <StoreShippingTax store={store} />
        </TabsContent>

        <TabsContent forceMount value="customers" className="mt-0 data-[state=inactive]:hidden">
          <StoreCustomers storeId={store.id} />
        </TabsContent>

        <TabsContent forceMount value="branding" className="mt-0 data-[state=inactive]:hidden">
          <StoreCustomizerSettings store={store} />
        </TabsContent>

        <TabsContent forceMount={false} value="content" className="mt-0">
          <StoreContentCMS store={store} />
        </TabsContent>

        {(store.store_type === "shopify" || store.store_type === "woocommerce") && (
          <TabsContent forceMount={false} value="integration" className="mt-0">
            {store.store_type === "shopify" ? (
              <ShopifyImport onDone={() => queryClient.invalidateQueries({ queryKey: ["corporate_stores", user?.id] })} />
            ) : (
              <WooCommerceImport onDone={() => queryClient.invalidateQueries({ queryKey: ["corporate_stores", user?.id] })} />
            )}
          </TabsContent>
        )}
      </Tabs>

      

      <Dialog open={editBrandingOpen} onOpenChange={setEditBrandingOpen}>
        <EditStoreDialog
          store={store}
          onSaved={() => {
            setEditBrandingOpen(false);
            queryClient.invalidateQueries({ queryKey: ["corporate_store", id, user?.id] });
            queryClient.invalidateQueries({ queryKey: ["corporate_stores", user?.id] });
          }}
        />
      </Dialog>

      <AlertDialog open={confirmPause} onOpenChange={setConfirmPause}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pause "{store.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              The storefront will be temporarily unavailable to shoppers until you resume it.
              No data will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy === "pause"}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                runManage("pause");
              }}
              disabled={busy === "pause"}
            >
              {busy === "pause" && <Loader2 className="h-4 w-4 animate-spin" />}
              Pause store
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{store.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the store and all of its data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy === "delete"}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                runManage("delete");
              }}
              disabled={busy === "delete"}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy === "delete" && <Loader2 className="h-4 w-4 animate-spin" />}
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit custom domain</DialogTitle>
            <DialogDescription>
              Point a domain you own at this store. Leave the field empty to remove.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="custom-domain">Custom domain</Label>
              <Input
                id="custom-domain"
                value={domainDraft}
                onChange={(e) => setDomainDraft(e.target.value)}
                placeholder="merch.yourbrand.com"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Use a root domain (e.g. <code className="font-mono">yourbrand.com</code>) or a subdomain
                (e.g. <code className="font-mono">shop.yourbrand.com</code>). For root domains, use host{" "}
                <code className="font-mono">@</code> on the A record.
              </p>
            </div>

            <DnsPreview domainDraft={domainDraft} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={savingDomain}>
              Cancel
            </Button>
            <Button onClick={saveDomain} disabled={savingDomain}>
              {savingDomain && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
