import { useMemo, useState } from "react";

const MULTI_TLDS = ["co.uk", "org.uk", "ac.uk", "gov.uk", "com.au", "net.au", "org.au", "co.nz", "co.jp", "com.br", "co.za"];

function DnsPreview({ domainDraft }: { domainDraft: string }) {
  const SERVER_IP = "185.158.133.1";
  const { host, txtHost } = useMemo(() => {
    const raw = (domainDraft || "").trim().toLowerCase();
    const domain = raw
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "")
      .replace(/^www\./, "");
    const parts = domain.split(".").filter(Boolean);
    const endsWithMultiTld = MULTI_TLDS.some((t) => domain.endsWith(`.${t}`));
    const isApex =
      !!domain && parts.length >= 2 && (endsWithMultiTld ? parts.length === 3 : parts.length === 2);
    const subdomain =
      isApex || parts.length < 2 ? "" : parts.slice(0, endsWithMultiTld ? -3 : -2).join(".");
    return {
      host: !domain || isApex ? "@" : subdomain || "@",
      txtHost: !domain || isApex ? "_lovable" : `_lovable.${subdomain}`,
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
          <span className="break-all">(provided by Lovable when you add the domain)</span>
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
import { Link, useNavigate, useParams } from "react-router-dom";
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
  KeyRound,
  Loader2,
  LogIn,
  Mail,
  Package,
  Pause,
  PauseCircle,
  Pencil,
  Play,
  Trash2,
  Type,
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
import { toast } from "@/hooks/use-toast";
import { CorporateStore } from "@/types/corporateStore";
import { PushProductsDialog } from "@/components/PushProductsDialog";
import { StoreCustomizableProducts } from "@/components/StoreCustomizableProducts";
import { StoreCustomizerSettings } from "@/components/StoreCustomizerSettings";


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
  const queryClient = useQueryClient();
  const [pushOpen, setPushOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmPause, setConfirmPause] = useState(false);
  const [busy, setBusy] = useState<null | "pause" | "resume" | "delete">(null);
  const [editOpen, setEditOpen] = useState(false);
  const [domainDraft, setDomainDraft] = useState("");
  const [savingDomain, setSavingDomain] = useState(false);

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

  const adminUrl = store.store_admin_url || store.wp_admin_url;
  const loginUrl =
    store.store_login_url ||
    (store.wp_site_url ? `${store.wp_site_url.replace(/\/$/, "")}/wp-login.php` : null);
  const hasCreds =
    !!adminUrl || !!loginUrl || !!store.admin_username || !!store.admin_password;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/corporate-stores")}>
          <ArrowLeft className="h-4 w-4" /> Back to corporate stores
        </Button>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 min-w-0">
          {store.logo_url ? (
            <img
              src={store.logo_url}
              alt=""
              className="h-16 w-16 rounded-md object-contain bg-muted border"
            />
          ) : (
            <div
              className="h-16 w-16 rounded-md border shrink-0"
              style={{ background: store.primary_color }}
            />
          )}
          <div className="min-w-0">
            <h1 className="text-3xl font-bold tracking-tight truncate">{store.name}</h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <StatusBadge status={store.status} />
              {store.store_type === "corporate" && (
                <Badge variant="secondary" className="gap-1">
                  <Package className="h-3 w-3" /> Corporate
                </Badge>
              )}
              <span className="text-sm text-muted-foreground">
                Created {new Date(store.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap flex-1 justify-end">
          <div className="flex items-center gap-2 flex-wrap">
            {store.wp_site_url && (
              <Button asChild variant="outline">
                <a href={store.wp_site_url} target="_blank" rel="noreferrer">
                  <Globe className="h-4 w-4" /> Visit store
                </a>
              </Button>
            )}
            {adminUrl && (
              <Button asChild variant="outline">
                <a href={adminUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" /> Open WP Admin
                </a>
              </Button>
            )}
            {store.status === "active" && (
              <Button onClick={() => setPushOpen(true)}>
                <Package className="h-4 w-4" /> Push products
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap ml-auto">
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
              variant="destructive"
              onClick={() => setConfirmDelete(true)}
              disabled={busy !== null}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </div>
        </div>
      </div>

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

      <div className="grid gap-6 md:grid-cols-2">
        {/* Identity */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
            <div>
              <CardTitle>Identity</CardTitle>
              <CardDescription>Basic store information.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={openEditDomain}>
              <Pencil className="h-3.5 w-3.5" /> Edit domain
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate">{store.contact_email}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
              {store.custom_domain ? (
                <span className="truncate">{store.custom_domain}</span>
              ) : (
                <span className="text-muted-foreground italic">No custom domain</span>
              )}
            </div>
            {store.tenant_slug && (
              <CopyField label="Tenant slug" value={store.tenant_slug} mono />
            )}
            {store.wp_site_id && (
              <CopyField label="Site ID" value={store.wp_site_id} mono />
            )}
            {store.wp_site_url && (
              <CopyField label="Site URL" value={store.wp_site_url} mono />
            )}
          </CardContent>
        </Card>

        {/* Branding */}
        <Card>
          <CardHeader>
            <CardTitle>Branding</CardTitle>
            <CardDescription>Theme tokens applied to the storefront.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <ColorSwatch label="Primary color" value={store.primary_color} />
              <ColorSwatch label="Accent color" value={store.accent_color} />
            </div>
            <Separator />
            <div className="flex items-center gap-2 text-sm">
              <Type className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>{store.font_family}</span>
            </div>
            {(store.logo_url || store.secondary_logo_url || store.favicon_url) && (
              <>
                <Separator />
                <div className="grid grid-cols-3 gap-3">
                  {store.logo_url && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Logo</p>
                      <div className="h-16 rounded-md border bg-muted flex items-center justify-center overflow-hidden">
                        <img src={store.logo_url} alt="" className="h-full w-full object-contain" />
                      </div>
                    </div>
                  )}
                  {store.secondary_logo_url && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Secondary</p>
                      <div className="h-16 rounded-md border bg-muted flex items-center justify-center overflow-hidden">
                        <img src={store.secondary_logo_url} alt="" className="h-full w-full object-contain" />
                      </div>
                    </div>
                  )}
                  {store.favicon_url && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Favicon</p>
                      <div className="h-16 rounded-md border bg-muted flex items-center justify-center overflow-hidden">
                        <img src={store.favicon_url} alt="" className="h-full w-full object-contain" />
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Credentials */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" /> Admin credentials
          </CardTitle>
          <CardDescription>
            Sign-in details delivered by the multi-tenant platform when this store was provisioned.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!hasCreds ? (
            <div className="text-sm text-muted-foreground">
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

              <div className="grid gap-4 md:grid-cols-2">
                {adminUrl && <CopyField label="Admin URL" value={adminUrl} mono />}
                {loginUrl && <CopyField label="Login URL" value={loginUrl} mono />}
                {store.admin_username && (
                  <CopyField label="Username" value={store.admin_username} mono />
                )}
                {store.admin_password && (
                  <PasswordCopyField label="Password" value={store.admin_password} />
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Treat these credentials as sensitive. We recommend the store owner change the password after first login.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <StoreCustomizableProducts store={store} />

      <StoreCustomizerSettings storeName={store.name} />

      <PushProductsDialog store={store} open={pushOpen} onOpenChange={setPushOpen} />

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

            {(() => {
              const SERVER_IP = "185.158.133.1";
              // Normalize: strip protocol, paths, leading www., and trim
              const raw = domainDraft.trim().toLowerCase();
              const domain = raw
                .replace(/^https?:\/\//, "")
                .replace(/\/.*$/, "")
                .replace(/^www\./, "");
              // Multi-level public suffixes that should still count as apex
              const MULTI_TLDS = ["co.uk", "org.uk", "ac.uk", "gov.uk", "com.au", "net.au", "org.au", "co.nz", "co.jp", "com.br", "co.za"];
              const parts = domain.split(".").filter(Boolean);
              const endsWithMultiTld = MULTI_TLDS.some((t) => domain.endsWith(`.${t}`));
              const isApex =
                !!domain && parts.length >= 2 && (endsWithMultiTld ? parts.length === 3 : parts.length === 2);
              const subdomain = isApex || parts.length < 2 ? "" : parts.slice(0, endsWithMultiTld ? -3 : -2).join(".");
              const host = !domain || isApex ? "@" : subdomain || "@";
              const txtHost = !domain || isApex ? "_lovable" : `_lovable.${subdomain}`;
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
                      <span className="break-all">(provided by Lovable when you add the domain)</span>
                      <span className="text-muted-foreground">TTL</span>
                      <span>Auto / 3600</span>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    DNS changes can take up to 24 hours to propagate. SSL is issued automatically once DNS resolves correctly.
                  </p>
                </div>
              );
            })()}
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
