import { useState, useEffect, useCallback, useRef } from "react";
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
  FileText,
  Home,
  Images,
  Loader2,

  MousePointerClick,
  Navigation,
  Plus,
  Save,
  Send,
  Settings as SettingsIcon,
  Trash2,
  Upload,
} from "lucide-react";
import type { CorporateStore } from "@/types/corporateStore";
import { cms } from "@/lib/cmsClient";
import { BlockEditor, BLOCK_TYPES } from "@/components/cms/BlockEditor";
import { SiteSettingsEditor, ContentPageEditor } from "@/components/cms/SiteSettingsEditor";
import { metaFor, blockAvailableIn, type BlockContext } from "@/components/cms/blockMeta";
import { BlockPreview } from "@/components/cms/BlockPreview";
import { cn } from "@/lib/utils";


// Bump in lock-step with storefront's `PLATFORM_CMS_SCHEMA_VERSION`.
const PLATFORM_CMS_SCHEMA_VERSION = 8;

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

const DEFAULT_BLOCK_DRAFTS: Record<string, any> = {
  hero: {
    eyebrow: "",
    headline: "New hero section",
    subhead: "",
    image_url: "",
    cta_label: "Shop now",
    cta_href: "/products",
    secondary_cta_label: "",
    secondary_cta_href: "",
    alignment: "left",
  },
  value_props: {
    heading: "Why shop with us",
    items: [{ icon: "sparkles", title: "New benefit", body: "Describe this benefit." }],
  },
  featured_categories: {
    heading: "Featured categories",
    subheading: "",
    category_slugs: ["featured"],
  },
  featured_products: {
    heading: "Featured products",
    subheading: "",
    store_product_ids: ["replace-with-product-id"],
  },
  testimonials: {
    heading: "Testimonials",
    items: [{ quote: "Share a customer quote.", author: "Customer name", role: "", avatar_url: "" }],
  },
  cta_banner: {
    headline: "New call to action",
    body: "",
    cta_label: "Shop now",
    cta_href: "/products",
    background_image_url: "",
  },
  rich_text: {
    markdown: "Add your content here.",
  },
  category_bento: {
    eyebrow: "",
    heading: "Featured categories",
    items: [{ image_url: "", label: "Category", sublabel: "", href: "/products" }],
  },
  two_column_banners: {
    items: [
      { image_url: "", eyebrow: "", title: "First promotion", body: "", cta_label: "", cta_href: "" },
      { image_url: "", eyebrow: "", title: "Second promotion", body: "", cta_label: "", cta_href: "" },
    ],
  },
  three_column_banners: {
    items: [
      { image_url: "", eyebrow: "", title: "First feature", body: "" },
      { image_url: "", eyebrow: "", title: "Second feature", body: "" },
      { image_url: "", eyebrow: "", title: "Third feature", body: "" },
    ],
  },
  benefits_grid: {
    eyebrow: "",
    heading: "Why shop with us",
    items: [{ eyebrow: "01", title: "New benefit", body: "Describe this benefit.", accent_color: "" }],
  },
};

function defaultDraftFor(type: string) {
  return JSON.parse(JSON.stringify(DEFAULT_BLOCK_DRAFTS[type] ?? { markdown: "Add your content here." }));
}

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

function PanelHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <h3 className="font-semibold leading-tight">{title}</h3>
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
      </div>
    </div>
  );
}

function HomepageBlocksPanel({
  store,
  canPublish,
  variant = "store",
}: {
  store: CorporateStore;
  canPublish: boolean;
  variant?: BlockContext;
}) {
  const availableTypes = BLOCK_TYPES.filter((t) => blockAvailableIn(t, variant));
  const [blocks, setBlocks] = useState<Block[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, any>>({});
  const [newType, setNewType] = useState(availableTypes[0] ?? "hero");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rawMode, setRawMode] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await cms<{ blocks: Block[] }>(store.id, "list-blocks");
      setBlocks(res.blocks);
      setDrafts(Object.fromEntries(res.blocks.map((b) => [b.id, b.draft_data])));
      setSelectedId((prev) => {
        if (prev && res.blocks.some((b) => b.id === prev)) return prev;
        return res.blocks[0]?.id ?? null;
      });
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
        sort_order: b.sort_order,
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

  // Autosave drafts (debounced). Persists changes such as uploaded image URLs
  // immediately so they survive a page refresh even if the user forgets to
  // click "Save draft".
  const lastSavedRef = useRef<Record<string, string>>({});
  useEffect(() => {
    if (!blocks) return;
    // Seed baseline with what's currently on the server so we don't re-save
    // on first load.
    for (const b of blocks) {
      if (lastSavedRef.current[b.id] === undefined) {
        lastSavedRef.current[b.id] = JSON.stringify(b.draft_data ?? {});
      }
    }
    const timers: number[] = [];
    for (const b of blocks) {
      const current = JSON.stringify(drafts[b.id] ?? {});
      if (current === lastSavedRef.current[b.id]) continue;
      const id = window.setTimeout(async () => {
        try {
          await cms(store.id, "upsert-block", {
            id: b.id,
            block_type: b.block_type,
            enabled: b.enabled,
            sort_order: b.sort_order,
            draft_data: drafts[b.id] ?? b.draft_data,
          });
          lastSavedRef.current[b.id] = current;
          setBlocks((bs) =>
            bs?.map((x) => (x.id === b.id ? { ...x, draft_data: drafts[b.id] ?? x.draft_data } : x)) ?? null,
          );
        } catch {
          // Silent — user can still click "Save draft" to see the error.
        }
      }, 800);
      timers.push(id);
    }
    return () => {
      for (const t of timers) window.clearTimeout(t);
    };
  }, [drafts, blocks, store.id]);

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
      if (selectedId === id) setSelectedId(null);
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
      const before = new Set((blocks ?? []).map((b) => b.id));
      const nextSort =
        (blocks ?? []).reduce((m, b) => Math.max(m, b.sort_order ?? 0), -1) + 1;
      const blockType = newType.trim();
      await cms(store.id, "upsert-block", {
        block_type: blockType,
        enabled: true,
        sort_order: nextSort,
        draft_data: defaultDraftFor(blockType),
      });
      toast({ title: "Block created" });
      const res = await cms<{ blocks: Block[] }>(store.id, "list-blocks");
      setBlocks(res.blocks);
      setDrafts(Object.fromEntries(res.blocks.map((b) => [b.id, b.draft_data])));
      const created = res.blocks.find((b) => !before.has(b.id));
      if (created) setSelectedId(created.id);
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

  const selected = blocks?.find((b) => b.id === selectedId) ?? null;
  const selectedIdx = selected ? blocks!.findIndex((b) => b.id === selected.id) : -1;
  const selectedMeta = selected ? metaFor(selected.block_type) : null;
  const selectedDraft = selected ? drafts[selected.id] ?? selected.draft_data : null;
  const draftDirty =
    !!selected &&
    JSON.stringify(selectedDraft ?? {}) !== JSON.stringify(selected.draft_data ?? {});

  return (
    <div className="space-y-4">
      <PanelHeader
        icon={Home}
        title="Homepage sections"
        description="Each block is one section on your storefront homepage, top to bottom. Click a block on the left to edit it."
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border p-3 bg-card">
        <div className="space-y-1">
          <Label className="text-xs">Add a new section</Label>
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            className="flex h-9 w-56 rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            {BLOCK_TYPES.map((t) => (
              <option key={t} value={t}>
                {metaFor(t).label}
              </option>
            ))}
          </select>
        </div>
        <Button onClick={addBlock} disabled={busy === "__new" || !newType.trim()} size="sm">
          {busy === "__new" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add section
        </Button>
        <div className="flex-1" />
        <Button variant="outline" onClick={publishAll} disabled={!canPublish || busy === "__all"} size="sm">
          {busy === "__all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Publish all drafts
        </Button>
      </div>

      {blocks?.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <Home className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium">No homepage sections yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Pick a section type above and click “Add section” to begin.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          {/* LEFT: section list */}
          <div className="rounded-lg border bg-card">
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Sections ({blocks?.length ?? 0})
              </span>
            </div>
            <div className="p-2 space-y-1 max-h-[640px] overflow-auto">
              {blocks?.map((b, idx) => {
                const meta = metaFor(b.block_type);
                const Icon = meta.icon;
                const summary = meta.summary?.(drafts[b.id] ?? b.draft_data);
                const isSelected = b.id === selectedId;
                const isDirty =
                  JSON.stringify(drafts[b.id] ?? {}) !== JSON.stringify(b.draft_data ?? {});
                return (
                  <div
                    key={b.id}
                    className={cn(
                      "group flex items-start gap-2 rounded-md border px-2.5 py-2 cursor-pointer transition-colors",
                      isSelected
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                        : "border-transparent hover:bg-muted/60",
                    )}
                    onClick={() => setSelectedId(b.id)}
                  >
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-[10px] font-semibold bg-muted text-muted-foreground">
                      {idx + 1}
                    </span>
                    <div
                      className={cn(
                        "mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded",
                        isSelected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium truncate">{meta.label}</span>
                        {!b.enabled && (
                          <Badge variant="outline" className="h-4 px-1 text-[10px]">
                            Hidden
                          </Badge>
                        )}
                        {isDirty && (
                          <span
                            className="h-1.5 w-1.5 rounded-full bg-amber-500"
                            title="Unsaved changes"
                          />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {summary || (b.published_at ? "Published" : "Draft only")}
                      </p>
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
                        disabled={idx === (blocks?.length ?? 1) - 1}
                      >
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT: editor */}
          <div className="rounded-lg border bg-card min-h-[400px]">
            {!selected ? (
              <div className="h-full flex items-center justify-center py-20 text-center px-6">
                <div>
                  <MousePointerClick className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm font-medium">Select a section to edit</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Choose any block from the list on the left.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Editor header */}
                <div className="flex items-start gap-3 border-b p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    {(() => {
                      const Icon = selectedMeta!.icon;
                      return <Icon className="h-5 w-5" />;
                    })()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Section {selectedIdx + 1} of {blocks!.length}
                      </span>
                      <span className="text-muted-foreground">·</span>
                      <h4 className="font-semibold">Editing: {selectedMeta!.label}</h4>
                      {selected.published_at ? (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Published
                        </Badge>
                      ) : (
                        <Badge variant="outline">Draft only</Badge>
                      )}
                      {draftDirty && (
                        <Badge variant="secondary" className="gap-1">
                          Unsaved changes
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{selectedMeta!.description}</p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => remove(selected.id)}
                    className="text-destructive hover:text-destructive"
                    title="Delete section"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {/* Live preview */}
                <div className="border-b bg-gradient-to-b from-muted/40 to-muted/10 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                      Live preview
                    </Label>
                    <span className="text-[10px] text-muted-foreground">
                      Schematic — actual storefront styling may differ
                    </span>
                  </div>
                  <BlockPreview
                    type={selected.block_type}
                    data={selectedDraft}
                    baseUrl={
                      store.custom_domain
                        ? `https://${store.custom_domain}`
                        : `https://stores.printonet.com/${store.tenant_slug}`
                    }
                  />

                </div>

                {/* Editor body */}
                <div className="p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={selected.enabled}
                      onCheckedChange={(v) => {
                        setBlocks(
                          (bs) =>
                            bs?.map((x) => (x.id === selected.id ? { ...x, enabled: v } : x)) ?? null,
                        );
                      }}
                    />
                    <Label className="text-sm">Visible on storefront</Label>
                  </div>


                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Section content</Label>
                    <BlockEditor
                      storeId={store.id}
                      type={selected.block_type}
                      data={selectedDraft}
                      onChange={(v) =>
                        setDrafts((d) => ({ ...d, [selected.id]: v }))
                      }
                    />
                  </div>
                </div>

                {/* Editor footer */}
                <div className="flex items-center justify-between gap-2 border-t bg-muted/30 px-4 py-3">
                  <p className="text-xs text-muted-foreground">
                    {selected.published_at
                      ? `Last published ${new Date(selected.published_at).toLocaleString()}`
                      : "Not yet published"}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => save(selected)}
                      disabled={busy === selected.id || !draftDirty}
                    >
                      {busy === selected.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Save draft
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => publish(selected.id)}
                      disabled={!canPublish || busy === selected.id}
                    >
                      <Send className="h-4 w-4" /> Publish
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
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
      <PanelHeader
        icon={SettingsIcon}
        title="Header & Footer"
        description="Announcement bar, footer columns, social links, contact info, and SEO defaults that apply to every page of the storefront."
      />
      <div className="rounded-lg border bg-card p-4 space-y-4">
        <div className="text-xs text-muted-foreground">
          Last published:{" "}
          {settings?.published_at ? new Date(settings.published_at).toLocaleString() : "never"}
        </div>
        <SiteSettingsEditor storeId={store.id} data={draft} onChange={setDraft} />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={save} disabled={busy !== null}>
          {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save draft
        </Button>
        <Button onClick={publish} disabled={!canPublish || busy !== null}>
          <Send className="h-4 w-4" /> Publish
        </Button>
        <Button variant="ghost" onClick={discard} disabled={busy !== null}>
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
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await cms<{ pages: ContentPage[] }>(store.id, "list-content-pages");
      setPages(res.pages);
      setDrafts(Object.fromEntries(res.pages.map((p) => [p.id, p.draft])));
      setSelectedId((prev) => {
        if (prev && res.pages.some((p) => p.id === prev)) return prev;
        return res.pages[0]?.id ?? null;
      });
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
      if (selectedId === id) setSelectedId(null);
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
      const before = new Set((pages ?? []).map((p) => p.id));
      await cms(store.id, "upsert-content-page", {
        slug: newSlug.trim(),
        enabled: true,
        draft: { title: newSlug.trim(), blocks: [] },
      });
      setNewSlug("");
      const res = await cms<{ pages: ContentPage[] }>(store.id, "list-content-pages");
      setPages(res.pages);
      setDrafts(Object.fromEntries(res.pages.map((p) => [p.id, p.draft])));
      const created = res.pages.find((p) => !before.has(p.id));
      if (created) setSelectedId(created.id);
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

  const selected = pages?.find((p) => p.id === selectedId) ?? null;
  const selectedDraft = selected ? drafts[selected.id] ?? selected.draft : null;
  const draftDirty =
    !!selected && JSON.stringify(selectedDraft ?? {}) !== JSON.stringify(selected.draft ?? {});

  return (
    <div className="space-y-4">
      <PanelHeader
        icon={FileText}
        title="Content pages"
        description="Standalone pages like About, FAQ, or Terms — each lives at its own URL on the storefront."
      />

      <div className="flex flex-wrap items-end gap-3 rounded-lg border p-3 bg-card">
        <div className="space-y-1 flex-1 min-w-[200px]">
          <Label className="text-xs">New page URL</Label>
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground">/</span>
            <Input
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              placeholder="about"
              className="h-9"
            />
          </div>
        </div>
        <Button onClick={create} disabled={busy === "__new" || !newSlug.trim()} size="sm">
          {busy === "__new" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Create page
        </Button>
      </div>

      {pages?.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium">No content pages yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Enter a URL slug above (like “about”) to create your first page.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="rounded-lg border bg-card">
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Pages ({pages?.length ?? 0})
              </span>
            </div>
            <div className="p-2 space-y-1 max-h-[640px] overflow-auto">
              {pages?.map((p) => {
                const isSelected = p.id === selectedId;
                const isDirty =
                  JSON.stringify(drafts[p.id] ?? {}) !== JSON.stringify(p.draft ?? {});
                const title = (drafts[p.id]?.title ?? p.draft?.title ?? p.slug) as string;
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    className={cn(
                      "flex items-start gap-2 rounded-md border px-2.5 py-2 cursor-pointer transition-colors",
                      isSelected
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                        : "border-transparent hover:bg-muted/60",
                    )}
                  >
                    <div
                      className={cn(
                        "mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded",
                        isSelected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                      )}
                    >
                      <FileText className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium truncate">{title}</span>
                        {!p.enabled && (
                          <Badge variant="outline" className="h-4 px-1 text-[10px]">
                            Hidden
                          </Badge>
                        )}
                        {isDirty && (
                          <span
                            className="h-1.5 w-1.5 rounded-full bg-amber-500"
                            title="Unsaved changes"
                          />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate font-mono">/{p.slug}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border bg-card min-h-[400px]">
            {!selected ? (
              <div className="h-full flex items-center justify-center py-20 text-center px-6">
                <div>
                  <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm font-medium">Select a page to edit</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start gap-3 border-b p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold">
                        Editing: {(selectedDraft?.title ?? selected.slug) as string}
                      </h4>
                      {selected.published_at ? (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Published
                        </Badge>
                      ) : (
                        <Badge variant="outline">Draft only</Badge>
                      )}
                      {draftDirty && <Badge variant="secondary">Unsaved changes</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">/{selected.slug}</p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => remove(selected.id)}
                    className="text-destructive hover:text-destructive"
                    title="Delete page"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={selected.enabled}
                      onCheckedChange={(v) =>
                        setPages(
                          (ps) =>
                            ps?.map((x) => (x.id === selected.id ? { ...x, enabled: v } : x)) ??
                            null,
                        )
                      }
                    />
                    <Label className="text-sm">Visible on storefront</Label>
                  </div>
                  <ContentPageEditor
                    storeId={store.id}
                    data={selectedDraft}
                    onChange={(v) => setDrafts((d) => ({ ...d, [selected.id]: v }))}
                  />
                </div>

                <div className="flex items-center justify-between gap-2 border-t bg-muted/30 px-4 py-3">
                  <p className="text-xs text-muted-foreground">
                    {selected.published_at
                      ? `Last published ${new Date(selected.published_at).toLocaleString()}`
                      : "Not yet published"}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => save(selected)}
                      disabled={busy === selected.id || !draftDirty}
                    >
                      {busy === selected.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Save draft
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => publish(selected.id)}
                      disabled={!canPublish || busy === selected.id}
                    >
                      <Send className="h-4 w-4" /> Publish
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
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
      <PanelHeader
        icon={Images}
        title="Assets"
        description="Upload images and files used across the storefront. Copy the URL to paste into a section."
      />
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
      <PanelHeader
        icon={Navigation}
        title="Navigation menu"
        description="Top-bar links shown on every storefront page. Saved changes go live immediately."
      />
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

        <Tabs defaultValue="settings">
          <TabsList className="flex-wrap">
            <TabsTrigger value="settings" className="gap-1.5">
              <SettingsIcon className="h-4 w-4" /> Header &amp; Footer
            </TabsTrigger>
            <TabsTrigger value="blocks" className="gap-1.5">
              <Home className="h-4 w-4" /> Homepage
            </TabsTrigger>
            <TabsTrigger value="pages" className="gap-1.5">
              <FileText className="h-4 w-4" /> Pages
            </TabsTrigger>
            <TabsTrigger value="nav" className="gap-1.5">
              <Navigation className="h-4 w-4" /> Navigation
            </TabsTrigger>
            <TabsTrigger value="assets" className="gap-1.5">
              <Images className="h-4 w-4" /> Assets
            </TabsTrigger>
          </TabsList>
          <Separator className="my-4" />

          <TabsContent value="settings">
            <SiteSettingsPanel store={store} canPublish={canPublish} />
          </TabsContent>
          <TabsContent value="blocks">
            <HomepageBlocksPanel store={store} canPublish={canPublish} />
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
