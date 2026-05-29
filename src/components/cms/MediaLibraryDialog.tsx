import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, Trash2, ImageIcon, Check, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cms } from "@/lib/cmsClient";

type MediaItem = {
  id: string;
  url: string;
  filename: string | null;
  content_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

export function MediaLibraryDialog({
  open,
  onOpenChange,
  storeId,
  onSelect,
  currentUrl,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  storeId: string;
  onSelect: (url: string) => void;
  currentUrl?: string;
}) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const safeName = file.name
        .replace(/[^a-zA-Z0-9_.-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
      const path = `homepage/${Date.now()}-${safeName || "upload"}`;
      const signed = await cms<{ signedUrl: string; publicUrl: string }>(
        storeId,
        "create-asset-upload-url",
        { path },
      );
      const putRes = await fetch(signed.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("cms_media").upsert(
          {
            store_id: storeId,
            user_id: user.id,
            url: signed.publicUrl,
            filename: file.name,
            content_type: file.type || null,
            size_bytes: file.size,
          },
          { onConflict: "store_id,url", ignoreDuplicates: true },
        );
      }
      qc.invalidateQueries({ queryKey: ["cms_media", storeId] });
      onSelect(signed.publicUrl);
      onOpenChange(false);
      toast({ title: "Image uploaded" });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const { data: items = [], isLoading } = useQuery<MediaItem[]>({
    queryKey: ["cms_media", storeId],
    enabled: open && !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cms_media")
        .select("id,url,filename,content_type,size_bytes,created_at")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as MediaItem[];
    },
  });

  const filtered = items.filter((m) =>
    !search.trim()
      ? true
      : (m.filename ?? "").toLowerCase().includes(search.toLowerCase()) ||
        m.url.toLowerCase().includes(search.toLowerCase()),
  );

  const remove = async (id: string) => {
    const { error } = await supabase.from("cms_media").delete().eq("id", id);
    if (error) {
      toast({ title: "Could not remove", description: error.message, variant: "destructive" });
      return;
    }
    qc.invalidateQueries({ queryKey: ["cms_media", storeId] });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Media library</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search filename or URL…"
            className="pl-9"
          />
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="p-10 text-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin inline" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
              <ImageIcon className="h-8 w-8" />
              {items.length === 0
                ? "No media yet — uploads will appear here automatically."
                : "No media matches your search."}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-1">
              {filtered.map((m) => {
                const active = currentUrl === m.url;
                return (
                  <div
                    key={m.id}
                    className={`group relative rounded-md border bg-muted/20 overflow-hidden ${
                      active ? "ring-2 ring-primary" : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(m.url);
                        onOpenChange(false);
                      }}
                      className="block w-full aspect-square bg-muted"
                    >
                      <img
                        src={m.url}
                        alt={m.filename ?? ""}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </button>
                    {active && (
                      <div className="absolute top-1 left-1 rounded-full bg-primary text-primary-foreground p-1">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                    <div className="p-2 text-[11px] truncate" title={m.filename ?? m.url}>
                      {m.filename ?? m.url}
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="destructive"
                      className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        remove(m.id);
                      }}
                      title="Remove from library"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
