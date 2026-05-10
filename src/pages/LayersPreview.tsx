import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AlertCircle, ExternalLink, Loader2 } from "lucide-react";

/**
 * Public helper: opens a Supabase `layers.json` URL with pretty-printed JSON (avoids
 * hanging the browser on one huge minified line).
 */
export default function LayersPreview() {
  const [searchParams] = useSearchParams();
  const rawUrl = searchParams.get("url") || "";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pretty, setPretty] = useState("");

  useEffect(() => {
    if (!rawUrl.trim()) {
      setError("Missing url query parameter.");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPretty("");

    fetch(rawUrl, { mode: "cors", credentials: "omit" })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((text) => {
        if (cancelled) return;
        try {
          const parsed = JSON.parse(text) as unknown;
          setPretty(JSON.stringify(parsed, null, 2));
        } catch {
          setPretty(text);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load file");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [rawUrl]);

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Design layers (JSON)</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Formatted view for prepress / tooling. This file is Fabric.js canvas state, not a preview image.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {rawUrl ? (
              <Button variant="outline" size="sm" asChild>
                <a href={rawUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Raw URL
                </a>
              </Button>
            ) : null}
            <Button variant="ghost" size="sm" type="button" onClick={() => window.history.back()}>
              Back
            </Button>
          </div>
        </div>

        {rawUrl && (
          <p className="text-xs font-mono text-muted-foreground break-all border rounded-md p-2 bg-muted/30">
            {rawUrl}
          </p>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading…
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Could not load</p>
              <p className="text-muted-foreground mt-1">{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && pretty && (
          <pre className="text-xs font-mono leading-relaxed whitespace-pre-wrap break-words overflow-auto max-h-[calc(100vh-12rem)] rounded-md border bg-muted/20 p-4">
            {pretty}
          </pre>
        )}
      </div>
    </div>
  );
}
