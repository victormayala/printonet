import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Code, Copy, Check, Info, ExternalLink } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export function UniversalSnippetDialog() {
  const [copied, setCopied] = useState(false);
  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const snippet = `<!-- Customizer Studio — paste in your site's <head> or before </body> -->
<script
  src="${baseUrl}/customizer-loader.js"
  data-api-url="${apiUrl}"
  data-base-url="${baseUrl}"
  data-anon-key="${anonKey}"
></script>`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    toast({ title: "Copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Code className="h-4 w-4" /> Get Embed Script
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Universal Embed Script</DialogTitle>
          <DialogDescription>
            One script tag — all your products automatically work with the customizer.
          </DialogDescription>
        </DialogHeader>

        <div>
          <h4 className="text-sm font-semibold mb-2">1. Add this to your site's header</h4>
          <div className="relative">
            <Button
              size="sm"
              variant="outline"
              className="absolute top-3 right-3 gap-1.5 z-10"
              onClick={handleCopy}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
            <pre className="rounded-lg bg-muted p-4 pr-24 text-xs overflow-x-auto whitespace-pre-wrap break-all font-mono leading-relaxed">
              {snippet}
            </pre>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold mb-2">2. Add buttons to your product pages</h4>
          <div className="space-y-3">
            <div className="rounded-lg border p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Product picker (shows all products)</p>
              <code className="text-xs bg-muted px-2 py-1 rounded block font-mono">
                {'<button data-customizer>Customize</button>'}
              </code>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Specific product (by name)</p>
              <code className="text-xs bg-muted px-2 py-1 rounded block font-mono">
                {'<button data-customizer data-product-name="Classic T-Shirt">Customize</button>'}
              </code>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Specific product (by ID)</p>
              <code className="text-xs bg-muted px-2 py-1 rounded block font-mono">
                {'<button data-customizer data-product-id="abc-123">Customize</button>'}
              </code>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p>The script loads automatically, fetches your active products, and handles everything. No per-product code needed.</p>
            <p>Listen for results with: <code className="text-xs bg-muted px-1 py-0.5 rounded">document.addEventListener('customizer:complete', e =&gt; console.log(e.detail))</code></p>
            <Link to="/developers" className="inline-flex items-center gap-1 text-primary hover:underline text-xs font-medium">
              Full documentation & advanced options <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
