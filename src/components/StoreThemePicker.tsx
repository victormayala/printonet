import { useQuery } from "@tanstack/react-query";
import { Loader2, ExternalLink, Check } from "lucide-react";
import { cms } from "@/lib/cmsClient";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STOREFRONT_PUBLIC_BASE = "https://stores.printonet.com";

export type Template = {
  id: string;
  name: string;
  tagline?: string;
  description?: string;
  best_for?: string[];
  preview_image_url?: string;
  demo_url?: string;
  theme?: Record<string, unknown>;
};

type ListTemplatesResponse = {
  ok: true;
  default_template_id: string;
  templates: Template[];
};

function resolveImage(url?: string) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${STOREFRONT_PUBLIC_BASE}${url.startsWith("/") ? "" : "/"}${url}`;
}

export function useStoreTemplates(storeId: string | null | undefined) {
  return useQuery({
    queryKey: ["cms-templates", storeId],
    enabled: !!storeId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const res = await cms<ListTemplatesResponse>(storeId!, "list-templates", {});
      return res;
    },
  });
}

export function StoreThemePicker({
  storeId,
  selectedId,
  onSelect,
}: {
  storeId: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { data, isLoading, error } = useStoreTemplates(storeId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading themes…
      </div>
    );
  }

  if (error || !data?.templates?.length) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        Couldn't load themes. {error instanceof Error ? error.message : null}
      </div>
    );
  }

  const effectiveSelected = selectedId ?? data.default_template_id;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {data.templates.map((t) => {
        const isSelected = effectiveSelected === t.id;
        const img = resolveImage(t.preview_image_url);
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id)}
            className={cn(
              "group relative text-left rounded-lg border bg-card overflow-hidden transition-all",
              "hover:border-primary/60 hover:shadow-md",
              isSelected ? "border-primary ring-2 ring-primary/40" : "border-border",
            )}
          >
            <div className="aspect-[16/10] bg-muted overflow-hidden">
              {img ? (
                <img
                  src={img}
                  alt={t.name}
                  className="w-full h-full object-cover transition-transform group-hover:scale-[1.02]"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                  No preview
                </div>
              )}
              {isSelected && (
                <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1 shadow">
                  <Check className="h-3.5 w-3.5" />
                </div>
              )}
            </div>
            <div className="p-2.5 space-y-1">
              <div className="flex items-start justify-between gap-1.5">
                <div className="min-w-0">
                  <div className="font-medium text-xs truncate">{t.name}</div>
                  {t.tagline && (
                    <div className="text-[10px] text-muted-foreground line-clamp-1">{t.tagline}</div>
                  )}
                </div>
                {t.demo_url && (
                  <a
                    href={t.demo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0 text-[10px] text-primary hover:underline inline-flex items-center gap-0.5"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
