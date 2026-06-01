import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, BookOpen, Trash2, Save, Send, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { CorporateStore } from "@/types/corporateStore";

type Post = {
  id: string;
  store_id: string;
  user_id: string;
  author_id: string | null;
  slug: string;
  title: string;
  excerpt: string | null;
  body_md: string;
  hero_image_url: string | null;
  tags: string[];
  status: "draft" | "scheduled" | "published";
  publish_at: string | null;
  published_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
  og_image_url: string | null;
  updated_at: string;
};

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

export function WebsiteBlogPanel({ site }: { site: CorporateStore }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["blog-posts", site.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("blog_posts")
        .select("*")
        .eq("store_id", site.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Post[];
    },
  });

  const reload = () => qc.invalidateQueries({ queryKey: ["blog-posts", site.id] });

  if (editingId || creating) {
    const post = creating ? null : posts.find((p) => p.id === editingId) ?? null;
    return (
      <PostEditor
        site={site}
        userId={user?.id ?? ""}
        post={post}
        existingSlugs={posts.filter((p) => p.id !== editingId).map((p) => p.slug)}
        onClose={() => {
          setEditingId(null);
          setCreating(false);
          reload();
        }}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="py-12 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading posts…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Blog</h2>
          <p className="text-sm text-muted-foreground">Write and publish articles for your website.</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> New post
        </Button>
      </div>

      {posts.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="font-medium text-sm">No posts yet</p>
            <p className="text-xs mt-1">Click "New post" to write your first article.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 divide-y">
            {posts.map((p) => (
              <button
                key={p.id}
                onClick={() => setEditingId(p.id)}
                className="w-full text-left px-4 py-3 hover:bg-muted/60 transition-colors flex items-center gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{p.title || "Untitled"}</span>
                    <Badge
                      variant={p.status === "published" ? "default" : "outline"}
                      className="capitalize"
                    >
                      {p.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">/blog/{p.slug}</p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(p.updated_at).toLocaleDateString()}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PostEditor({
  site,
  userId,
  post,
  existingSlugs,
  onClose,
}: {
  site: CorporateStore;
  userId: string;
  post: Post | null;
  existingSlugs: string[];
  onClose: () => void;
}) {
  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "");
  const [body, setBody] = useState(post?.body_md ?? "");
  const [hero, setHero] = useState(post?.hero_image_url ?? "");
  const [tagsText, setTagsText] = useState((post?.tags ?? []).join(", "));
  const [seoTitle, setSeoTitle] = useState(post?.seo_title ?? "");
  const [seoDescription, setSeoDescription] = useState(post?.seo_description ?? "");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!post && title && !slug) setSlug(slugify(title));
  }, [title]);

  const persist = async (publish: boolean) => {
    const finalSlug = slug.trim() || slugify(title);
    if (!title.trim() || !finalSlug) {
      toast({ title: "Title and slug are required", variant: "destructive" });
      return;
    }
    if (existingSlugs.includes(finalSlug)) {
      toast({ title: "Another post already uses that slug", variant: "destructive" });
      return;
    }
    publish ? setPublishing(true) : setSaving(true);
    const tags = tagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const payload: any = {
      store_id: site.id,
      user_id: userId,
      title: title.trim(),
      slug: finalSlug,
      excerpt: excerpt || null,
      body_md: body,
      hero_image_url: hero || null,
      tags,
      seo_title: seoTitle || null,
      seo_description: seoDescription || null,
    };
    if (publish) {
      payload.status = "published";
      payload.published_at = new Date().toISOString();
    }
    let error;
    if (post) {
      ({ error } = await (supabase as any).from("blog_posts").update(payload).eq("id", post.id));
    } else {
      ({ error } = await (supabase as any).from("blog_posts").insert(payload));
    }
    publish ? setPublishing(false) : setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: publish ? "Post published" : "Draft saved" });
    onClose();
  };

  const remove = async () => {
    if (!post) return;
    if (!confirm("Delete this post permanently?")) return;
    setDeleting(true);
    const { error } = await (supabase as any).from("blog_posts").delete().eq("id", post.id);
    setDeleting(false);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Post deleted" });
    onClose();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div>
            <CardTitle className="text-base">{post ? "Edit post" : "New post"}</CardTitle>
            {post && <CardDescription>/blog/{post.slug}</CardDescription>}
          </div>
        </div>
        {post && (
          <Button variant="ghost" size="icon" onClick={remove} disabled={deleting} className="text-destructive">
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Slug</Label>
            <Input value={slug} onChange={(e) => setSlug(slugify(e.target.value))} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Excerpt</Label>
          <Textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={2} maxLength={400} />
        </div>
        <div className="space-y-1.5">
          <Label>Hero image URL</Label>
          <Input value={hero} onChange={(e) => setHero(e.target.value)} placeholder="https://…" />
        </div>
        <div className="space-y-1.5">
          <Label>Body (Markdown)</Label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={16}
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Tags (comma-separated)</Label>
          <Input value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="news, product, design" />
        </div>

        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
          <p className="text-sm font-medium">SEO</p>
          <div className="space-y-1.5">
            <Label className="text-xs">Title</Label>
            <Input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} maxLength={160} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} rows={2} maxLength={320} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={() => persist(false)} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save draft
          </Button>
          <Button onClick={() => persist(true)} disabled={publishing}>
            {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Publish
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
