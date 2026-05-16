import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Code2,
  CheckCircle2,
  Loader2,
  Plus,
  Save,
  Send,
  Trash2,
  Upload,
} from "lucide-react";
import type { CorporateStore } from "@/types/corporateStore";
import { cms } from "@/lib/cmsClient";
import { BlockEditor, BLOCK_TYPES } from "@/components/cms/BlockEditor";
import { SiteSettingsEditor, ContentPageEditor } from "@/components/cms/SiteSettingsEditor";

// Bump in lock-step with storefront's `PLATFORM_CMS_SCHEMA_VERSION`.
const PLATFORM_CMS_SCHEMA_VERSION = 1;

type Block = {
  id: string;
  sort_order: number;
  block_type: string;
  enabled: boolean;
  draft_data: any;
  published_data: any | null;
  published_at: string | null;
  updated_at: string;
};

type NavItem = { label: string; href: string };

type ContentPage = {
  id: string;
  slug: string;
  enabled: boolean;
  draft: any;
  published_at: string | null;
  updated_at: string;
};

function JsonField({
  value,
  onChange,
  rows = 8,
  disabled,
}: {
  value: any;
  onChange: (v: any) => void;
  rows?: number;
  disabled?: boolean;
}) {
  const [text, setText] = useState<string>(() => JSON.stringify(value ?? {}, null, 2));
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    setText(JSON.stringify(value ?? {}, null, 2));
  }, [value]);
  return (
    <div className="space-y-1">
      <Textarea
        rows={rows}
        spellCheck={false}
        disabled={disabled}
        className="font-mono text-xs"
        value={text}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          try {
            const parsed = next.trim() === "" ? {} : JSON.parse(next);
            setErr(null);
            onChange(parsed);
          } catch (ex: any) {
            setErr(ex?.message ?? "Invalid JSON");
          }
        }}
      />
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  );
}

function HomepageBlocksPanel({ store, canPublish }: { store: CorporateStore; canPublish: boolean }) {
  const [blocks, setBlocks] = useState<Block[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, any>>({});
  const [newType, setNewType] = useState("hero");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await cms<{ blocks: Block[] }>(store.id, "list-blocks");
      setBlocks(res.blocks);
      setDrafts(Object.fromEntries(res.blocks.map((b) => [b.id, b.draft_data])));
    } catch (e: any) {
      toast({ title: "Could not load blocks", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [store.id]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (b: Block) => {
    setBusy(b.id);
    try {
      await cms(store.id, "upsert-block", {
        id: b.id,
        block_type: b.block_type,
        enabled: b.enabled,
        draft_data: drafts[b.id] ?? b.draft_data,
      });
      toast({ title: "Draft saved" });
      await load();
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const publish = async (id: string) => {
    setBusy(id);
    try {
      await cms(store.id, "publish-block", { id });
      toast({ title: "Block published" });
      await load();
    } catch (e: any) {
      toast({ title: "Publish failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this block?")) return;
    setBusy(id);
    try {
      await cms(store.id, "delete-block", { id });
      await load();
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const reorder = async (idx: number, dir: -1 | 1) => {
    if (!blocks) return;
    const next = [...blocks];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setBlocks(next);
    try {
      await cms(store.id, "reorder-blocks", { order: next.map((b) => b.id) });
    } catch (e: any) {
      toast({ title: "Reorder failed", description: e.message, variant: "destructive" });
      load();
    }
  };

  const addBlock = async () => {
    setBusy("__new");
    try {
      await cms(store.id, "upsert-block", {
        block_type: newType.trim(),
        enabled: true,
        draft_data: {},
      });
      toast({ title: "Block created" });
      await load();
    } catch (e: any) {
      toast({ title: "Create failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const publishAll = async () => {
    setBusy("__all");
    try {
      await cms(store.id, "publish-all-blocks", {});
      toast({ title: "All valid drafts published" });
      await load();
    } catch (e: any) {
      toast({ title: "Publish all failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="py-12 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading blocks…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-md border p-4 bg-muted/30">
        <div className="space-y-1">
          <Label className="text-xs">New block type</Label>
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            className="flex h-10 w-56 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {BLOCK_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <Button onClick={addBlock} disabled={busy === "__new" || !newType.trim()}>
          {busy === "__new" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add block
        </Button>
        <div className="flex-1" />
        <Button variant="outline" onClick={publishAll} disabled={!canPublish || busy === "__all"}>
          {busy === "__all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Publish all
        </Button>
      </div>

      {blocks?.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">No blocks yet.</p>
      )}

      {blocks?.map((b, idx) => (
        <Card key={b.id}>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <div className="flex items-center gap-2 min-w-0">
              <Badge variant="secondary" className="font-mono">{b.block_type}</Badge>
              {b.published_at ? (
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Published
                </Badge>
              ) : (
                <Badge variant="outline">Draft only</Badge>
              )}
              <span className="text-xs text-muted-foreground truncate">id: {b.id}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" onClick={() => reorder(idx, -1)} disabled={idx === 0}>
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => reorder(idx, 1)}
                disabled={idx === (blocks?.length ?? 1) - 1}
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => remove(b.id)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Switch
                checked={b.enabled}
                onCheckedChange={(v) => {
                  setBlocks((bs) => bs?.map((x) => (x.id === b.id ? { ...x, enabled: v } : x)) ?? null);
                }}
              />
              <Label className="text-sm">Enabled on storefront</Label>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Draft data (JSON)</Label>
              <JsonField
                value={drafts[b.id] ?? b.draft_data}
                onChange={(v) => setDrafts((d) => ({ ...d, [b.id]: v }))}
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => save(b)} disabled={busy === b.id}>
                {busy === b.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save draft
              </Button>
              <Button
                size="sm"
                variant="default"
                onClick={() => publish(b.id)}
                disabled={!canPublish || busy === b.id}
              >
                <Send className="h-4 w-4" /> Publish
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SiteSettingsPanel({ store, canPublish }: { store: CorporateStore; canPublish: boolean }) {
  const [settings, setSettings] = useState<any>(null);
  const [draft, setDraft] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await cms<{ settings: any }>(store.id, "get-site-settings");
      setSettings(res.settings);
      setDraft(res.settings?.draft_data ?? {});
    } catch (e: any) {
      toast({ title: "Could not load settings", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [store.id]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setBusy("save");
    try {
      await cms(store.id, "save-site-settings-draft", { draft });
      toast({ title: "Draft saved" });
      await load();
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const publish = async () => {
    setBusy("pub");
    try {
      await cms(store.id, "publish-site-settings", {});
      toast({ title: "Published" });
      await load();
    } catch (e: any) {
      toast({ title: "Publish failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const discard = async () => {
    if (!confirm("Discard draft changes?")) return;
    setBusy("dis");
    try {
      await cms(store.id, "discard-site-settings-draft", {});
      await load();
    } catch (e: any) {
      toast({ title: "Discard failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="py-12 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground">
        Last published:{" "}
        {settings?.published_at ? new Date(settings.published_at).toLocaleString() : "never"}
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Draft data (JSON)</Label>
        <JsonField value={draft} onChange={setDraft} rows={18} />
      </div>
      <div className="flex gap-2">
        <Button onClick={save} disabled={busy !== null}>
          {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save draft
        </Button>
        <Button variant="default" onClick={publish} disabled={!canPublish || busy !== null}>
          <Send className="h-4 w-4" /> Publish
        </Button>
        <Button variant="outline" onClick={discard} disabled={busy !== null}>
          Discard draft
        </Button>
      </div>
    </div>
  );
}

function ContentPagesPanel({ store, canPublish }: { store: CorporateStore; canPublish: boolean }) {
  const [pages, setPages] = useState<ContentPage[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, any>>({});
  const [newSlug, setNewSlug] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await cms<{ pages: ContentPage[] }>(store.id, "list-content-pages");
      setPages(res.pages);
      setDrafts(Object.fromEntries(res.pages.map((p) => [p.id, p.draft])));
    } catch (e: any) {
      toast({ title: "Could not load pages", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [store.id]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (p: ContentPage) => {
    setBusy(p.id);
    try {
      await cms(store.id, "upsert-content-page", {
        id: p.id,
        slug: p.slug,
        enabled: p.enabled,
        draft: drafts[p.id] ?? p.draft,
      });
      toast({ title: "Draft saved" });
      await load();
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const publish = async (id: string) => {
    setBusy(id);
    try {
      await cms(store.id, "publish-content-page", { id });
      toast({ title: "Published" });
      await load();
    } catch (e: any) {
      toast({ title: "Publish failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this page?")) return;
    setBusy(id);
    try {
      await cms(store.id, "delete-content-page", { id });
      await load();
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const create = async () => {
    if (!newSlug.trim()) return;
    setBusy("__new");
    try {
      await cms(store.id, "upsert-content-page", {
        slug: newSlug.trim(),
        enabled: true,
        draft: { title: newSlug.trim(), blocks: [] },
      });
      setNewSlug("");
      await load();
    } catch (e: any) {
      toast({ title: "Create failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="py-12 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading pages…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2 rounded-md border p-4 bg-muted/30">
        <div className="space-y-1 flex-1">
          <Label className="text-xs">New page slug</Label>
          <Input
            value={newSlug}
            onChange={(e) => setNewSlug(e.target.value)}
            placeholder="about"
          />
        </div>
        <Button onClick={create} disabled={busy === "__new" || !newSlug.trim()}>
          <Plus className="h-4 w-4" /> Create page
        </Button>
      </div>

      {pages?.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">No pages yet.</p>
      )}

      {pages?.map((p) => (
        <Card key={p.id}>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <div className="flex items-center gap-2 min-w-0">
              <Badge variant="secondary" className="font-mono">/{p.slug}</Badge>
              {p.published_at ? (
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Published
                </Badge>
              ) : (
                <Badge variant="outline">Draft only</Badge>
              )}
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => remove(p.id)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Switch
                checked={p.enabled}
                onCheckedChange={(v) =>
                  setPages((ps) => ps?.map((x) => (x.id === p.id ? { ...x, enabled: v } : x)) ?? null)
                }
              />
              <Label className="text-sm">Enabled</Label>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Draft (JSON)</Label>
              <JsonField
                value={drafts[p.id] ?? p.draft}
                onChange={(v) => setDrafts((d) => ({ ...d, [p.id]: v }))}
                rows={10}
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => save(p)} disabled={busy === p.id}>
                <Save className="h-4 w-4" /> Save draft
              </Button>
              <Button
                size="sm"
                onClick={() => publish(p.id)}
                disabled={!canPublish || busy === p.id}
              >
                <Send className="h-4 w-4" /> Publish
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AssetsPanel({ store }: { store: CorporateStore }) {
  const [busy, setBusy] = useState(false);
  const [uploads, setUploads] = useState<Array<{ name: string; url: string; size: number }>>([]);
  const [drag, setDrag] = useState(false);

  const handleFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files);
    if (!arr.length) return;
    setBusy(true);
    try {
      for (const file of arr) {
        const signed = await cms<{ upload_url: string; public_url: string; key?: string }>(
          store.id,
          "create-asset-upload-url",
          {
            filename: file.name,
            content_type: file.type || "application/octet-stream",
            size: file.size,
          },
        );
        const putRes = await fetch(signed.upload_url, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!putRes.ok) {
          throw new Error(`Upload failed (${putRes.status}) for ${file.name}`);
        }
        setUploads((u) => [
          { name: file.name, url: signed.public_url, size: file.size },
          ...u,
        ]);
      }
      toast({ title: `Uploaded ${arr.length} file${arr.length > 1 ? "s" : ""}` });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files);
        }}
        className={`rounded-md border-2 border-dashed p-8 text-center transition-colors ${
          drag ? "border-primary bg-primary/5" : "border-border bg-muted/30"
        }`}
      >
        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm font-medium">Drop files here, or</p>
        <div className="mt-3">
          <Label htmlFor="cms-asset-input" className="inline-block">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium cursor-pointer hover:bg-primary-hover">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Choose files
            </span>
            <input
              id="cms-asset-input"
              type="file"
              multiple
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                if (e.target.files) handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </Label>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Uploads are signed by the storefront and stored in its asset bucket.
        </p>
      </div>

      {uploads.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Recently uploaded (this session)</Label>
          {uploads.map((u, i) => (
            <div key={i} className="flex items-center gap-3 rounded-md border p-2 text-sm">
              {/^image\//.test(u.name) || /\.(png|jpe?g|gif|webp|svg)$/i.test(u.name) ? (
                <img src={u.url} alt={u.name} className="h-12 w-12 object-cover rounded" />
              ) : (
                <div className="h-12 w-12 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">
                  file
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{u.name}</p>
                <p className="text-xs text-muted-foreground">{(u.size / 1024).toFixed(1)} KB</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(u.url);
                  toast({ title: "URL copied" });
                }}
              >
                Copy URL
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NavigationPanel({ store, canPublish }: { store: CorporateStore; canPublish: boolean }) {
  const [items, setItems] = useState<NavItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await cms<{ items: NavItem[] }>(store.id, "list-nav-items");
      setItems(res.items ?? []);
    } catch (e: any) {
      toast({ title: "Could not load nav", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [store.id]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setBusy(true);
    try {
      await cms(store.id, "save-nav-items", { items });
      toast({ title: "Navigation saved" });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="py-12 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((it, i) => (
        <div key={i} className="flex gap-2 items-end">
          <div className="space-y-1 flex-1">
            <Label className="text-xs">Label</Label>
            <Input
              value={it.label}
              onChange={(e) => {
                const next = [...items];
                next[i] = { ...next[i], label: e.target.value };
                setItems(next);
              }}
            />
          </div>
          <div className="space-y-1 flex-1">
            <Label className="text-xs">Href</Label>
            <Input
              value={it.href}
              onChange={(e) => {
                const next = [...items];
                next[i] = { ...next[i], href: e.target.value };
                setItems(next);
              }}
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setItems(items.filter((_, j) => j !== i))}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => setItems([...items, { label: "", href: "" }])}
          disabled={items.length >= 20}
        >
          <Plus className="h-4 w-4" /> Add item
        </Button>
        <Button onClick={save} disabled={busy || !canPublish}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save navigation
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Saved navigation publishes immediately. Max 20 items.
      </p>
    </div>
  );
}

export function StoreContentCMS({ store }: { store: CorporateStore }) {
  const [serverVersion, setServerVersion] = useState<number | null>(null);
  const [versionErr, setVersionErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await cms<{ version: number }>(store.id, "schema-version", {}, "GET");
        if (!cancelled) setServerVersion(res.version);
      } catch (e: any) {
        if (!cancelled) setVersionErr(e.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [store.id]);

  const versionMismatch = serverVersion !== null && serverVersion !== PLATFORM_CMS_SCHEMA_VERSION;
  const canPublish = !versionMismatch;

  if (!store.tenant_slug) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          This store has no tenant slug yet, so the CMS can't be reached.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Storefront content</CardTitle>
        <CardDescription>
          Edit homepage blocks, site settings, content pages, and navigation for{" "}
          <span className="font-medium text-foreground">{store.name}</span>. Drafts save instantly;
          changes go live when you publish.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {versionErr && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 text-destructive shrink-0" />
            <div>
              <p className="font-medium">Can't reach storefront CMS</p>
              <p className="text-xs text-muted-foreground">{versionErr}</p>
            </div>
          </div>
        )}
        {versionMismatch && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
            <div>
              <p className="font-medium">Editor is out of date — publishing disabled</p>
              <p className="text-xs text-muted-foreground">
                Storefront expects schema v{serverVersion}, dashboard is on v
                {PLATFORM_CMS_SCHEMA_VERSION}. Redeploy the dashboard to publish again.
              </p>
            </div>
          </div>
        )}

        <Tabs defaultValue="blocks">
          <TabsList className="flex-wrap">
            <TabsTrigger value="blocks">Homepage</TabsTrigger>
            <TabsTrigger value="settings">Site settings</TabsTrigger>
            <TabsTrigger value="pages">Content pages</TabsTrigger>
            <TabsTrigger value="nav">Navigation</TabsTrigger>
            <TabsTrigger value="assets">Assets</TabsTrigger>
          </TabsList>
          <Separator className="my-4" />
          <TabsContent value="blocks">
            <HomepageBlocksPanel store={store} canPublish={canPublish} />
          </TabsContent>
          <TabsContent value="settings">
            <SiteSettingsPanel store={store} canPublish={canPublish} />
          </TabsContent>
          <TabsContent value="pages">
            <ContentPagesPanel store={store} canPublish={canPublish} />
          </TabsContent>
          <TabsContent value="nav">
            <NavigationPanel store={store} canPublish={canPublish} />
          </TabsContent>
          <TabsContent value="assets">
            <AssetsPanel store={store} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
