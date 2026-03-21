import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Download, Loader2, Printer, Package, AlertCircle, ExternalLink } from "lucide-react";
import { format } from "date-fns";

export default function PrintView() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionId) fetchSession();
  }, [sessionId]);

  async function fetchSession() {
    setLoading(true);
    const { data, error: err } = await supabase
      .from("customizer_sessions")
      .select("*")
      .eq("id", sessionId!)
      .single();

    if (err || !data) {
      setError("Order not found or link is invalid.");
    } else {
      setSession(data);
    }
    setLoading(false);
  }

  function getDesignImages(): { label: string; url: string }[] {
    if (!session?.design_output) return [];
    const output = session.design_output;
    const images: { label: string; url: string }[] = [];
    if (typeof output === "object" && !Array.isArray(output)) {
      for (const key of Object.keys(output)) {
        if (typeof output[key] === "string" && (output[key].startsWith("http") || output[key].startsWith("data:"))) {
          const label = key
            .replace(/_/g, " ")
            .replace(/\b\w/g, (c: string) => c.toUpperCase());
          images.push({ label, url: output[key] });
        }
      }
    }
    return images;
  }

  async function handleDownload(url: string, filename: string) {
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(url, "_blank");
    }
  }

  function handleDownloadAll() {
    const images = getDesignImages();
    const productName = (session?.product_data?.name || "design").replace(/\s+/g, "-").toLowerCase();
    images.forEach((img, i) => {
      setTimeout(() => {
        handleDownload(img.url, `${productName}-${img.label.replace(/\s+/g, "-").toLowerCase()}.png`);
      }, i * 500);
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="flex flex-col items-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <h2 className="text-lg font-semibold text-foreground">Link Not Found</h2>
            <p className="text-sm text-muted-foreground mt-2">
              {error || "This print link is invalid or has expired."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const images = getDesignImages();
  const productName = session.product_data?.name || "Untitled Product";
  const productCategory = session.product_data?.category || "";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-center gap-3 mb-1">
            <Printer className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold text-foreground">Print-Ready Files</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Download the design files below for production printing.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Order Info */}
        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold text-foreground">{productName}</span>
                  {productCategory && (
                    <Badge variant="outline" className="text-xs">{productCategory}</Badge>
                  )}
                </div>
                <div>
                  <span className="text-muted-foreground">Status: </span>
                  <Badge variant={session.status === "completed" ? "default" : "secondary"}>
                    {session.status}
                  </Badge>
                </div>
                {session.external_ref && (
                  <div>
                    <span className="text-muted-foreground">Order Ref: </span>
                    <span className="font-mono text-xs">{session.external_ref}</span>
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <div>
                  <span className="text-muted-foreground">Date: </span>
                  {format(new Date(session.created_at), "MMM d, yyyy h:mm a")}
                </div>
                {session.customer_name && (
                  <div>
                    <span className="text-muted-foreground">Customer: </span>
                    {session.customer_name}
                  </div>
                )}
                {session.order_notes && (
                  <div>
                    <span className="text-muted-foreground">Notes: </span>
                    {session.order_notes}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Print specs */}
        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold text-sm text-foreground mb-3">Print Specifications</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground block">Format</span>
                <span className="font-medium">PNG (transparent)</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Scale</span>
                <span className="font-medium">2× (high-res)</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Recommended</span>
                <span className="font-medium">150+ DPI</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Design Area</span>
                <span className="font-medium">12″ × 16″</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Design Files */}
        {images.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-12 text-center">
              <AlertCircle className="h-10 w-10 text-muted-foreground mb-3" />
              <h3 className="font-semibold text-foreground">No design files yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Design exports will appear here once the customer completes their customization.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">
                Design Files ({images.length})
              </h3>
              <Button onClick={handleDownloadAll} size="sm">
                <Download className="h-4 w-4 mr-2" />
                Download All
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {images.map((img, i) => (
                <Card key={i} className="overflow-hidden">
                  <div className="aspect-square bg-muted/50 flex items-center justify-center p-4"
                    style={{ backgroundImage: "linear-gradient(45deg, hsl(var(--muted)) 25%, transparent 25%), linear-gradient(-45deg, hsl(var(--muted)) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, hsl(var(--muted)) 75%), linear-gradient(-45deg, transparent 75%, hsl(var(--muted)) 75%)", backgroundSize: "20px 20px", backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px" }}>
                    <img src={img.url} alt={img.label} className="max-w-full max-h-full object-contain" />
                  </div>
                  <CardContent className="p-4 flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{img.label}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(img.url, `${productName.replace(/\s+/g, "-").toLowerCase()}-${img.label.replace(/\s+/g, "-").toLowerCase()}.png`)}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
