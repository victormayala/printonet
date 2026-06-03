import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Check, CheckCircle2, Copy, Info, RotateCcw } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export const scriptInstalledStorageKey = (storeId: string) =>
  `customizer_script_installed_${storeId}`;

export function isScriptMarkedInstalled(storeId: string | undefined | null): boolean {
  if (!storeId || typeof window === "undefined") return false;
  return window.localStorage.getItem(scriptInstalledStorageKey(storeId)) === "1";
}

interface Props {
  storeId: string;
  userId?: string | null;
  platform: "shopify" | "woocommerce";
  onChange?: (installed: boolean) => void;
}

export function IntegrationScriptPanel({ storeId, userId, platform, onChange }: Props) {
  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const snippet = `<!-- Printonet Product Customizer — paste in your site's <head> or before </body> -->
<script
  src="${baseUrl}/customizer-loader.js?v=20260603-shopify-pdp-url-detect"
  data-api-url="${apiUrl}"
  data-base-url="${baseUrl}"
  data-anon-key="${anonKey}"
  data-user-id="${userId ?? ""}"
  data-store-id="${storeId}"
></script>`;

  const [installed, setInstalled] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setInstalled(isScriptMarkedInstalled(storeId));
  }, [storeId]);

  const setInstalledState = (v: boolean) => {
    if (v) localStorage.setItem(scriptInstalledStorageKey(storeId), "1");
    else localStorage.removeItem(scriptInstalledStorageKey(storeId));
    setInstalled(v);
    onChange?.(v);
    window.dispatchEvent(new Event("customizer-script-install-changed"));
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    toast({ title: "Copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  const platformLabel = platform === "shopify" ? "Shopify theme" : "WooCommerce theme";
  const headerLocation =
    platform === "shopify"
      ? "Online Store → Themes → Edit code → theme.liquid (just before </head>)"
      : "Appearance → Theme File Editor → header.php (just before </head>) — or use the Printonet WordPress plugin";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              Embed script
              {installed ? (
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Installed
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="h-3 w-3" /> Not installed
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="mt-1">
              Paste this snippet once into your {platformLabel}. After that, just turn the
              customizer on for the products you want to customize — the Customize button will
              automatically appear on those product pages.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            1. Where to paste it
          </p>
          <p className="text-sm">{headerLocation}</p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            2. The snippet
          </p>
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
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            3. Turn the customizer on per product
          </p>
          <p className="text-sm text-muted-foreground">
            Open the <span className="font-medium text-foreground">Products</span> tab and toggle
            <span className="font-medium text-foreground"> Customizable</span> on for any product
            you want to allow customers to customize.
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap rounded-lg border bg-muted/30 p-3">
          <div className="flex items-start gap-2 text-sm">
            <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">
              {installed
                ? "You've marked the script as installed. Toggle this off if you ever remove it from your theme."
                : "Once you've pasted the snippet into your theme, mark it as installed to clear the warning."}
            </span>
          </div>
          {installed ? (
            <Button variant="outline" size="sm" onClick={() => setInstalledState(false)}>
              <RotateCcw className="h-4 w-4" /> Mark as not installed
            </Button>
          ) : (
            <Button size="sm" onClick={() => setInstalledState(true)}>
              <Check className="h-4 w-4" /> I've installed the script
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
