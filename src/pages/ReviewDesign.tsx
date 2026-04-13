import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle, ArrowLeft, ExternalLink } from "lucide-react";

interface DesignSide {
  view: string;
  designPNG: string;
  previewPNG?: string;
  productImage?: string;
}

interface DesignOutput {
  sessionId?: string;
  sides: DesignSide[];
  variant?: { color?: string; colorName?: string; hex?: string } | null;
}

interface SessionRow {
  id: string;
  status: string;
  product_data: any;
  design_output: any;
  external_ref: string | null;
}

export default function ReviewDesign() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [session, setSession] = useState<SessionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    supabase
      .from("customizer_sessions")
      .select("*")
      .eq("id", sessionId)
      .single()
      .then(({ data, error: err }) => {
        if (err || !data) {
          setError("Design not found.");
        } else {
          setSession(data as unknown as SessionRow);
        }
        setLoading(false);
      });
  }, [sessionId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <h2 className="text-xl font-semibold text-foreground">{error || "Something went wrong"}</h2>
          <p className="text-sm text-muted-foreground">This design session could not be found.</p>
        </div>
      </div>
    );
  }

  const designOutput = session.design_output as DesignOutput | null;
  const productData = session.product_data as any;
  const productName = productData?.name || "Your Product";
  const variantLabel = designOutput?.variant?.colorName || "";
  const sides = designOutput?.sides?.filter((s) => s.previewPNG || s.designPNG) || [];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle className="h-7 w-7 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Design Complete!</h1>
          <p className="text-muted-foreground">
            {productName}{variantLabel ? ` · ${variantLabel}` : ""}
          </p>
        </div>

        {/* Preview grid — uses the saved canonical preview images */}
        {sides.length > 0 && (
          <div className={`grid gap-4 ${sides.length === 1 ? "grid-cols-1 max-w-sm mx-auto" : "grid-cols-2"}`}>
            {sides.map((side) => (
              <div key={side.view} className="rounded-xl border border-border overflow-hidden bg-muted/30">
                <div className="px-3 py-2 border-b border-border">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {side.view}
                  </span>
                </div>
                <img
                  src={side.previewPNG || side.designPNG}
                  alt={`${side.view} preview`}
                  className="w-full aspect-square object-contain bg-muted/20"
                />
              </div>
            ))}
          </div>
        )}

        {/* Session reference */}
        {sessionId && (
          <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-muted/50 border border-border">
            <span className="text-xs text-muted-foreground">Design Reference</span>
            <span className="text-xs font-mono text-foreground select-all">{sessionId.slice(0, 8)}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" asChild>
            <Link to={`/embed/${sessionId}`}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Edit Design
            </Link>
          </Button>
          <Button className="flex-[2]" onClick={() => {
            // Post message for SDK consumers / close the window
            window.parent.postMessage(
              { source: "customizer-studio", type: "review-add-to-cart", payload: designOutput },
              "*"
            );
          }}>
            🛒 Add to Cart
          </Button>
        </div>
      </div>
    </div>
  );
}
