import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, Loader2, Printer, Package, AlertCircle, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface DesignImage {
  label: string;
  url: string;
  enhanced?: boolean;
  enhancing?: boolean;
  resolution?: { width: number; height: number };
}

function getDesignImages(session: any): DesignImage[] {
  if (!session?.design_output) return [];
  const output = session.design_output;
  const images: DesignImage[] = [];
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

function ResolutionInfo({ url }: { url: string }) {
  const [info, setInfo] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setInfo({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;
  }, [url]);

  if (!info) return null;

  const dpiAt12 = Math.round(info.w / 12);
  const dpiAt16 = Math.round(info.h / 16);
  const avgDpi = Math.round((dpiAt12 + dpiAt16) / 2);
  const isPrintReady = avgDpi >= 150;

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>{info.w} × {info.h}px</span>
      <span>·</span>
      <Badge variant={isPrintReady ? "default" : "secondary"} className="text-xs px-1.5 py-0">
        ~{avgDpi} DPI
      </Badge>
    </div>
  );
}

export default function PrintView() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<DesignImage[]>([]);
  const [enhancingIndex, setEnhancingIndex] = useState<number | null>(null);

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
      setImages(getDesignImages(data));
    }
    setLoading(false);
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
    const productName = (session?.product_data?.name || "design").replace(/\s+/g, "-").toLowerCase();
    images.forEach((img, i) => {
      setTimeout(() => {
        const suffix = img.enhanced ? "-enhanced" : "";
        handleDownload(img.url, `${productName}-${img.label.replace(/\s+/g, "-").toLowerCase()}${suffix}.png`);
      }, i * 500);
    });
  }

  async function handleEnhance(index: number) {
    const img = images[index];
    if (!img || img.enhanced) return;

    setEnhancingIndex(index);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("upscale-design", {
        body: { imageUrl: img.url },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      if (!data?.imageUrl) throw new Error("No enhanced image returned");

      setImages(prev => prev.map((im, i) =>
        i === index ? { ...im, url: data.imageUrl, enhanced: true } : im
      ));
      toast.success(`${img.label} enhanced for print`);
    } catch (e: any) {
      toast.error(e.message || "Failed to enhance image");
    } finally {
      setEnhancingIndex(null);
    }
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

  const productName = session.product_data?.name || "Untitled Product";
  const productCategory = session.product_data?.category || "";

  return (
    <div className="min-h-screen bg-background">
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
                <span className="font-medium">4× (high-res)</span>
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
                  <div
                    className="aspect-square bg-muted/50 flex items-center justify-center p-4"
                    style={{
                      backgroundImage:
                        "linear-gradient(45deg, hsl(var(--muted)) 25%, transparent 25%), linear-gradient(-45deg, hsl(var(--muted)) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, hsl(var(--muted)) 75%), linear-gradient(-45deg, transparent 75%, hsl(var(--muted)) 75%)",
                      backgroundSize: "20px 20px",
                      backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
                    }}
                  >
                    <img src={img.url} alt={img.label} className="max-w-full max-h-full object-contain" />
                  </div>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <span className="text-sm font-medium text-foreground flex items-center gap-2">
                          {img.label}
                          {img.enhanced && (
                            <Badge variant="default" className="text-xs px-1.5 py-0">
                              <Sparkles className="h-3 w-3 mr-0.5" />
                              Enhanced
                            </Badge>
                          )}
                        </span>
                        <ResolutionInfo url={img.url} />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {!img.enhanced && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEnhance(i)}
                          disabled={enhancingIndex !== null}
                        >
                          {enhancingIndex === i ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4 mr-1" />
                          )}
                          Enhance for Print
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const suffix = img.enhanced ? "-enhanced" : "";
                          handleDownload(
                            img.url,
                            `${productName.replace(/\s+/g, "-").toLowerCase()}-${img.label.replace(/\s+/g, "-").toLowerCase()}${suffix}.png`
                          );
                        }}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                    </div>
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
