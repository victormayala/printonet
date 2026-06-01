import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Loader2,
  Globe,
  LayoutDashboard,
  FileText,
  Navigation as NavIcon,
  BookOpen,
  Paintbrush,
  Settings as SettingsIcon,
  ExternalLink,
  AlertCircle,
  Upload,
  Cloud,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { CorporateStore } from "@/types/corporateStore";
import { WebsitePagesPanel } from "@/components/WebsitePagesPanel";
import { WebsiteNavigationEditor } from "@/components/WebsiteNavigationEditor";
import { WebsiteBlogPanel } from "@/components/WebsiteBlogPanel";
import { StoreContentCMS } from "@/components/StoreContentCMS";

const FONT_OPTIONS = [
  "Inter",
  "Space Grotesk",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Poppins",
  "Nunito",
  "Raleway",
  "Source Sans 3",
  "DM Sans",
  "IBM Plex Sans",
  "Work Sans",
  "Outfit",
  "Plus Jakarta Sans",
  "Playfair Display",
  "Lora",
];

export default function WebsiteDetails() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") ?? "overview";
  const setCurrentTab = (tab: string) => {
    const next = new URLSearchParams(searchParams);
    if (tab === "overview") next.delete("tab");
    else next.set("tab", tab);
    setSearchParams(next, { replace: true });
  };

  const { data: site, isLoading, error } = useQuery({
    queryKey: ["website", id, user?.id],
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
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading website…
      </div>
    );
  }

  if (error || !site || site.store_type !== "website") {
    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/websites">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
            <p>Website not found.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const publicUrl = site.custom_domain
    ? `https://${site.custom_domain}`
    : site.tenant_slug
    ? `https://stores.printonet.com/sites/${site.tenant_slug}`
    : null;


  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1280px] mx-auto">
      <Button variant="ghost" size="sm" onClick={() => navigate("/websites")}>
        <ArrowLeft className="h-4 w-4" /> Back to websites
      </Button>

      <header className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start gap-5 min-w-0">
            {site.logo_url ? (
              <img
                src={site.logo_url}
                alt=""
                className="h-16 w-16 rounded-xl object-contain bg-muted border shrink-0"
              />
            ) : (
              <div
                className="h-16 w-16 rounded-xl border shrink-0"
                style={{ background: site.primary_color }}
              />
            )}
            <div className="min-w-0 space-y-1.5">
              <h1 className="text-2xl font-bold tracking-tight truncate">{site.name}</h1>
              <p className="text-sm text-muted-foreground">
                Created{" "}
                <span className="text-foreground">
                  {new Date(site.created_at).toLocaleDateString()}
                </span>
              </p>
            </div>
          </div>
          {publicUrl && (
            <Button asChild variant="outline">
              <a href={publicUrl} target="_blank" rel="noreferrer">
                <Globe className="h-4 w-4" /> View site <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          )}
        </div>
      </header>

      <Tabs value={currentTab} onValueChange={setCurrentTab} className="space-y-6">
        <TabsList className="bg-muted/60 border h-auto flex-wrap gap-1 p-1.5">
          <TabsTrigger value="overview" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg px-4 py-2">
            <LayoutDashboard className="h-4 w-4" /> Overview
          </TabsTrigger>
          <TabsTrigger value="pages" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg px-4 py-2">
            <FileText className="h-4 w-4" /> Pages
          </TabsTrigger>
          <TabsTrigger value="navigation" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg px-4 py-2">
            <NavIcon className="h-4 w-4" /> Navigation
          </TabsTrigger>
          <TabsTrigger value="blog" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg px-4 py-2">
            <BookOpen className="h-4 w-4" /> Blog
          </TabsTrigger>
          <TabsTrigger value="storefront" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg px-4 py-2">
            <Cloud className="h-4 w-4" /> Storefront
          </TabsTrigger>
          <TabsTrigger value="branding" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg px-4 py-2">
            <Paintbrush className="h-4 w-4" /> Branding
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg px-4 py-2">
            <SettingsIcon className="h-4 w-4" /> Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewPanel site={site} />
        </TabsContent>
        <TabsContent value="pages">
          <WebsitePagesPanel site={site} />
        </TabsContent>
        <TabsContent value="navigation">
          <WebsiteNavigationEditor site={site} />
        </TabsContent>
        <TabsContent value="blog">
          <WebsiteBlogPanel site={site} />
        </TabsContent>
        <TabsContent value="branding">
          <BrandingPanel site={site} onSaved={() => qc.invalidateQueries({ queryKey: ["website", id, user?.id] })} />
        </TabsContent>
        <TabsContent value="settings">
          <SettingsPanel site={site} onSaved={() => qc.invalidateQueries({ queryKey: ["website", id, user?.id] })} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OverviewPanel({ site }: { site: CorporateStore }) {
  const publicUrl = site.custom_domain
    ? `https://${site.custom_domain}`
    : site.tenant_slug
    ? `https://stores.printonet.com/sites/${site.tenant_slug}`
    : null;
  const previewUrl = site.tenant_slug
    ? `https://platform.printonet.com/sites/${site.tenant_slug}`
    : null;


  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Public URL</CardTitle>
        </CardHeader>
        <CardContent>
          {publicUrl ? (
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-primary hover:underline break-all"
            >
              {publicUrl}
            </a>
          ) : (
            <p className="text-sm text-muted-foreground">No URL configured yet.</p>
          )}
          {previewUrl && (
            <p className="text-xs text-muted-foreground mt-2">
              Public renderer ships on stores.printonet.com.{" "}
              <a
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-foreground"
              >
                Preview on platform
              </a>
              {" "}while it's being built.
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            Set a custom domain in Settings to point your own URL at this site.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm capitalize">{site.status}</p>
          <p className="text-xs text-muted-foreground mt-2">
            Visitors only see pages and posts after the site is active.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function BrandingPanel({ site, onSaved }: { site: CorporateStore; onSaved: () => void }) {
  const [name, setName] = useState(site.name);
  const [primary, setPrimary] = useState(site.primary_color);
  const [accent, setAccent] = useState(site.accent_color);
  const [font, setFont] = useState(site.font_family);
  const [logo, setLogo] = useState(site.logo_url ?? "");
  const [favicon, setFavicon] = useState(site.favicon_url ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(site.name);
    setPrimary(site.primary_color);
    setAccent(site.accent_color);
    setFont(site.font_family);
    setLogo(site.logo_url ?? "");
    setFavicon(site.favicon_url ?? "");
  }, [site.id]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("corporate_stores")
      .update({
        name,
        primary_color: primary,
        accent_color: accent,
        font_family: font,
        logo_url: logo || null,
        favicon_url: favicon || null,
      })
      .eq("id", site.id);
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Branding saved" });
    onSaved();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Branding</CardTitle>
        <CardDescription>Visual identity for your website.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>Website name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Primary color</Label>
            <div className="flex items-center gap-2">
              <Input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="h-10 w-14 p-1" />
              <Input value={primary} onChange={(e) => setPrimary(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Accent color</Label>
            <div className="flex items-center gap-2">
              <Input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-10 w-14 p-1" />
              <Input value={accent} onChange={(e) => setAccent(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Font family</Label>
          <Input value={font} onChange={(e) => setFont(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Logo URL</Label>
          <Input value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="https://…" />
        </div>
        <div className="space-y-1.5">
          <Label>Favicon URL</Label>
          <Input value={favicon} onChange={(e) => setFavicon(e.target.value)} placeholder="https://…" />
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save branding
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SettingsPanel({ site, onSaved }: { site: CorporateStore; onSaved: () => void }) {
  const [email, setEmail] = useState(site.contact_email);
  const [domain, setDomain] = useState(site.custom_domain ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEmail(site.contact_email);
    setDomain(site.custom_domain ?? "");
  }, [site.id]);

  const save = async () => {
    const trimmed = domain.trim().toLowerCase();
    if (trimmed && !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(trimmed)) {
      toast({ title: "Invalid domain", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("corporate_stores")
      .update({ contact_email: email, custom_domain: trimmed || null })
      .eq("id", site.id);
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Settings saved" });
    onSaved();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Settings</CardTitle>
        <CardDescription>Contact info and custom domain.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>Contact email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Custom domain</Label>
          <Input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="www.yourbrand.com"
          />
          <p className="text-xs text-muted-foreground">
            Point an A record at <span className="font-mono">185.158.133.1</span> after saving.
          </p>
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
