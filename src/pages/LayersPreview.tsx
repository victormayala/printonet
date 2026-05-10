import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AlertCircle, Download, ExternalLink, Loader2 } from "lucide-react";
import { deriveLayersDownloadFilename, downloadLayersJsonUrl } from "@/lib/layersDownload";
import { toast } from "@/hooks/use-toast";

/**
 * Public helper: optional pretty-printed JSON view. Primary use is downloading the same
 * `layers.json` the storefront stored (Fabric / production bundle for the print shop).
 */
export default function LayersPreview() {
  const [searchParams] = useSearchParams();
  const rawUrl = searchParams.get("url") || "";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pretty, setPretty] = useState("");
  const [rawText, setRawText] = useState("");
  const [downloadBusy, setDownloadBusy] = useState(false);

  useEffect(() => {
    if (!rawUrl.trim()) {
      setError("Missing url query parameter.");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPretty("");
    setRawText("");

    fetch(rawUrl, { mode: "cors", credentials: "omit" })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((text) => {
        if (cancelled) return;
        setRawText(text);
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

  async function handleDownloadFromCache() {
    if (!rawUrl.trim()) return;
    setDownloadBusy(true);
    try {
      if (rawText) {
        const blob = new Blob([rawText], { type: "application/json" });
        const name = deriveLayersDownloadFilename(rawUrl);
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
        toast({ title: "Download started", description: name });
      } else {
        await downloadLayersJsonUrl(rawUrl);
        toast({
          title: "Download started",
          description: deriveLayersDownloadFilename(rawUrl),
        });
      }
    } catch (e: unknown) {
      toast({
        variant: "destructive",
        title: "Download failed",
        description: e instanceof Error ? e.message : "Could not save the file",
      });
    } finally {
      setDownloadBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Design layers file</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
              Use <strong>Download</strong> to save <code className="text-xs bg-muted px-1 rounded">.json</code> for RIP /
              prepress (Fabric canvas data). Opening the public URL in a new tab only shows raw JSON in the
              browser — it is not a PNG/PDF proof.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {rawUrl ? (
              <>
                <Button
                  size="sm"
                  type="button"
                  disabled={downloadBusy || loading}
                  onClick={() => void handleDownloadFromCache()}
                >
                  {downloadBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-1" />
                  )}
                  Download layers.json
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={rawUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Open URL (raw JSON)
                  </a>
                </Button>
              </>
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
