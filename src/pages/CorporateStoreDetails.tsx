import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
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
  PauseCircle,
  Type,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";

type CorporateStore = {
  id: string;
  user_id: string;
  name: string;
  contact_email: string;
  custom_domain: string | null;
  primary_color: string;
  accent_color: string;
  font_family: string;
  logo_url: string | null;
  secondary_logo_url: string | null;
  favicon_url: string | null;
  wp_site_url: string | null;
  wp_admin_url: string | null;
  wp_site_id: string | null;
  store_admin_url: string | null;
  store_login_url: string | null;
  admin_username: string | null;
  admin_password: string | null;
  admin_user_id: string | null;
  tenant_slug: string | null;
  status: "provisioning" | "active" | "failed" | "paused";
  error_message: string | null;
  created_at: string;
};

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
              <span className="text-sm text-muted-foreground">
                Created {new Date(store.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {store.wp_site_url && (
            <Button asChild variant="outline">
              <a href={store.wp_site_url} target="_blank" rel="noreferrer">
                <Globe className="h-4 w-4" /> Visit store
              </a>
            </Button>
          )}
          {adminUrl && (
            <Button asChild>
              <a href={adminUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" /> Open WP Admin
              </a>
            </Button>
          )}
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
          <CardHeader>
            <CardTitle>Identity</CardTitle>
            <CardDescription>Basic store information.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate">{store.contact_email}</span>
            </div>
            {store.custom_domain && (
              <div className="flex items-center gap-2 text-sm">
                <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate">{store.custom_domain}</span>
              </div>
            )}
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
    </div>
  );
}
