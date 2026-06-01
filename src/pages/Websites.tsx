import { useState } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Plus,
  Globe,
  ExternalLink,
  Trash2,
  MoreVertical,
  AlertCircle,
  CheckCircle2,
  PauseCircle,
  Clock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { CorporateStore } from "@/types/corporateStore";

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

const formSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  contact_email: z.string().trim().email("Invalid email").max(255),
  tenant_slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(40)
    .regex(SLUG_RE, "Lowercase letters, numbers, and dashes only."),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be hex like #7c3aed"),
  font_family: z.string().min(1),
});
type FormValues = z.infer<typeof formSchema>;

const FONT_OPTIONS = [
  "Inter",
  "Space Grotesk",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Poppins",
  "Playfair Display",
  "Merriweather",
  "DM Sans",
];

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

export default function Websites() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: sites = [], isLoading } = useQuery({
    queryKey: ["websites", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("corporate_stores")
        .select("*")
        .eq("user_id", user!.id)
        .eq("store_type", "website")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CorporateStore[];
    },
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1280px] mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Websites</h1>
          <p className="text-muted-foreground mt-1">
            Build informational marketing sites with pages, navigation, and a blog. No
            commerce, no checkout — just content.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" /> New website
            </Button>
          </DialogTrigger>
          <NewWebsiteDialog
            onCreated={() => {
              setOpen(false);
              qc.invalidateQueries({ queryKey: ["websites", user?.id] });
            }}
          />
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your websites</CardTitle>
          <CardDescription>
            Each website lives on a dedicated URL. Add pages, build navigation, and
            publish a blog from one place.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-3 border-b last:border-0">
                  <Skeleton className="h-8 w-8 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-64" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              ))}
            </div>
          ) : sites.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Globe className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="font-medium text-sm">No websites yet</p>
              <p className="text-xs mt-1">
                Click "New website" to spin up your first informational site.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Website</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sites.map((s) => (
                  <SiteRow key={s.id} site={s} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SiteRow({ site }: { site: CorporateStore }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const publicUrl = site.custom_domain
    ? `https://${site.custom_domain}`
    : site.tenant_slug
    ? `https://sites.printonet.com/${site.tenant_slug}`
    : null;

  const remove = async () => {
    setBusy(true);
    const { error } = await supabase.from("corporate_stores").delete().eq("id", site.id);
    setBusy(false);
    if (error) {
      toast({ title: "Could not delete", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Website deleted" });
    qc.invalidateQueries({ queryKey: ["websites", user?.id] });
    setConfirmDelete(false);
  };

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          {site.logo_url ? (
            <img src={site.logo_url} alt="" className="h-8 w-8 rounded object-contain bg-muted" />
          ) : (
            <div className="h-8 w-8 rounded shrink-0" style={{ background: site.primary_color }} />
          )}
          <div className="min-w-0">
            <div className="font-medium truncate">{site.name}</div>
            <div className="text-xs text-muted-foreground truncate">{site.contact_email}</div>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <StatusBadge status={site.status} />
      </TableCell>
      <TableCell>
        {publicUrl ? (
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-mono text-primary hover:underline inline-flex items-center gap-1"
          >
            {publicUrl.replace(/^https?:\/\//, "")}
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to={`/websites/${site.id}`}>Manage</Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="h-4 w-4" /> Delete website
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete "{site.name}"?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes the website and all of its pages and posts.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  remove();
                }}
                disabled={busy}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Delete permanently
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TableCell>
    </TableRow>
  );
}

function NewWebsiteDialog({ onCreated }: { onCreated: () => void }) {
  const { user } = useAuth();
  const [values, setValues] = useState<FormValues>({
    name: "",
    contact_email: user?.email ?? "",
    tenant_slug: "",
    primary_color: "#7c3aed",
    font_family: "Inter",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof FormValues>(k: K, v: FormValues[K]) =>
    setValues((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    const parsed = formSchema.safeParse(values);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => {
        if (i.path[0]) errs[String(i.path[0])] = i.message;
      });
      setErrors(errs);
      return;
    }
    setErrors({});
    setSaving(true);
    const { error } = await supabase.from("corporate_stores").insert({
      user_id: user!.id,
      name: parsed.data.name,
      contact_email: parsed.data.contact_email,
      tenant_slug: parsed.data.tenant_slug,
      requested_slug: parsed.data.tenant_slug,
      primary_color: parsed.data.primary_color,
      accent_color: parsed.data.primary_color,
      font_family: parsed.data.font_family,
      store_type: "website",
      status: "active",
    });
    setSaving(false);
    if (error) {
      toast({ title: "Could not create website", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Website created", description: "You can start adding pages and posts." });
    onCreated();
  };

  return (
    <DialogContent className="max-w-xl">
      <DialogHeader>
        <DialogTitle>Create a new website</DialogTitle>
        <DialogDescription>
          An informational website with pages, navigation, and a blog. You can change branding
          and content later.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Website name</Label>
          <Input
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Acme Studio"
          />
          {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
        </div>

        <div className="space-y-1.5">
          <Label>Contact email</Label>
          <Input
            type="email"
            value={values.contact_email}
            onChange={(e) => set("contact_email", e.target.value)}
          />
          {errors.contact_email && (
            <p className="text-xs text-destructive">{errors.contact_email}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Subdomain</Label>
          <div className="flex items-center gap-2">
            <Input
              value={values.tenant_slug}
              onChange={(e) =>
                set("tenant_slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
              }
              placeholder="acme-studio"
            />
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              .sites.printonet.com
            </span>
          </div>
          {errors.tenant_slug && <p className="text-xs text-destructive">{errors.tenant_slug}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Brand color</Label>
            <div className="flex items-center gap-2">
              <Input
                type="color"
                value={values.primary_color}
                onChange={(e) => set("primary_color", e.target.value)}
                className="h-10 w-14 p-1"
              />
              <Input
                value={values.primary_color}
                onChange={(e) => set("primary_color", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Font</Label>
            <select
              value={values.font_family}
              onChange={(e) => set("font_family", e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Create website
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
