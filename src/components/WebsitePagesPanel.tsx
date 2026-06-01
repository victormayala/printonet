import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Plus,
  FileText,
  Trash2,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Send,
  Save,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { CorporateStore } from "@/types/corporateStore";

type Page = {
  id: string;
  store_id: string;
  user_id: string;
  slug: string;
  title: string;
  sort_order: number;
  enabled: boolean;
  draft_data: any;
  published_data: any | null;
  published_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
  og_image_url: string | null;
  updated_at: string;
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

export function WebsitePagesPanel({ site }: { site: CorporateStore }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: pages = [], isLoading } = useQuery({
    queryKey: ["site-pages", site.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("site_pages")
        .select("*")
        .eq("store_id", site.id)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Page[];
    },
  });

  const reload = () => qc.invalidateQueries({ queryKey: ["site-pages", site.id] });

  const selected = pages.find((p) => p.id === selectedId) ?? pages[0] ?? null;

  const reorder = async (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= pages.length) return;
    const next = [...pages];
    [next[idx], next[j]] = [next[j], next[idx]];
    await Promise.all(
      next.map((p, i) =>
        (supabase as any).from("site_pages").update({ sort_order: i }).eq("id", p.id),
      ),
    );
    reload();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this page? This cannot be undone.")) return;
    const { error } = await (supabase as any).from("site_pages").delete().eq("id", id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    if (selectedId === id) setSelectedId(null);
    reload();
  };

  if (isLoading) {
    return (
      <div className="py-12 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading pages…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Pages</h2>
          <p className="text-sm text-muted-foreground">
            Add as many pages as you like. Use the slug to control the URL.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Add page
        </Button>
      </div>

      {pages.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="font-medium text-sm">No pages yet</p>
            <p className="text-xs mt-1">Start with a Home page, then add About, Services, Contact…</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Card>
            <CardHeader className="py-3 px-3">
              <CardDescription className="text-xs uppercase tracking-wide">
                {pages.length} page{pages.length === 1 ? "" : "s"}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-2 space-y-1">
              {pages.map((p, idx) => {
                const isSelected = (selected?.id ?? null) === p.id;
                return (
                  <div
                    key={p.id}
                    className={cn(
                      "group flex items-start gap-2 rounded-md border px-2.5 py-2 cursor-pointer transition-colors",
                      isSelected
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                        : "border-transparent hover:bg-muted/60",
                    )}
                    onClick={() => setSelectedId(p.id)}
                  >
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-[10px] font-semibold bg-muted text-muted-foreground">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium truncate">{p.title}</span>
                        {!p.enabled && (
                          <Badge variant="outline" className="h-4 px-1 text-[10px]">
                            Hidden
                          </Badge>
                        )}
                        {p.published_at ? (
                          <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                            Live
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="h-4 px-1 text-[10px]">
                            Draft
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">/{p.slug}</p>
                    </div>
                    <div className="flex flex-col -my-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-5 w-5"
                        onClick={(e) => {
                          e.stopPropagation();
                          reorder(idx, -1);
                        }}
                        disabled={idx === 0}
                      >
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-5 w-5"
                        onClick={(e) => {
                          e.stopPropagation();
                          reorder(idx, 1);
                        }}
                        disabled={idx === pages.length - 1}
                      >
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {selected ? (
            <PageEditor page={selected} onChanged={reload} onDelete={() => remove(selected.id)} />
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground text-sm">
                Select a page on the left to edit it.
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <NewPageDialog
          site={site}
          userId={user?.id ?? ""}
          existingSlugs={pages.map((p) => p.slug)}
          nextSort={pages.length}
          onCreated={() => {
            setCreateOpen(false);
            reload();
          }}
        />
      </Dialog>
    </div>
  );
}

function PageEditor({
  page,
  onChanged,
  onDelete,
}: {
  page: Page;
  onChanged: () => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(page.title);
  const [slug, setSlug] = useState(page.slug);
  const [enabled, setEnabled] = useState(page.enabled);
  const [body, setBody] = useState((page.draft_data?.body_md as string) ?? "");
  const [seoTitle, setSeoTitle] = useState(page.seo_title ?? "");
  const [seoDescription, setSeoDescription] = useState(page.seo_description ?? "");
  const [ogImage, setOgImage] = useState(page.og_image_url ?? "");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Reset state when switching pages.
  useState(() => undefined);

  const dirty =
    title !== page.title ||
    slug !== page.slug ||
    enabled !== page.enabled ||
    body !== ((page.draft_data?.body_md as string) ?? "") ||
    seoTitle !== (page.seo_title ?? "") ||
    seoDescription !== (page.seo_description ?? "") ||
    ogImage !== (page.og_image_url ?? "");

  const save = async () => {
    setSaving(true);
    const { error } = await (supabase as any)
      .from("site_pages")
      .update({
        title,
        slug,
        enabled,
        draft_data: { ...(page.draft_data ?? {}), body_md: body },
        seo_title: seoTitle || null,
        seo_description: seoDescription || null,
        og_image_url: ogImage || null,
      })
      .eq("id", page.id);
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Draft saved" });
    onChanged();
  };

  const publish = async () => {
    setPublishing(true);
    const draft = { ...(page.draft_data ?? {}), body_md: body };
    const { error } = await (supabase as any)
      .from("site_pages")
      .update({
        title,
        slug,
        enabled,
        draft_data: draft,
        published_data: draft,
        published_at: new Date().toISOString(),
        seo_title: seoTitle || null,
        seo_description: seoDescription || null,
        og_image_url: ogImage || null,
      })
      .eq("id", page.id);
    setPublishing(false);
    if (error) {
      toast({ title: "Publish failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Page published" });
    onChanged();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-base">{page.title}</CardTitle>
          <CardDescription>/{page.slug}</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEnabled((v) => !v)}
            title={enabled ? "Hide from site" : "Show on site"}
          >
            {enabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            {enabled ? "Visible" : "Hidden"}
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete} className="text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Slug</Label>
            <Input
              value={slug}
              onChange={(e) => setSlug(slugify(e.target.value))}
              placeholder="about"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Body (Markdown)</Label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={16}
            className="font-mono text-xs"
            placeholder="# Welcome&#10;&#10;Write your page content in Markdown…"
          />
        </div>

        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
          <p className="text-sm font-medium">SEO</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Title</Label>
              <Input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} maxLength={160} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">OG image URL</Label>
              <Input value={ogImage} onChange={(e) => setOgImage(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea
              value={seoDescription}
              onChange={(e) => setSeoDescription(e.target.value)}
              rows={2}
              maxLength={320}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {page.published_at
              ? `Last published ${new Date(page.published_at).toLocaleString()}`
              : "Draft only — not visible to site visitors."}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={save} disabled={saving || !dirty}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save draft
            </Button>
            <Button onClick={publish} disabled={publishing}>
              {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Publish
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function NewPageDialog({
  site,
  userId,
  existingSlugs,
  nextSort,
  onCreated,
}: {
  site: CorporateStore;
  userId: string;
  existingSlugs: string[];
  nextSort: number;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [saving, setSaving] = useState(false);

  const onTitleChange = (v: string) => {
    setTitle(v);
    setSlug((prev) => (prev === "" || prev === slugify(title) ? slugify(v) : prev));
  };

  const submit = async () => {
    const finalSlug = slug.trim() || slugify(title);
    if (!title.trim() || !finalSlug) {
      toast({ title: "Title and slug are required", variant: "destructive" });
      return;
    }
    if (existingSlugs.includes(finalSlug)) {
      toast({ title: "A page with that slug already exists", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any).from("site_pages").insert({
      store_id: site.id,
      user_id: userId,
      slug: finalSlug,
      title: title.trim(),
      sort_order: nextSort,
      enabled: true,
      draft_data: { body_md: "" },
    });
    setSaving(false);
    if (error) {
      toast({ title: "Could not create page", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Page created" });
    onCreated();
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>New page</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Title</Label>
          <Input value={title} onChange={(e) => onTitleChange(e.target.value)} placeholder="About us" />
        </div>
        <div className="space-y-1.5">
          <Label>Slug</Label>
          <Input value={slug} onChange={(e) => setSlug(slugify(e.target.value))} placeholder="about" />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Create page
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
