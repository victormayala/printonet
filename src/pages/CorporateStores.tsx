import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, ExternalLink, Upload, X, RefreshCw, AlertCircle, CheckCircle2, Clock, MoreVertical, Pause, Play, Trash2, PauseCircle, Pencil, Package, Search, KeyRound, Copy, Check, Eye, EyeOff, LogIn, Building2, ShoppingBag, Globe } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import Products from "@/pages/Products";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";

const FONT_OPTIONS = [
  "Inter", "Space Grotesk", "Roboto", "Open Sans", "Lato", "Montserrat",
  "Poppins", "Raleway", "Nunito", "Playfair Display", "Merriweather", "Oswald",
  "Source Sans Pro", "PT Sans", "Work Sans", "Rubik", "Manrope", "DM Sans",
  "Plus Jakarta Sans", "Archivo",
];

const formSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  contact_email: z.string().trim().email("Invalid email").max(255),
  custom_domain: z.string().trim().max(255).optional().or(z.literal("")),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be hex like #7c3aed"),
  font_family: z.string().min(1),
  store_type: z.enum(["corporate", "retail"]).default("retail"),
});

type FormValues = z.infer<typeof formSchema>;

import { CorporateStore, resolveTenantSlug } from "@/types/corporateStore";
import { PushProductsDialog } from "@/components/PushProductsDialog";

const MAX_LOGO_BYTES = 4 * 1024 * 1024;
const ACCEPTED_MIME = ["image/png", "image/jpeg", "image/svg+xml", "image/webp", "image/x-icon", "image/vnd.microsoft.icon"];

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

function PaymentsCell({ store }: { store: CorporateStore }) {
  const [opening, setOpening] = useState(false);
  const [onboarding, setOnboarding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const refreshStatus = async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-connect-status", {
        body: { storeId: store.id },
      });
      if (error) throw error;
      const d = data as { connected?: boolean; charges_enabled?: boolean };
      toast({
        title: d?.charges_enabled ? "Stripe is connected" : "Still pending",
        description: d?.charges_enabled
          ? "Payments are ready."
          : "Stripe hasn't enabled charges on this account yet.",
      });
      // Refresh row from DB
      window.location.reload();
    } catch (e) {
      toast({
        title: "Could not refresh status",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  // Auto-sync when a pending store is rendered (e.g., after returning from onboarding)
  useEffect(() => {
    if (store.stripe_account_id && !store.stripe_charges_enabled) {
      supabase.functions
        .invoke("stripe-connect-status", { body: { storeId: store.id } })
        .then(({ data }) => {
          const d = data as { charges_enabled?: boolean } | null;
          if (d?.charges_enabled) window.location.reload();
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.id]);

  const openDashboard = async () => {
    setOpening(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-connect-login-link", {
        body: { storeId: store.id },
      });
      if (error) throw error;
      const url = (data as { url?: string })?.url;
      if (!url) throw new Error("No dashboard URL");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast({
        title: "Could not open Stripe dashboard",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setOpening(false);
    }
  };

  const startOnboarding = async () => {
    setOnboarding(true);
    try {
      const returnUrl = `${window.location.origin}/corporate-stores?stripe=return&store=${store.id}`;
      const refreshUrl = `${window.location.origin}/corporate-stores?stripe=refresh&store=${store.id}`;
      const { data, error } = await supabase.functions.invoke("stripe-connect-onboard", {
        body: { storeId: store.id, returnUrl, refreshUrl },
      });
      if (error) throw error;
      const url = (data as { url?: string })?.url;
      if (!url) throw new Error("No onboarding URL");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast({
        title: "Could not start Stripe onboarding",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setOnboarding(false);
    }
  };

  if (!store.stripe_account_id) {
    return (
      <div className="space-y-1">
        <Badge variant="outline" className="gap-1">
          <AlertCircle className="h-3 w-3" /> Not connected
        </Badge>
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={startOnboarding}
          disabled={onboarding}
        >
          {onboarding ? <Loader2 className="h-3 w-3 animate-spin" /> : <ExternalLink className="h-3 w-3" />}
          <span className="ml-1">Connect Stripe</span>
        </Button>
      </div>
    );
  }
  if (!store.stripe_charges_enabled) {
    return (
      <div className="space-y-1">
        <Badge variant="secondary" className="gap-1">
          <Clock className="h-3 w-3" /> Pending
        </Badge>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={startOnboarding}
            disabled={onboarding}
          >
            {onboarding ? <Loader2 className="h-3 w-3 animate-spin" /> : <ExternalLink className="h-3 w-3" />}
            <span className="ml-1">Resume onboarding</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={refreshStatus}
            disabled={refreshing}
          >
            {refreshing ? <Loader2 className="h-3 w-3 animate-spin" /> : <span>↻</span>}
            <span className="ml-1">Refresh</span>
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Badge variant="default" className="gap-1">
        <CheckCircle2 className="h-3 w-3" /> Connected
      </Badge>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={openDashboard}
        disabled={opening}
      >
        {opening ? <Loader2 className="h-3 w-3 animate-spin" /> : <ExternalLink className="h-3 w-3" />}
        <span className="ml-1">Stripe</span>
      </Button>
    </div>
  );
}

function PlatformFeeCell({ store }: { store: CorporateStore }) {
  const qc = useQueryClient();
  const [value, setValue] = useState<string>(
    (((store.platform_fee_bps ?? 250) / 100)).toString(),
  );
  const [saving, setSaving] = useState(false);
  const initial = ((store.platform_fee_bps ?? 250) / 100).toString();

  const save = async () => {
    const pct = Number(value);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      toast({ title: "Enter a value between 0 and 100", variant: "destructive" });
      setValue(initial);
      return;
    }
    const bps = Math.round(pct * 100);
    if (bps === (store.platform_fee_bps ?? 250)) return;
    setSaving(true);
    const { error } = await supabase
      .from("corporate_stores")
      .update({ platform_fee_bps: bps })
      .eq("id", store.id);
    setSaving(false);
    if (error) {
      toast({ title: "Could not save fee", description: error.message, variant: "destructive" });
      setValue(initial);
      return;
    }
    toast({ title: "Platform fee updated", description: `${pct}% will apply to new checkouts.` });
    qc.invalidateQueries({ queryKey: ["corporate-stores"] });
  };

  return (
    <div className="flex items-center gap-1">
      <Input
        type="number"
        inputMode="decimal"
        step="0.1"
        min={0}
        max={100}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setValue(initial);
        }}
        disabled={saving}
        className="h-8 w-20 text-sm"
        aria-label="Platform fee percentage"
      />
      <span className="text-xs text-muted-foreground">%</span>
      {saving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
    </div>
  );
}

function LogoField({
  label,
  value,
  existingUrl,
  onChange,
  onClearExisting,
  hint,
}: {
  label: string;
  value: File | null;
  existingUrl?: string | null;
  onChange: (f: File | null) => void;
  onClearExisting?: () => void;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrl = value ? URL.createObjectURL(value) : existingUrl || null;

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        <div className="h-16 w-16 rounded-md border bg-muted flex items-center justify-center overflow-hidden shrink-0">
          {previewUrl ? (
            <img src={previewUrl} alt="" className="h-full w-full object-contain" />
          ) : (
            <Upload className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_MIME.join(",")}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              if (!file) return onChange(null);
              if (!ACCEPTED_MIME.includes(file.type)) {
                toast({ title: "Unsupported file type", variant: "destructive" });
                return;
              }
              if (file.size > MAX_LOGO_BYTES) {
                toast({ title: "File too large (max 4 MB)", variant: "destructive" });
                return;
              }
              onChange(file);
            }}
          />
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
              {value || existingUrl ? "Replace" : "Upload"}
            </Button>
            {(value || existingUrl) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  onChange(null);
                  onClearExisting?.();
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
            {value && <span className="text-xs text-muted-foreground truncate">{value.name}</span>}
          </div>
          {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
        </div>
      </div>
    </div>
  );
}

export default function CorporateStores() {
  const { user } = useAuth();
  const { isSuperAdmin } = useIsSuperAdmin();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab = tabParam === "shopify" || tabParam === "woocommerce" ? tabParam : "stores";
  const setActiveTab = (v: string) => {
    if (v === "stores") {
      searchParams.delete("tab");
    } else {
      searchParams.set("tab", v);
    }
    setSearchParams(searchParams, { replace: true });
  };

  const { data: stores = [], isLoading } = useQuery({
    queryKey: ["corporate_stores", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("corporate_stores")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CorporateStore[];
    },
  });

  // Poll any provisioning rows
  const provisioningIds = stores.filter((s) => s.status === "provisioning").map((s) => s.id);
  useEffect(() => {
    if (provisioningIds.length === 0) return;
    const interval = setInterval(async () => {
      await Promise.all(
        provisioningIds.map(async (id) => {
          try {
            await supabase.functions.invoke("check-corporate-store-status", {
              body: { store_id: id },
            });
          } catch (err) {
            // 404s for stale/deleted rows are expected — just skip.
            console.warn("status poll failed for", id, err);
          }
        }),
      );
      queryClient.invalidateQueries({ queryKey: ["corporate_stores", user?.id] });
    }, 4000);
    return () => clearInterval(interval);
  }, [provisioningIds.join(","), queryClient, user?.id]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-2 w-full sm:w-auto flex-wrap">
          <TabsTrigger value="stores" className="gap-2 flex-1 sm:flex-none"><Building2 className="h-4 w-4" /> My Stores</TabsTrigger>
          <TabsTrigger value="shopify" className="gap-2 flex-1 sm:flex-none"><ShoppingBag className="h-4 w-4" /> Shopify</TabsTrigger>
          <TabsTrigger value="woocommerce" className="gap-2 flex-1 sm:flex-none"><Globe className="h-4 w-4" /> WooCommerce</TabsTrigger>
        </TabsList>

        <TabsContent value="stores" className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">My Stores</h1>
              <p className="text-muted-foreground mt-1">
                Provision branded WooCommerce stores for corporate clients (e.g. Pepsico employee merch).
              </p>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4" />
                  New store
                </Button>
              </DialogTrigger>
              <NewStoreDialog
                onCreated={() => {
                  setOpen(false);
                  queryClient.invalidateQueries({ queryKey: ["corporate_stores", user?.id] });
                }}
              />
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Your stores</CardTitle>
              <CardDescription>
                Each store is a fully isolated, Printonet-branded WooCommerce site provisioned for you automatically.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 py-3 border-b last:border-0">
                      <Skeleton className="h-8 w-8 rounded" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-64" />
                      </div>
                      <Skeleton className="h-6 w-20 rounded-full" />
                      <Skeleton className="h-8 w-8 rounded" />
                    </div>
                  ))}
                </div>
              ) : stores.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-sm">No stores yet. Click "New store" to create one.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Store</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Payments</TableHead>
                      {isSuperAdmin && <TableHead>Platform fee</TableHead>}
                      <TableHead>Site URL</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stores.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {s.logo_url ? (
                              <img src={s.logo_url} alt="" className="h-8 w-8 rounded object-contain bg-muted" />
                            ) : (
                              <div
                                className="h-8 w-8 rounded shrink-0"
                                style={{ background: s.primary_color }}
                              />
                            )}
                            <div className="min-w-0">
                              <div className="font-medium truncate flex items-center gap-2">
                                <span className="truncate">{s.name}</span>
                                {s.store_type === "corporate" && (
                                  <Badge variant="secondary" className="gap-1 shrink-0">
                                    <Building2 className="h-3 w-3" /> Corporate
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground truncate">{s.contact_email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <StatusBadge status={s.status} />
                            {s.error_message && s.status === "failed" && (
                              <div className="text-xs text-destructive max-w-xs truncate" title={s.error_message}>
                                {s.error_message}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <PaymentsCell store={s} />
                        </TableCell>
                        {isSuperAdmin && (
                          <TableCell>
                            <PlatformFeeCell store={s} />
                          </TableCell>
                        )}
                        <TableCell>
                          {s.wp_site_url ? (
                            <a
                              href={s.wp_site_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                            >
                              {s.wp_site_url.replace(/^https?:\/\//, "")}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">Pending…</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <StoreActions store={s} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shopify" forceMount className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6 lg:-mt-8 data-[state=inactive]:hidden">
          <Products initialTab="shopify" showStorefrontTabs hideTabsList />
        </TabsContent>

        <TabsContent value="woocommerce" forceMount className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6 lg:-mt-8 data-[state=inactive]:hidden">
          <Products initialTab="woocommerce" showStorefrontTabs hideTabsList />
        </TabsContent>
      </Tabs>
    </div>
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

function PasswordCopyField({ label, value }: { label: string; value: string }) {
  const [visible, setVisible] = useState(false);
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
        <Input
          readOnly
          type={visible ? "text" : "password"}
          value={value}
          className="font-mono text-sm"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
        <Button type="button" variant="outline" size="icon" onClick={onCopy} aria-label="Copy password">
          {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

function CredentialsDialog({
  store,
  open,
  onOpenChange,
}: {
  store: CorporateStore;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const adminUrl = store.store_admin_url || store.wp_admin_url;
  const loginUrl =
    store.store_login_url ||
    (store.wp_site_url ? `${store.wp_site_url.replace(/\/$/, "")}/wp-login.php` : null);
  const hasAny =
    !!adminUrl || !!loginUrl || !!store.admin_username || !!store.admin_password;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Admin credentials — {store.name}</DialogTitle>
          <DialogDescription>
            Sign-in details delivered by the multi-tenant platform when this store was provisioned.
          </DialogDescription>
        </DialogHeader>

        {!hasAny ? (
          <div className="text-sm text-muted-foreground py-4">
            No credentials available yet. They will appear here once the platform finishes provisioning.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {adminUrl && (
                <Button asChild size="sm">
                  <a href={adminUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" /> Open WP Admin
                  </a>
                </Button>
              )}
              {loginUrl && (
                <Button asChild size="sm" variant="outline">
                  <a href={loginUrl} target="_blank" rel="noreferrer">
                    <LogIn className="h-4 w-4" /> Login page
                  </a>
                </Button>
              )}
            </div>

            {adminUrl && <CopyField label="Admin URL" value={adminUrl} mono />}
            {loginUrl && <CopyField label="Login URL" value={loginUrl} mono />}
            {store.admin_username && (
              <CopyField label="Username" value={store.admin_username} mono />
            )}
            {store.admin_password && (
              <PasswordCopyField label="Password" value={store.admin_password} />
            )}

            <p className="text-xs text-muted-foreground">
              Treat these credentials as sensitive. We recommend the store owner change the password after first login.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StoreActions({ store }: { store: CorporateStore }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [pushOpen, setPushOpen] = useState(false);
  const [credsOpen, setCredsOpen] = useState(false);
  const [busy, setBusy] = useState<null | "pause" | "resume" | "delete" | "rebrand">(null);

  const refetch = () =>
    queryClient.invalidateQueries({ queryKey: ["corporate_stores", user?.id] });

  const runManage = async (action: "pause" | "resume" | "delete") => {
    setBusy(action);
    try {
      const { data, error } = await supabase.functions.invoke("manage-corporate-store", {
        body: { store_id: store.id, action },
      });
      const errMsg = (error as Error | null)?.message || (data as { error?: string } | null)?.error;
      if (errMsg) throw new Error(errMsg);
      toast({
        title:
          action === "delete"
            ? "Store deleted"
            : action === "pause"
              ? "Store paused"
              : "Store resumed",
      });
      refetch();
    } catch (e) {
      toast({
        title: `Could not ${action} store`,
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusy(null);
      if (action === "delete") setConfirmDelete(false);
    }
  };

  const rebrand = async () => {
    setBusy("rebrand");
    const { error } = await supabase.functions.invoke("apply-store-branding", {
      body: { store_id: store.id },
    });
    toast({
      title: error ? "Re-apply failed" : "Branding re-applied",
      variant: error ? "destructive" : "default",
    });
    setBusy(null);
  };

  const isActive = store.status === "active";
  const isPaused = store.status === "paused";

  return (
    <div className="flex items-center justify-end gap-2">
      <Button asChild variant="outline" size="sm">
        <Link to={`/corporate-stores/${store.id}`}>See details</Link>
      </Button>
      {store.wp_admin_url && isActive && (
        <Button asChild variant="outline" size="sm">
          <a href={store.wp_admin_url} target="_blank" rel="noreferrer">
            WP Admin
          </a>
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" disabled={busy !== null}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {isActive && (
            <DropdownMenuItem onClick={() => setPushOpen(true)}>
              <Package className="h-4 w-4" />
              Push products
            </DropdownMenuItem>
          )}
          {(isActive || isPaused) &&
            (store.admin_username ||
              store.admin_password ||
              store.store_admin_url ||
              store.store_login_url) && (
              <DropdownMenuItem onClick={() => setCredsOpen(true)}>
                <KeyRound className="h-4 w-4" />
                View credentials
              </DropdownMenuItem>
            )}
          {(isActive || isPaused) && (
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" />
              Edit branding
            </DropdownMenuItem>
          )}
          {isActive && (
            <DropdownMenuItem onClick={rebrand}>
              <RefreshCw className="h-4 w-4" />
              Re-apply branding
            </DropdownMenuItem>
          )}
          {isActive && (
            <DropdownMenuItem onClick={() => runManage("pause")}>
              <Pause className="h-4 w-4" />
              Pause store
            </DropdownMenuItem>
          )}
          {isPaused && (
            <DropdownMenuItem onClick={() => runManage("resume")}>
              <Play className="h-4 w-4" />
              Resume store
            </DropdownMenuItem>
          )}
          {(isActive || isPaused || store.status === "failed") && <DropdownMenuSeparator />}
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="h-4 w-4" />
            Delete store
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <EditStoreDialog
          store={store}
          onSaved={() => {
            setEditOpen(false);
            refetch();
          }}
        />
      </Dialog>

      <PushProductsDialog store={store} open={pushOpen} onOpenChange={setPushOpen} />
      <CredentialsDialog store={store} open={credsOpen} onOpenChange={setCredsOpen} />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{store.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently destroys the WooCommerce subsite and all of its data
              on the Printonet network. This action cannot be undone.
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
    </div>
  );
}

/** Shared identity + theme + assets editor used by both create and edit dialogs. */
function StoreFormFields({
  values,
  setField,
  errors,
  logo,
  setLogo,
  favicon,
  setFavicon,
  existing,
  onClearExisting,
  hideCustomDomain,
}: {
  values: FormValues;
  setField: <K extends keyof FormValues>(k: K, v: FormValues[K]) => void;
  errors: Record<string, string>;
  logo: File | null;
  setLogo: (f: File | null) => void;
  favicon: File | null;
  setFavicon: (f: File | null) => void;
  existing?: {
    logo_url: string | null;
    favicon_url: string | null;
  };
  onClearExisting?: (kind: "logo" | "favicon") => void;
  hideCustomDomain?: boolean;
}) {
  return (
    <div className="space-y-6 py-2">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Identity</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1">
            <Label>Account type</Label>
            <Select
              value={values.store_type}
              onValueChange={(v) => setField("store_type", v as "corporate" | "retail")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="retail">Retail Shop — sells to general public</SelectItem>
                <SelectItem value="corporate">Corporate Store — branded merch for one company</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Corporate stores can have a per-product company logo automatically baked into mockups when pushed.
            </p>
          </div>
          <div className="col-span-2 space-y-1">
            <Label htmlFor="name">Store name</Label>
            <Input id="name" value={values.name} onChange={(e) => setField("name", e.target.value)} placeholder="Pepsico Corporate Merch" />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="email">Contact email</Label>
            <Input id="email" type="email" value={values.contact_email} onChange={(e) => setField("contact_email", e.target.value)} placeholder="merch@pepsico.com" />
            {errors.contact_email && <p className="text-xs text-destructive">{errors.contact_email}</p>}
          </div>
          {!hideCustomDomain && (
            <div className="space-y-1">
              <Label htmlFor="domain">Custom domain (optional)</Label>
              <Input id="domain" value={values.custom_domain} onChange={(e) => setField("custom_domain", e.target.value)} placeholder="merch.pepsico.com" />
              {errors.custom_domain && <p className="text-xs text-destructive">{errors.custom_domain}</p>}
            </div>
          )}
        </div>
      </section>

      <Separator />

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Visual theme</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="primary">Primary color</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={values.primary_color}
                onChange={(e) => setField("primary_color", e.target.value)}
                className="h-10 w-12 rounded border bg-background cursor-pointer"
              />
              <Input
                id="primary"
                value={values.primary_color}
                onChange={(e) => setField("primary_color", e.target.value)}
                className="font-mono"
              />
            </div>
            {errors.primary_color && <p className="text-xs text-destructive">{errors.primary_color}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="font">Font family</Label>
            <Select value={values.font_family} onValueChange={(v) => setField("font_family", v)}>
              <SelectTrigger id="font">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_OPTIONS.map((f) => (
                  <SelectItem key={f} value={f} style={{ fontFamily: f }}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <Separator />

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Brand assets</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <LogoField
            label="Main logo"
            value={logo}
            existingUrl={existing?.logo_url}
            onChange={setLogo}
            onClearExisting={onClearExisting ? () => onClearExisting("logo") : undefined}
            hint="PNG/SVG, light background"
          />
          <LogoField
            label="Favicon"
            value={favicon}
            existingUrl={existing?.favicon_url}
            onChange={setFavicon}
            onClearExisting={onClearExisting ? () => onClearExisting("favicon") : undefined}
            hint="32×32 or 64×64 px, .ico/.png"
          />
        </div>
      </section>
    </div>
  );
}

async function uploadAsset(
  userId: string,
  storeId: string,
  file: File,
  kind: string,
): Promise<string> {
  const ext = file.name.split(".").pop() || "png";
  const path = `${userId}/${storeId}/${kind}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("corporate-store-assets")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from("corporate-store-assets").getPublicUrl(path);
  return data.publicUrl;
}

type SlugCheck = {
  available: boolean;
  tenant_slug: string;
  suggestions?: string[];
};

function StepIndicator({ step, total, labels }: { step: number; total: number; labels: string[] }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-2">
      {labels.map((label, idx) => {
        const n = idx + 1;
        const isDone = n < step;
        const isCurrent = n === step;
        return (
          <div key={label} className="flex items-center gap-2 flex-1 min-w-0">
            <div
              className={
                "h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold border " +
                (isDone
                  ? "bg-primary text-primary-foreground border-primary"
                  : isCurrent
                    ? "bg-primary/10 text-primary border-primary"
                    : "bg-muted text-muted-foreground border-border")
              }
            >
              {isDone ? <Check className="h-3.5 w-3.5" /> : n}
            </div>
            <div className="min-w-0 flex-1">
              <div
                className={
                  "text-xs font-medium truncate " +
                  (isCurrent || isDone ? "text-foreground" : "text-muted-foreground")
                }
              >
                {label}
              </div>
            </div>
            {idx < total - 1 && (
              <div className={"h-px flex-1 " + (isDone ? "bg-primary" : "bg-border")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function NewStoreDialog({ onCreated }: { onCreated: () => void }) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [values, setValues] = useState<FormValues>({
    name: "",
    contact_email: "",
    custom_domain: "",
    primary_color: "#7c3aed",
    font_family: "Inter",
    store_type: "retail",
  });
  const [logo, setLogo] = useState<File | null>(null);
  const [favicon, setFavicon] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [slugCheck, setSlugCheck] = useState<SlugCheck | null>(null);
  const [chosenSlug, setChosenSlug] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const [provisionedSiteUrl, setProvisionedSiteUrl] = useState<string | null>(null);
  const [provisionedStoreId, setProvisionedStoreId] = useState<string | null>(null);
  const [stripeStatus, setStripeStatus] = useState<{
    connected: boolean;
    charges_enabled: boolean;
    details_submitted: boolean;
  } | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeOnboardingOpened, setStripeOnboardingOpened] = useState(false);

  const STEP_LABELS = ["Create Store", "Choose Domain", "Connect Stripe", "Store Ready"];

  const startStripeOnboarding = async () => {
    if (!provisionedStoreId) {
      toast({ title: "Store still provisioning", description: "Please wait a moment.", variant: "destructive" });
      return;
    }
    setStripeLoading(true);
    try {
      const returnUrl = `${window.location.origin}/corporate-stores?stripe=return&store=${provisionedStoreId}`;
      const refreshUrl = `${window.location.origin}/corporate-stores?stripe=refresh&store=${provisionedStoreId}`;
      const { data, error } = await supabase.functions.invoke("stripe-connect-onboard", {
        body: { storeId: provisionedStoreId, returnUrl, refreshUrl },
      });
      if (error) throw error;
      const url = (data as { url?: string })?.url;
      if (!url) throw new Error("No onboarding URL returned");
      window.open(url, "_blank", "noopener,noreferrer");
      setStripeOnboardingOpened(true);
    } catch (e) {
      toast({
        title: "Could not start Stripe onboarding",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setStripeLoading(false);
    }
  };

  const refreshStripeStatus = async () => {
    if (!provisionedStoreId) return;
    setStripeLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-connect-status", {
        body: { storeId: provisionedStoreId },
      });
      if (error) throw error;
      setStripeStatus(data as { connected: boolean; charges_enabled: boolean; details_submitted: boolean });
    } catch (e) {
      toast({
        title: "Could not check Stripe status",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setStripeLoading(false);
    }
  };

  const callSlugCheck = async (payload: { store_name?: string; tenant_slug?: string }) => {
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("tenant-check-slug", {
        body: payload,
      });
      if (error) throw error;
      const resp = (data as { response?: SlugCheck })?.response;
      if (!resp || typeof resp.tenant_slug !== "string") {
        throw new Error("Unexpected response from tenant engine");
      }
      setSlugCheck(resp);
      if (resp.available) setChosenSlug(resp.tenant_slug);
      else setChosenSlug(null);
    } catch (e) {
      toast({
        title: "Could not check slug availability",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setChecking(false);
    }
  };

  // Step 2 → step 3: only RESERVE the store (DB row + tenant_slug). The
  // actual WordPress site (which is what burns the slug on the multisite
  // network) is created only at the end of the wizard via `finalize`.
  const provision = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not signed in");
      let finalSlug = chosenSlug;
      if (!finalSlug) {
        const { data, error } = await supabase.functions.invoke("tenant-check-slug", {
          body: { store_name: values.name },
        });
        if (error) throw error;
        const resp = (data as { response?: SlugCheck })?.response;
        if (!resp) throw new Error("Slug check failed");
        if (!resp.available) {
          setSlugCheck(resp);
          throw new Error("That name is taken — please pick a suggestion below.");
        }
        finalSlug = resp.tenant_slug;
        setSlugCheck(resp);
        setChosenSlug(finalSlug);
      }

      const tempId = crypto.randomUUID();
      const [logo_url, favicon_url] = await Promise.all([
        logo ? uploadAsset(user.id, tempId, logo, "logo") : Promise.resolve(null),
        favicon ? uploadAsset(user.id, tempId, favicon, "favicon") : Promise.resolve(null),
      ]);

      const { data, error } = await supabase.functions.invoke("provision-corporate-store", {
        body: {
          ...values,
          custom_domain: values.custom_domain || null,
          logo_url,
          favicon_url,
          tenant_slug: finalSlug,
          request_id: tempId,
          defer_provisioning: true,
        },
      });
      if (error) throw error;
      return data as { store_id?: string };
    },
    onSuccess: (data) => {
      if (data?.store_id) setProvisionedStoreId(data.store_id);
    },
    onError: (e: Error) => {
      toast({ title: "Could not start setup", description: e.message, variant: "destructive" });
    },
  });

  // Final step: actually create the WordPress site. This is when the slug
  // is registered on the multisite network.
  const finalize = useMutation({
    mutationFn: async () => {
      if (!provisionedStoreId) throw new Error("Store not ready yet");
      const { data, error } = await supabase.functions.invoke("finalize-corporate-store", {
        body: { store_id: provisionedStoreId },
      });
      if (error) throw error;
      return data as { site_url?: string };
    },
    onSuccess: (data) => {
      if (data?.site_url) setProvisionedSiteUrl(data.site_url);
    },
    onError: (e: Error) => {
      toast({
        title: "Could not create store",
        description: e.message,
        variant: "destructive",
      });
    },
  });

  const setField = <K extends keyof FormValues>(k: K, v: FormValues[K]) => {
    setValues((p) => ({ ...p, [k]: v }));
    if (k === "name") {
      setSlugCheck(null);
      setChosenSlug(null);
    }
  };

  const validateStep1 = () => {
    const parsed = formSchema.safeParse(values);
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed.error.flatten().fieldErrors)) {
        if (v?.[0]) fe[k] = v[0];
      }
      setErrors(fe);
      return false;
    }
    setErrors({});
    return true;
  };

  const goNextFromStep1 = () => {
    if (!validateStep1()) return;
    setStep(2);
  };

  const goNextFromStep2 = () => {
    if (!chosenSlug) {
      toast({ title: "Please confirm a site address", variant: "destructive" });
      return;
    }
    // Fire-and-forget provisioning so Stripe step can run in parallel
    provision.mutate();
    setStep(3);
  };

  const finishOnboarding = () => {
    toast({
      title: "Store provisioning started",
      description: "Your branded store is being prepared — this can take 1–2 minutes.",
    });
    onCreated();
  };

  const canCheck = values.name.trim().length >= 2 && !checking;

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>New store</DialogTitle>
        <DialogDescription>
          A clean, guided flow to launch a Printonet-branded WooCommerce store.
        </DialogDescription>
      </DialogHeader>

      <StepIndicator step={step} total={4} labels={STEP_LABELS} />

      {step === 1 && (
        <>
          <StoreFormFields
            values={values}
            setField={setField}
            errors={errors}
            logo={logo}
            setLogo={setLogo}
            favicon={favicon}
            setFavicon={setFavicon}
            hideCustomDomain
          />
          <DialogFooter>
            <Button onClick={goNextFromStep1}>Continue</Button>
          </DialogFooter>
        </>
      )}

      {step === 2 && (
        <div className="space-y-5 py-2">
          <div className="rounded-md border p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium">Site address</div>
                <div className="text-xs text-muted-foreground">
                  We'll generate a URL-friendly slug from your store name.
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canCheck}
                onClick={() => callSlugCheck({ store_name: values.name })}
              >
                {checking && <Loader2 className="h-3 w-3 animate-spin" />}
                Check availability
              </Button>
            </div>

            {slugCheck && (
              <div className="space-y-2">
                {slugCheck.available && chosenSlug ? (
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>
                      <span className="font-medium">{chosenSlug}</span> is available
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      <span>
                        <span className="font-medium">{slugCheck.tenant_slug}</span> is taken
                      </span>
                    </div>
                    {slugCheck.suggestions && slugCheck.suggestions.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs text-muted-foreground">Pick a suggestion:</div>
                        <div className="flex flex-wrap gap-2">
                          {slugCheck.suggestions.map((s) => {
                            const selected = chosenSlug === s;
                            return (
                              <Button
                                key={s}
                                type="button"
                                size="sm"
                                variant={selected ? "default" : "outline"}
                                onClick={() => callSlugCheck({ tenant_slug: s })}
                              >
                                {s}
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="domain">Custom domain (optional)</Label>
            <Input
              id="domain"
              value={values.custom_domain}
              onChange={(e) => setField("custom_domain", e.target.value)}
              placeholder="merch.pepsico.com"
            />
            <p className="text-xs text-muted-foreground">
              Bring your own domain, or skip and use the site address above.
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button onClick={goNextFromStep2} disabled={!chosenSlug}>
              Continue
            </Button>
          </DialogFooter>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5 py-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Connect Stripe</CardTitle>
              <CardDescription>
                Connect your Stripe account to accept payments. Customers pay your business
                directly — Printonet never holds your funds.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!provisionedStoreId ? (
                <div className="flex items-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Setting up your store… the Stripe button will unlock in a moment.
                </div>
              ) : stripeStatus?.connected ? (
                <div className="flex items-start gap-2 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-medium">Stripe connected</p>
                    <p className="text-xs opacity-80">
                      Your store can now accept payments directly to your Stripe account.
                    </p>
                  </div>
                </div>
              ) : stripeOnboardingOpened ? (
                <div className="space-y-3">
                  <div className="rounded-md border bg-muted/40 p-3 text-sm">
                    Finish onboarding in the new Stripe tab, then click the button below to verify.
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={refreshStripeStatus} disabled={stripeLoading}>
                      {stripeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      I've finished — check status
                    </Button>
                    <Button variant="outline" onClick={startStripeOnboarding} disabled={stripeLoading}>
                      Reopen Stripe
                    </Button>
                  </div>
                  {stripeStatus && !stripeStatus.connected && (
                    <p className="text-xs text-muted-foreground">
                      Stripe still needs more info ({stripeStatus.details_submitted ? "verifying" : "details not submitted"}).
                      Continue onboarding or check again in a minute.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Button onClick={startStripeOnboarding} disabled={stripeLoading}>
                    {stripeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                    Connect with Stripe
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Opens Stripe in a new tab. Sign in or create an account to receive payments.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setStep(2)} disabled={provision.isPending}>
              Back
            </Button>
            <Button variant="ghost" onClick={() => setStep(4)}>
              {stripeStatus?.connected ? "Continue" : "Skip for now"}
            </Button>
            {stripeStatus?.connected && <Button onClick={() => setStep(4)}>Continue</Button>}
          </DialogFooter>
        </div>
      )}

      {step === 4 && (
        <Step4Finalize
          finalize={finalize}
          provisionedSiteUrl={provisionedSiteUrl}
          provisionedStoreId={provisionedStoreId}
          onDone={finishOnboarding}
        />
      )}
    </DialogContent>
  );
}

function Step4Finalize({
  finalize,
  provisionedSiteUrl,
  provisionedStoreId,
  onDone,
}: {
  finalize: {
    mutate: () => void;
    isPending: boolean;
    isError: boolean;
    error: Error | null;
  };
  provisionedSiteUrl: string | null;
  provisionedStoreId: string | null;
  onDone: () => void;
}) {
  // Trigger finalize once when this step mounts and the reserved store_id is ready.
  const triggered = useRef(false);
  useEffect(() => {
    if (triggered.current) return;
    if (!provisionedStoreId) return;
    triggered.current = true;
    finalize.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provisionedStoreId]);

  const isPending = finalize.isPending || (!provisionedStoreId && !finalize.isError);
  const isError = finalize.isError;
  return (
    <div className="space-y-5 py-2">
      <div className="rounded-md border p-6 text-center space-y-3">
        <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          {isPending ? (
            <Loader2 className="h-6 w-6 text-primary animate-spin" />
          ) : isError ? (
            <AlertCircle className="h-6 w-6 text-destructive" />
          ) : (
            <CheckCircle2 className="h-6 w-6 text-primary" />
          )}
        </div>
        <div>
          <h3 className="text-lg font-semibold">
            {isPending
              ? "Creating your store…"
              : isError
                ? "Something went wrong"
                : "Your store is ready!"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {isPending
              ? "This usually takes 1–2 minutes. You can close this dialog — we'll keep working."
              : isError
                ? finalize.error?.message ?? "Provisioning failed."
                : provisionedSiteUrl
                  ? "Your branded WooCommerce store is live."
                  : "Your store is being finalized — it will appear in your dashboard shortly."}
          </p>
        </div>
        {provisionedSiteUrl && !isPending && (
          <a
            href={provisionedSiteUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            {provisionedSiteUrl.replace(/^https?:\/\//, "")}
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
        {isError && (
          <Button variant="outline" size="sm" onClick={() => finalize.mutate()}>
            Try again
          </Button>
        )}
      </div>

      <DialogFooter>
        <Button onClick={onDone}>Go to dashboard</Button>
      </DialogFooter>
    </div>
  );
}

function EditStoreDialog({
  store,
  onSaved,
}: {
  store: CorporateStore;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [values, setValues] = useState<FormValues>({
    name: store.name,
    contact_email: store.contact_email,
    custom_domain: store.custom_domain ?? "",
    primary_color: store.primary_color,
    font_family: store.font_family,
    store_type: store.store_type ?? "retail",
  });
  const [logo, setLogo] = useState<File | null>(null);
  const [favicon, setFavicon] = useState<File | null>(null);
  const [existing, setExisting] = useState({
    logo_url: store.logo_url,
    favicon_url: store.favicon_url,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setField = <K extends keyof FormValues>(k: K, v: FormValues[K]) =>
    setValues((p) => ({ ...p, [k]: v }));

  const onClearExisting = (kind: "logo" | "favicon") => {
    setExisting((p) => ({
      ...p,
      logo_url: kind === "logo" ? null : p.logo_url,
      favicon_url: kind === "favicon" ? null : p.favicon_url,
    }));
  };

  const save = useMutation({
    mutationFn: async () => {
      const parsed = formSchema.safeParse(values);
      if (!parsed.success) {
        const fe: Record<string, string> = {};
        for (const [k, v] of Object.entries(parsed.error.flatten().fieldErrors)) {
          if (v?.[0]) fe[k] = v[0];
        }
        setErrors(fe);
        throw new Error("Please fix the highlighted fields");
      }
      setErrors({});
      if (!user?.id) throw new Error("Not signed in");

      const [newLogoUrl, newFaviconUrl] = await Promise.all([
        logo ? uploadAsset(user.id, store.id, logo, "logo") : Promise.resolve(null),
        favicon ? uploadAsset(user.id, store.id, favicon, "favicon") : Promise.resolve(null),
      ]);

      const { error: updateErr } = await supabase
        .from("corporate_stores")
        .update({
          name: parsed.data.name,
          contact_email: parsed.data.contact_email,
          custom_domain: parsed.data.custom_domain || null,
          primary_color: parsed.data.primary_color,
          font_family: parsed.data.font_family,
          store_type: parsed.data.store_type,
          logo_url: newLogoUrl ?? existing.logo_url,
          favicon_url: newFaviconUrl ?? existing.favicon_url,
        })
        .eq("id", store.id);
      if (updateErr) throw updateErr;

      // Re-apply branding to the live WooCommerce site (best-effort)
      const { error: brandErr } = await supabase.functions.invoke("apply-store-branding", {
        body: { store_id: store.id },
      });
      if (brandErr) {
        // Non-fatal — DB is updated; surface a warning toast
        toast({
          title: "Saved, but branding push failed",
          description: brandErr.message,
          variant: "destructive",
        });
      }
    },
    onSuccess: () => {
      toast({ title: "Branding updated" });
      onSaved();
    },
    onError: (e: Error) => {
      toast({ title: "Could not save changes", description: e.message, variant: "destructive" });
    },
  });

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Edit "{store.name}"</DialogTitle>
        <DialogDescription>
          Update branding fields and we'll push the changes to your WooCommerce site automatically.
        </DialogDescription>
      </DialogHeader>

      <StoreFormFields
        values={values}
        setField={setField}
        errors={errors}
        logo={logo}
        setLogo={setLogo}
        favicon={favicon}
        setFavicon={setFavicon}
        existing={existing}
        onClearExisting={onClearExisting}
      />

      <DialogFooter>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Save & re-apply branding
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
