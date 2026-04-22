import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, ExternalLink, Upload, X, RefreshCw, AlertCircle, CheckCircle2, Clock, MoreVertical, Pause, Play, Trash2, PauseCircle, Pencil } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
});

type FormValues = z.infer<typeof formSchema>;

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
  instawp_site_url: string | null;
  instawp_admin_url: string | null;
  status: "provisioning" | "active" | "failed" | "paused";
  error_message: string | null;
  created_at: string;
};

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
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

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
        provisioningIds.map((id) =>
          supabase.functions.invoke("check-corporate-store-status", {
            body: { store_id: id },
          }),
        ),
      );
      queryClient.invalidateQueries({ queryKey: ["corporate_stores", user?.id] });
    }, 4000);
    return () => clearInterval(interval);
  }, [provisioningIds.join(","), queryClient, user?.id]);

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Corporate Stores</h1>
          <p className="text-muted-foreground mt-1">
            Provision branded WooCommerce stores for corporate clients (e.g. Pepsico employee merch).
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              New corporate store
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
            <div className="text-center py-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin" />
              <p className="text-sm">Loading…</p>
            </div>
          ) : stores.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">No corporate stores yet. Click "New corporate store" to create one.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store</TableHead>
                  <TableHead>Status</TableHead>
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
                          <div className="font-medium truncate">{s.name}</div>
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
                      {s.instawp_site_url ? (
                        <a
                          href={s.instawp_site_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                        >
                          {s.instawp_site_url.replace(/^https?:\/\//, "")}
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
    </div>
  );
}

function StoreActions({ store }: { store: CorporateStore }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
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
      {store.instawp_admin_url && isActive && (
        <Button asChild variant="outline" size="sm">
          <a href={store.instawp_admin_url} target="_blank" rel="noreferrer">
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

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{store.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently destroys the WooCommerce site and all of its data on
              InstaWP. This action cannot be undone.
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
}) {
  return (
    <div className="space-y-6 py-2">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Identity</h3>
        <div className="grid grid-cols-2 gap-3">
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
          <div className="space-y-1">
            <Label htmlFor="domain">Custom domain (optional)</Label>
            <Input id="domain" value={values.custom_domain} onChange={(e) => setField("custom_domain", e.target.value)} placeholder="merch.pepsico.com" />
            {errors.custom_domain && <p className="text-xs text-destructive">{errors.custom_domain}</p>}
          </div>
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

function NewStoreDialog({ onCreated }: { onCreated: () => void }) {
  const { user } = useAuth();
  const [values, setValues] = useState<FormValues>({
    name: "",
    contact_email: "",
    custom_domain: "",
    primary_color: "#7c3aed",
    font_family: "Inter",
  });
  const [logo, setLogo] = useState<File | null>(null);
  const [favicon, setFavicon] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const provision = useMutation({
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

      const tempId = crypto.randomUUID();
      const [logo_url, favicon_url] = await Promise.all([
        logo ? uploadAsset(user.id, tempId, logo, "logo") : Promise.resolve(null),
        favicon ? uploadAsset(user.id, tempId, favicon, "favicon") : Promise.resolve(null),
      ]);

      const { data, error } = await supabase.functions.invoke("provision-corporate-store", {
        body: {
          ...parsed.data,
          custom_domain: parsed.data.custom_domain || null,
          logo_url,
          favicon_url,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Store provisioning started", description: "Your branded store is being prepared — this can take 1–2 minutes." });
      onCreated();
    },
    onError: (e: Error) => {
      toast({ title: "Could not create store", description: e.message, variant: "destructive" });
    },
  });

  const setField = <K extends keyof FormValues>(k: K, v: FormValues[K]) =>
    setValues((p) => ({ ...p, [k]: v }));

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>New corporate store</DialogTitle>
        <DialogDescription>
          Printonet provisions a fresh, branded WooCommerce store and pushes your colors, fonts, and logos automatically.
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
      />

      <DialogFooter>
        <Button onClick={() => provision.mutate()} disabled={provision.isPending}>
          {provision.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Provision store
        </Button>
      </DialogFooter>
    </DialogContent>
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
    accent_color: store.accent_color,
    font_family: store.font_family,
  });
  const [logo, setLogo] = useState<File | null>(null);
  const [secondaryLogo, setSecondaryLogo] = useState<File | null>(null);
  const [favicon, setFavicon] = useState<File | null>(null);
  const [existing, setExisting] = useState({
    logo_url: store.logo_url,
    secondary_logo_url: store.secondary_logo_url,
    favicon_url: store.favicon_url,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setField = <K extends keyof FormValues>(k: K, v: FormValues[K]) =>
    setValues((p) => ({ ...p, [k]: v }));

  const onClearExisting = (kind: "logo" | "secondary" | "favicon") => {
    setExisting((p) => ({
      ...p,
      logo_url: kind === "logo" ? null : p.logo_url,
      secondary_logo_url: kind === "secondary" ? null : p.secondary_logo_url,
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

      const [newLogoUrl, newSecondaryUrl, newFaviconUrl] = await Promise.all([
        logo ? uploadAsset(user.id, store.id, logo, "logo") : Promise.resolve(null),
        secondaryLogo ? uploadAsset(user.id, store.id, secondaryLogo, "secondary-logo") : Promise.resolve(null),
        favicon ? uploadAsset(user.id, store.id, favicon, "favicon") : Promise.resolve(null),
      ]);

      const { error: updateErr } = await supabase
        .from("corporate_stores")
        .update({
          name: parsed.data.name,
          contact_email: parsed.data.contact_email,
          custom_domain: parsed.data.custom_domain || null,
          primary_color: parsed.data.primary_color,
          accent_color: parsed.data.accent_color,
          font_family: parsed.data.font_family,
          logo_url: newLogoUrl ?? existing.logo_url,
          secondary_logo_url: newSecondaryUrl ?? existing.secondary_logo_url,
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
        secondaryLogo={secondaryLogo}
        setSecondaryLogo={setSecondaryLogo}
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
