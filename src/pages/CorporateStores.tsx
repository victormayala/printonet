import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, ExternalLink, Upload, X, RefreshCw, AlertCircle, CheckCircle2, Clock, MoreVertical, Pause, Play, Trash2, PauseCircle, Pencil, Package, Search, Copy, Check, Eye, EyeOff, Building2, ShoppingBag, Globe, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import Products from "@/pages/Products";
import { StoreThemePicker } from "@/components/StoreThemePicker";
import { cms } from "@/lib/cmsClient";

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
import { toast as notify } from "sonner";

const FONT_OPTIONS = [
  "Inter", "Space Grotesk", "Roboto", "Open Sans", "Lato", "Montserrat",
  "Poppins", "Raleway", "Nunito", "Playfair Display", "Merriweather", "Oswald",
  "Source Sans Pro", "PT Sans", "Work Sans", "Rubik", "Manrope", "DM Sans",
  "Plus Jakarta Sans", "Archivo",
];

// Inject Google Fonts stylesheet once so the dropdown previews render in their own typeface.
if (typeof document !== "undefined" && !document.getElementById("corp-store-font-previews")) {
  const link = document.createElement("link");
  link.id = "corp-store-font-previews";
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?" +
    FONT_OPTIONS.map((f) => `family=${f.replace(/ /g, "+")}:wght@400;600`).join("&") +
    "&display=swap";
  document.head.appendChild(link);
}

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
      notify.error("Could not refresh status", { description: e instanceof Error ? e.message : undefined });
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
      notify.error("Could not open Stripe dashboard", { description: e instanceof Error ? e.message : undefined });
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
      notify.error("Could not start Stripe onboarding", { description: e instanceof Error ? e.message : undefined });
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
      notify.error("Enter a value between 0 and 100");
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
      notify.error("Could not save fee", { description: error.message });
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
                notify.error("Unsupported file type");
                return;
              }
              if (file.size > MAX_LOGO_BYTES) {
                notify.error("File too large (max 4 MB)");
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
  const [resumeStore, setResumeStore] = useState<CorporateStore | null>(null);
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
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CorporateStore[];
    },
  });

  // Provisioning rows used to be polled against the WordPress tenant engine;
  // new stores are now created in 'active' status directly so no polling is
  // required. Stale 'provisioning' rows from old flows simply stay as-is.

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1280px] mx-auto">
      <Tabs value={activeTab} onValueChange={setActiveTab}>

        <TabsContent value="stores" className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">My Stores</h1>
              <p className="text-muted-foreground mt-1">
                Provision branded storefronts for corporate clients (e.g. Pepsico employee merch).
              </p>
            </div>
            <Dialog
              open={open}
              onOpenChange={(v) => {
                setOpen(v);
                if (!v) setResumeStore(null);
              }}
            >
              <DialogTrigger asChild>
                <Button onClick={() => setResumeStore(null)}>
                  <Plus className="h-4 w-4" />
                  New store
                </Button>
              </DialogTrigger>
              <NewStoreDialog
                key={resumeStore?.id ?? "new"}
                resumeStore={resumeStore}
                onCreated={() => {
                  setOpen(false);
                  setResumeStore(null);
                  queryClient.invalidateQueries({ queryKey: ["corporate_stores", user?.id] });
                }}
              />
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Your stores</CardTitle>
              <CardDescription>
                Each store is a fully isolated, Printonet-branded storefront connected to your hosted catalog.
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
                    {stores.map((s) => {
                      // Stores that haven't completed onboarding (step 1 → 2 → publish)
                      // sit in 'provisioning' with a placeholder tenant_slug. Hide all
                      // details and surface only a "Finish setup" CTA + warning that
                      // the chosen URL isn't reserved yet.
                      const isUnpublished = s.status === "provisioning";
                      if (isUnpublished) {
                        const displaySlug =
                          s.requested_slug ??
                          (s.tenant_slug && !s.tenant_slug.startsWith("pending-")
                            ? s.tenant_slug
                            : null);
                        return (
                          <TableRow key={s.id} className="bg-amber-50/40 dark:bg-amber-950/10">
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div
                                  className="h-8 w-8 rounded shrink-0"
                                  style={{ background: s.primary_color }}
                                />
                                <div className="min-w-0">
                                  <div className="font-medium truncate">{s.name}</div>
                                  <div className="text-xs text-muted-foreground">Setup incomplete</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell colSpan={isSuperAdmin ? 3 : 2}>
                              <div className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
                                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                                <span>
                                  Finish onboarding to publish this store. Your chosen
                                  site address isn't reserved yet — someone else could
                                  claim it if you don't complete setup.
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {displaySlug ? (
                                <span className="text-sm font-mono text-muted-foreground inline-flex items-center gap-1">
                                  stores.printonet.com/{displaySlug}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setResumeStore(s);
                                    setOpen(true);
                                  }}
                                >
                                  Finish setup
                                </Button>
                                <StoreActions
                                  store={s}
                                  onResumeSetup={() => {
                                    setResumeStore(s);
                                    setOpen(true);
                                  }}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      }
                      return (
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
                              <div className="text-xs text-amber-700 dark:text-amber-500 max-w-xs truncate" title={s.error_message}>
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
                          {s.custom_domain ? (
                            <a
                              href={`https://${s.custom_domain}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                            >
                              {s.custom_domain}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : s.tenant_slug ? (
                            <a
                              href={`https://stores.printonet.com/${s.tenant_slug}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm font-mono text-primary hover:underline inline-flex items-center gap-1"
                            >
                              stores.printonet.com/{s.tenant_slug}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <StoreActions
                            store={s}
                            onResumeSetup={() => {
                              setResumeStore(s);
                              setOpen(true);
                            }}
                          />
                        </TableCell>
                      </TableRow>
                      );
                    })}
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
      notify.error("Copy failed");
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
      notify.error("Copy failed");
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


function StoreActions({ store, onResumeSetup }: { store: CorporateStore; onResumeSetup?: () => void }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [pushOpen, setPushOpen] = useState(false);
  const [busy, setBusy] = useState<null | "pause" | "resume" | "delete">(null);

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ["corporate_stores", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["dashboard", user?.id] });
  };

  const runManage = async (action: "pause" | "resume" | "delete") => {
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
      refetch();
    } catch (e) {
      notify.error(`Could not ${action} store`, {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setBusy(null);
      if (action === "delete") setConfirmDelete(false);
    }
  };

  const isActive = store.status === "active";
  const isPaused = store.status === "paused";

  const needsSetup = store.status === "active" && !store.stripe_account_id;

  return (
    <div className="flex items-center justify-end gap-2">
      {needsSetup && onResumeSetup && (
        <Button variant="default" size="sm" onClick={onResumeSetup}>
          Finish setup
        </Button>
      )}
      <Button asChild variant="outline" size="sm">
        <Link to={`/corporate-stores/${store.id}`}>See details</Link>
      </Button>
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
          {(isActive || isPaused) && (
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" />
              Edit branding
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
  footerLogo,
  setFooterLogo,
  existing,
  onClearExisting,
  hideCustomDomain,
  compact,
  section = "all",
}: {
  values: FormValues;
  setField: <K extends keyof FormValues>(k: K, v: FormValues[K]) => void;
  errors: Record<string, string>;
  logo: File | null;
  setLogo: (f: File | null) => void;
  favicon: File | null;
  setFavicon: (f: File | null) => void;
  footerLogo?: File | null;
  setFooterLogo?: (f: File | null) => void;
  existing?: {
    logo_url: string | null;
    favicon_url: string | null;
    secondary_logo_url?: string | null;
  };
  onClearExisting?: (kind: "logo" | "favicon" | "footer") => void;
  hideCustomDomain?: boolean;
  /** When true, hides branding sections behind a collapsible "Branding (optional)" toggle. */
  compact?: boolean;
  /** Render only one section. Defaults to "all". */
  section?: "identity" | "branding" | "all";
}) {
  const [brandingOpen, setBrandingOpen] = useState(false);

  const brandingSections = (
    <>
      <section className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Visual theme</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-2">
            <Label htmlFor="primary">Primary color</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={values.primary_color}
                onChange={(e) => setField("primary_color", e.target.value)}
                className="h-10 w-12 rounded border bg-background cursor-pointer shrink-0"
              />
              <Input
                id="primary"
                value={values.primary_color}
                onChange={(e) => setField("primary_color", e.target.value)}
                className="font-mono"
              />
            </div>
            {errors.primary_color && <p className="text-xs text-amber-700 dark:text-amber-500">{errors.primary_color}</p>}
          </div>
          <div className="space-y-2">
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

      <section className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Brand assets</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
          {setFooterLogo && (
            <LogoField
              label="Footer logo (optional)"
              value={footerLogo ?? null}
              existingUrl={existing?.secondary_logo_url ?? null}
              onChange={setFooterLogo}
              onClearExisting={onClearExisting ? () => onClearExisting("footer") : undefined}
              hint="Defaults to the main logo if left empty"
            />
          )}
        </div>
      </section>
    </>
  );

  if (section === "branding") {
    return <div className="space-y-6 py-1">{brandingSections}</div>;
  }

  const identitySection = (
    <section className="space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Store details</h3>
      <div className="space-y-5">
        <div className="space-y-2">
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
        <div className="space-y-2">
          <Label htmlFor="name">Store name</Label>
          <Input id="name" value={values.name} onChange={(e) => setField("name", e.target.value)} placeholder="Acme Company Store" />
          {errors.name && <p className="text-xs text-amber-700 dark:text-amber-500">{errors.name}</p>}
        </div>
        <div className={hideCustomDomain ? "" : "grid grid-cols-1 sm:grid-cols-2 gap-5"}>
          <div className="space-y-2">
            <Label htmlFor="email">Contact email</Label>
            <Input id="email" type="email" value={values.contact_email} onChange={(e) => setField("contact_email", e.target.value)} placeholder="store@acme.com" />
            {errors.contact_email && <p className="text-xs text-amber-700 dark:text-amber-500">{errors.contact_email}</p>}
          </div>
          {!hideCustomDomain && (
            <div className="space-y-2">
              <Label htmlFor="domain">Custom domain (optional)</Label>
              <Input id="domain" value={values.custom_domain} onChange={(e) => setField("custom_domain", e.target.value)} placeholder="merch.acme.com" />
              {errors.custom_domain && <p className="text-xs text-amber-700 dark:text-amber-500">{errors.custom_domain}</p>}
            </div>
          )}
        </div>
      </div>
    </section>
  );

  if (section === "identity") {
    return <div className="space-y-6 py-1">{identitySection}</div>;
  }

  return (
    <div className="space-y-6 py-1">
      {identitySection}
      {compact ? (
        <Collapsible open={brandingOpen} onOpenChange={setBrandingOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-md border bg-muted/40 px-4 py-3 text-left text-sm transition-colors hover:bg-muted"
            >
              <div>
                <div className="font-medium">Branding (optional)</div>
                <div className="text-xs text-muted-foreground">
                  Logo, color, and font — you can also set this later.
                </div>
              </div>
              <ChevronDown className={`h-4 w-4 transition-transform ${brandingOpen ? "rotate-180" : ""}`} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-6 pt-5">
            {brandingSections}
          </CollapsibleContent>
        </Collapsible>
      ) : (
        <>
          <Separator />
          {brandingSections}
        </>
      )}
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
          <div key={label} className={"flex items-center gap-2 " + (idx < total - 1 ? "flex-1" : "shrink-0")}>
            <div
              className={
                "h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold border " +
                (isDone
                  ? "bg-yellow-400 text-yellow-950 border-yellow-400"
                  : isCurrent
                    ? "bg-yellow-400 text-yellow-950 border-yellow-500"
                    : "bg-yellow-200 text-yellow-900 border-yellow-300")
              }
            >
              {isDone ? <Check className="h-3.5 w-3.5" /> : n}
            </div>
            <div
              className={
                "text-xs font-medium whitespace-nowrap shrink-0 " +
                (isCurrent || isDone ? "text-foreground" : "text-muted-foreground")
              }
            >
              {label}
            </div>
            {idx < total - 1 && (
              <div className={"h-px flex-1 min-w-4 " + (isDone ? "bg-primary" : "bg-border")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function NewStoreDialog({
  onCreated,
  resumeStore,
}: {
  onCreated: () => void;
  resumeStore?: CorporateStore | null;
}) {
  const { user } = useAuth();
  const isResume = !!resumeStore;
  const [step, setStep] = useState(isResume ? 2 : 1);
  const [values, setValues] = useState<FormValues>({
    name: resumeStore?.name ?? "",
    contact_email: resumeStore?.contact_email ?? "",
    custom_domain: resumeStore?.custom_domain ?? "",
    primary_color: resumeStore?.primary_color ?? "#7c3aed",
    font_family: resumeStore?.font_family ?? "Inter",
    store_type: (resumeStore?.store_type as FormValues["store_type"]) ?? "retail",
  });
  const [logo, setLogo] = useState<File | null>(null);
  const [favicon, setFavicon] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const resumeSlug = resumeStore
    ? ((resumeStore as CorporateStore & { requested_slug?: string | null }).requested_slug
        ?? (resumeStore.tenant_slug?.startsWith("pending-") ? null : resumeStore.tenant_slug))
    : null;
  const [slugCheck, setSlugCheck] = useState<SlugCheck | null>(
    isResume && resumeSlug
      ? { available: true, tenant_slug: resumeSlug, suggestions: [] }
      : null,
  );
  const [chosenSlug, setChosenSlug] = useState<string | null>(resumeSlug);
  const [slugDraft, setSlugDraft] = useState<string>(resumeSlug ?? "");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState<boolean>(!!resumeSlug);
  const [showCustomDomain, setShowCustomDomain] = useState<boolean>(!!resumeStore?.custom_domain);
  const [checking, setChecking] = useState(false);

  const [provisionedStoreId, setProvisionedStoreId] = useState<string | null>(resumeStore?.id ?? null);
  const [stripeStatus, setStripeStatus] = useState<{
    connected: boolean;
    charges_enabled: boolean;
    details_submitted: boolean;
  } | null>(
    resumeStore?.stripe_charges_enabled
      ? { connected: true, charges_enabled: true, details_submitted: true }
      : null,
  );
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeOnboardingOpened, setStripeOnboardingOpened] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [seedingTemplate, setSeedingTemplate] = useState(false);
  const [templateSeeded, setTemplateSeeded] = useState(false);

  const STEP_LABELS = ["Store & Address", "Theme & Branding", "Connect Stripe"];

  const startStripeOnboarding = async () => {
    if (!provisionedStoreId) {
      notify.error("Store still provisioning", { description: "Please wait a moment." });
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
      notify.error("Could not start Stripe onboarding", { description: e instanceof Error ? e.message : undefined });
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
      notify.error("Could not check Stripe status", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setStripeLoading(false);
    }
  };

  const slugify = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 60);

  const callSlugCheck = async (payload: { store_name?: string; tenant_slug?: string }) => {
    setChecking(true);
    try {
      const baseSlug = payload.tenant_slug
        ? slugify(payload.tenant_slug)
        : slugify(payload.store_name ?? "");
      if (!baseSlug || baseSlug.length < 2) {
        throw new Error("Please enter a longer store name");
      }
      // Uniqueness check against our own table — no external tenant engine.
      const { data: existing, error } = await supabase
        .from("corporate_stores")
        .select("tenant_slug")
        .ilike("tenant_slug", `${baseSlug}%`);
      if (error) throw error;
      const taken = new Set(
        (existing ?? []).map((r) => (r.tenant_slug ?? "").toLowerCase()).filter(Boolean),
      );
      const available = !taken.has(baseSlug);
      const suggestions: string[] = [];
      if (!available) {
        for (let i = 2; suggestions.length < 4 && i < 50; i++) {
          const candidate = `${baseSlug}-${i}`;
          if (!taken.has(candidate)) suggestions.push(candidate);
        }
      }
      const resp: SlugCheck = { available, tenant_slug: baseSlug, suggestions };
      setSlugCheck(resp);
      if (available) setChosenSlug(baseSlug);
      else setChosenSlug(null);
    } catch (e) {
      notify.error("Could not check slug availability", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setChecking(false);
    }
  };

  // Keep the slug in sync with the store name until the user manually edits it.
  useEffect(() => {
    if (isResume || slugManuallyEdited) return;
    if (values.name) {
      setSlugDraft(slugify(values.name));
    } else {
      setSlugDraft("");
    }
  }, [values.name, isResume, slugManuallyEdited]);

  // Debounced availability check whenever the slug draft changes (step 1).
  useEffect(() => {
    if (step !== 1 || isResume) return;
    const candidate = slugify(slugDraft);
    if (!candidate || candidate.length < 2) {
      setSlugCheck(null);
      setChosenSlug(null);
      return;
    }
    const t = setTimeout(() => {
      callSlugCheck({ tenant_slug: candidate });
    }, 350);
    return () => clearTimeout(t);
  }, [slugDraft, step]); // eslint-disable-line react-hooks/exhaustive-deps


  // Step 1 → step 2: insert a placeholder corporate_stores row in
  // 'provisioning' status with a non-claimable temp slug. The real
  // tenant_slug (the public URL) is NOT reserved until the user explicitly
  // publishes from step 3. This lets the theme picker scope its requests
  // to a real storeId while keeping the chosen URL available to others
  // until publish time.
  const provision = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not signed in");
      let finalSlug = chosenSlug;
      if (!finalSlug) {
        await callSlugCheck({ store_name: values.name });
        finalSlug = slugify(values.name);
      }
      if (!finalSlug) throw new Error("Could not derive a site address");

      const tempId = crypto.randomUUID();
      const [logo_url, favicon_url] = await Promise.all([
        logo ? uploadAsset(user.id, tempId, logo, "logo") : Promise.resolve(null),
        favicon ? uploadAsset(user.id, tempId, favicon, "favicon") : Promise.resolve(null),
      ]);

      // Use a slug-safe placeholder ([a-z0-9-]) so the storefront's tenant
      // validator accepts it for theme-listing calls during onboarding.
      const placeholderSlug = `pending-${tempId.replace(/-/g, "").slice(0, 16)}`;

      const { data, error } = await supabase
        .from("corporate_stores")
        .insert({
          user_id: user.id,
          name: values.name,
          contact_email: values.contact_email,
          custom_domain: values.custom_domain || null,
          primary_color: values.primary_color,
          font_family: values.font_family,
          store_type: values.store_type,
          logo_url,
          favicon_url,
          tenant_slug: placeholderSlug,
          requested_slug: finalSlug,
          status: "provisioning",
        })
        .select("id")
        .single();
      if (error) throw error;
      return { store_id: data.id };
    },
    onSuccess: (data) => {
      if (data?.store_id) setProvisionedStoreId(data.store_id);
    },
    onError: (e: Error) => {
      notify.error("Could not start setup", { description: e.message });
    },
  });

  // Step 3: actually publish the store — re-checks the chosen URL is still
  // available, assigns it as the real tenant_slug, and flips status to active.
  const publishStore = useMutation({
    mutationFn: async () => {
      if (!provisionedStoreId) throw new Error("Store not ready yet");
      if (!chosenSlug) throw new Error("Missing site address");

      // Re-check availability at publish time to handle races.
      const { data: existing, error: checkErr } = await supabase
        .from("corporate_stores")
        .select("id,tenant_slug")
        .eq("tenant_slug", chosenSlug)
        .neq("id", provisionedStoreId)
        .maybeSingle();
      if (checkErr) throw checkErr;
      if (existing) {
        throw new Error(
          `The address "${chosenSlug}" was just claimed by another store. Go back to step 1 and pick a different one.`,
        );
      }

      const { error } = await supabase
        .from("corporate_stores")
        .update({ tenant_slug: chosenSlug, status: "active" })
        .eq("id", provisionedStoreId);
      if (error) throw error;
    },
    onError: (e: Error) => {
      notify.error("Could not publish store", { description: e.message });
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

  // Step 1 → Step 2: validate identity, ensure slug, provision the store row.
  const goNextFromStep1 = async () => {
    if (!validateStep1()) return;
    if (!chosenSlug) {
      notify.error("Please confirm a site address");
      return;
    }
    if (provisionedStoreId) {
      setStep(2);
      return;
    }
    try {
      await provision.mutateAsync();
      setStep(2);
    } catch {
      // Stay on step 1; inline error block below will show details.
    }
  };

  // Step 2 → Step 3: upload branding assets, persist branding, apply selected template.
  const goNextFromStep2 = async () => {
    if (!provisionedStoreId) {
      setStep(3);
      return;
    }
    setSeedingTemplate(true);
    try {
      // Upload new branding assets if the user added any.
      const [newLogoUrl, newFaviconUrl] = await Promise.all([
        logo ? uploadAsset(user!.id, provisionedStoreId, logo, "logo") : Promise.resolve(null),
        favicon ? uploadAsset(user!.id, provisionedStoreId, favicon, "favicon") : Promise.resolve(null),
      ]);

      // Persist branding fields (color, font, logos).
      const updatePayload: {
        primary_color: string;
        font_family: string;
        logo_url?: string;
        favicon_url?: string;
      } = {
        primary_color: values.primary_color,
        font_family: values.font_family,
      };
      if (newLogoUrl) updatePayload.logo_url = newLogoUrl;
      if (newFaviconUrl) updatePayload.favicon_url = newFaviconUrl;
      const { error: updateErr } = await supabase
        .from("corporate_stores")
        .update(updatePayload)
        .eq("id", provisionedStoreId);
      if (updateErr) throw updateErr;

      // Apply selected template via set-template; storefront uses its default otherwise.
      if (selectedTemplateId && !templateSeeded) {
        await cms(provisionedStoreId, "set-template", { template_id: selectedTemplateId });
        setTemplateSeeded(true);
      }
      setStep(3);
    } catch (e) {
      notify.error("Couldn't save branding & theme", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSeedingTemplate(false);
    }
  };

  const finishOnboarding = () => {
    toast({
      title: "Store provisioning started",
      description: "Your branded store is being prepared — this can take 1–2 minutes.",
    });
    onCreated();
  };

  

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{isResume ? `Finish setup — ${resumeStore?.name}` : "New store"}</DialogTitle>
        <DialogDescription>
          {isResume
            ? "Pick up where you left off. Choose a theme and connect Stripe to start accepting payments."
            : "A clean, guided flow to launch a Printonet-branded store."}
        </DialogDescription>
      </DialogHeader>

      <StepIndicator step={step} total={3} labels={STEP_LABELS} />

      {step === 1 && (
        <div className="space-y-5 rounded-lg border bg-sky-50/60 p-5">
          <StoreFormFields
            values={values}
            setField={setField}
            errors={errors}
            logo={logo}
            setLogo={setLogo}
            favicon={favicon}
            setFavicon={setFavicon}
            hideCustomDomain
            section="identity"
          />

          <Separator />

          <div className="space-y-3">
            <div>
              <Label htmlFor="slug" className="text-sm font-medium">
                Site address
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                The public URL where your store will live. Edit it if you'd like.
              </p>
            </div>

            <div className="flex items-stretch rounded-md border bg-background overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
              <div className="hidden sm:flex items-center px-3 bg-muted/60 text-sm text-muted-foreground font-mono border-r">
                stores.printonet.com/
              </div>
              <Input
                id="slug"
                value={slugDraft}
                onChange={(e) => {
                  setSlugManuallyEdited(true);
                  setSlugDraft(e.target.value.toLowerCase());
                }}
                placeholder="acme"
                className="border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 font-mono"
              />
              <div className="flex items-center px-3 text-xs text-muted-foreground border-l">
                {checking ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : slugCheck && slugCheck.available && chosenSlug === slugify(slugDraft) ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : slugCheck && !slugCheck.available ? (
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                ) : null}
              </div>
            </div>

            {slugCheck && (
              <div className="min-h-[1.25rem]">
                {slugCheck.available && chosenSlug ? (
                  <p className="text-xs text-emerald-600 dark:text-emerald-500">
                    <span className="font-medium">{chosenSlug}</span> is available — your store will be at{" "}
                    <span className="font-mono">stores.printonet.com/{chosenSlug}</span>
                  </p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-amber-700 dark:text-amber-500">
                      <span className="font-medium">{slugCheck.tenant_slug}</span> is taken. Try one of these:
                    </p>
                    {slugCheck.suggestions && slugCheck.suggestions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {slugCheck.suggestions.map((s) => (
                          <Button
                            key={s}
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs font-mono"
                            onClick={() => {
                              setSlugManuallyEdited(true);
                              setSlugDraft(s);
                            }}
                          >
                            {s}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-start gap-3 rounded-md border bg-sky-50/60 px-4 py-3 text-sm">
            <Globe className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
            <div>
              <div className="font-medium">Want to use your own domain?</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                You can connect a custom domain like <span className="font-mono">merch.yourcompany.com</span> after your store is created — from the store's settings page.
              </div>
            </div>
          </div>

          {provision.isError && (
            <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900/50 p-3 text-sm text-amber-900 dark:text-amber-200">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="font-medium">Couldn't create your store</p>
                <p className="text-xs opacity-90">
                  {provision.error instanceof Error
                    ? provision.error.message
                    : "Something went wrong. Please try again."}
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={goNextFromStep1} disabled={!chosenSlug || provision.isPending}>
              {provision.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {provision.isError ? "Try again" : "Continue"}
            </Button>
          </DialogFooter>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5 rounded-lg border bg-sky-50/60 p-5">
          <div className="space-y-4">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Branding (optional)</h3>
              <p className="text-xs text-muted-foreground">
                Logo, color, and font — you can also set this later.
              </p>
            </div>
            <StoreFormFields
              values={values}
              setField={setField}
              errors={errors}
              logo={logo}
              setLogo={setLogo}
              favicon={favicon}
              setFavicon={setFavicon}
              section="branding"
            />
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Choose a theme</h3>
            <p className="text-xs text-muted-foreground">
              Pick a starting design — you can change it anytime from store settings.
            </p>
            {provisionedStoreId ? (
              <StoreThemePicker
                storeId={provisionedStoreId}
                selectedId={selectedTemplateId}
                onSelect={setSelectedTemplateId}
              />
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
                <Loader2 className="h-4 w-4 animate-spin" /> Preparing store…
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            {!isResume && (
              <Button variant="outline" onClick={() => setStep(1)} disabled={seedingTemplate}>
                Back
              </Button>
            )}
            <Button onClick={goNextFromStep2} disabled={seedingTemplate || !provisionedStoreId}>
              {seedingTemplate && <Loader2 className="h-4 w-4 animate-spin" />}
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
                  <div className="rounded-md border bg-sky-50/60 p-3 text-sm">
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

          <DialogFooter className="gap-2 sm:justify-between items-center">
            <Button variant="ghost" size="sm" onClick={() => setStep(2)} disabled={provision.isPending || publishStore.isPending}>
              Back
            </Button>
            <div className="flex items-center gap-3">
              {!stripeStatus?.connected && (
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      await publishStore.mutateAsync();
                      toast({
                        title: "Store published — Stripe not connected yet",
                        description:
                          "You need to connect Stripe to be able to accept payments in your store checkout. Please finish setting up your Stripe checkout as soon as possible.",
                        duration: 10000,
                      });
                      finishOnboarding();
                    } catch {
                      /* handled in onError */
                    }
                  }}
                  disabled={publishStore.isPending || !provisionedStoreId}
                >
                  {publishStore.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Skip and Publish Store
                </Button>
              )}
              <Button
                onClick={async () => {
                  try {
                    await publishStore.mutateAsync();
                    finishOnboarding();
                  } catch {
                    /* handled in onError */
                  }
                }}
                disabled={publishStore.isPending || !provisionedStoreId}
              >
                {publishStore.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {stripeStatus?.connected ? "Publish store" : "Finish"}
              </Button>
            </div>
          </DialogFooter>
        </div>
      )}
    </DialogContent>
  );
}

export function EditStoreDialog({
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
  const [footerLogo, setFooterLogo] = useState<File | null>(null);
  const [existing, setExisting] = useState({
    logo_url: store.logo_url,
    favicon_url: store.favicon_url,
    secondary_logo_url: store.secondary_logo_url,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setField = <K extends keyof FormValues>(k: K, v: FormValues[K]) =>
    setValues((p) => ({ ...p, [k]: v }));

  const onClearExisting = (kind: "logo" | "favicon" | "footer") => {
    setExisting((p) => ({
      ...p,
      logo_url: kind === "logo" ? null : p.logo_url,
      favicon_url: kind === "favicon" ? null : p.favicon_url,
      secondary_logo_url: kind === "footer" ? null : p.secondary_logo_url,
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

      const [newLogoUrl, newFaviconUrl, newFooterLogoUrl] = await Promise.all([
        logo ? uploadAsset(user.id, store.id, logo, "logo") : Promise.resolve(null),
        favicon ? uploadAsset(user.id, store.id, favicon, "favicon") : Promise.resolve(null),
        footerLogo ? uploadAsset(user.id, store.id, footerLogo, "footer-logo") : Promise.resolve(null),
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
          secondary_logo_url: newFooterLogoUrl ?? existing.secondary_logo_url,
        })
        .eq("id", store.id);
      if (updateErr) throw updateErr;

      // Branding lives in the corporate_stores row directly — the linked
      // Lovable storefront reads from it. No external push needed.
    },
    onSuccess: () => {
      toast({ title: "Branding updated" });
      onSaved();
    },
    onError: (e: Error) => {
      notify.error("Could not save changes", { description: e.message });
    },
  });

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Edit "{store.name}"</DialogTitle>
        <DialogDescription>
          Update your store branding fields below.
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
        footerLogo={footerLogo}
        setFooterLogo={setFooterLogo}
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
