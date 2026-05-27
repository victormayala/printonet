import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";

type ApprovalData = {
  status: "pending" | "approved" | "rejected" | "expired";
  customer_email: string;
  comment: string | null;
  decided_at: string | null;
  sent_at: string;
  store: {
    name: string | null;
    logo_url: string | null;
    primary_color: string | null;
  } | null;
  order: { short_code: string; created_at: string | null };
  design_images: string[];
};

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/order-approval`;

export default function OrderApproval() {
  const { token = "" } = useParams();
  const [data, setData] = useState<ApprovalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState<null | "approved" | "rejected">(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`${FN_URL}?token=${encodeURIComponent(token)}`);
        if (!res.ok) {
          setError(res.status === 404 ? "This approval link is invalid." : "Unable to load.");
        } else {
          setData(await res.json());
        }
      } catch {
        setError("Network error.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const submit = async (decision: "approved" | "rejected") => {
    setSubmitting(decision);
    try {
      const res = await fetch(FN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, decision, comment: comment.trim() || null }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Could not submit your decision.");
      } else {
        setData((d) => (d ? { ...d, status: decision, comment: comment.trim() || null, decided_at: new Date().toISOString() } : d));
      }
    } finally {
      setSubmitting(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full">
          <CardContent className="py-10 text-center space-y-2">
            <XCircle className="h-10 w-10 text-destructive mx-auto" />
            <h1 className="text-lg font-semibold">{error || "Not found"}</h1>
            <p className="text-sm text-muted-foreground">
              Please contact the sender if you believe this is a mistake.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const accent = data.store?.primary_color || "hsl(var(--primary))";

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="flex items-center gap-3">
          {data.store?.logo_url ? (
            <img src={data.store.logo_url} alt="" className="h-10 w-auto" />
          ) : null}
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {data.store?.name || "Print proof"} — order {data.order.short_code}
            </h1>
            <p className="text-sm text-muted-foreground">
              Please review your design before it goes to production.
            </p>
          </div>
        </header>

        {data.design_images.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {data.design_images.map((src, i) => (
              <div key={i} className="rounded-md border bg-muted/30 overflow-hidden">
                <img src={src} alt={`Design view ${i + 1}`} className="w-full h-auto object-contain" />
              </div>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground text-center">
              The design preview isn't available, but you can still approve or request changes below.
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <h2 className="text-base font-semibold text-foreground">Your decision</h2>
            <p className="text-xs text-muted-foreground">Optional: leave a note for the print shop.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.status === "pending" ? (
              <>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value.slice(0, 2000))}
                  placeholder="e.g. Please make the logo a little smaller on the back."
                  rows={4}
                />
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    onClick={() => submit("approved")}
                    disabled={!!submitting}
                    className="flex-1"
                    style={{ backgroundColor: accent }}
                  >
                    {submitting === "approved" ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                    )}
                    Approve for production
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => submit("rejected")}
                    disabled={!!submitting}
                    className="flex-1"
                  >
                    {submitting === "rejected" ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <XCircle className="h-4 w-4 mr-2" />
                    )}
                    Request changes
                  </Button>
                </div>
              </>
            ) : data.status === "expired" ? (
              <div className="text-center py-6 space-y-2">
                <Clock className="h-8 w-8 text-muted-foreground mx-auto" />
                <p className="text-sm font-medium">This approval link has expired.</p>
                <p className="text-xs text-muted-foreground">Please contact the sender for a new link.</p>
              </div>
            ) : (
              <div className="text-center py-6 space-y-2">
                {data.status === "approved" ? (
                  <CheckCircle2 className="h-10 w-10 text-primary mx-auto" />
                ) : (
                  <XCircle className="h-10 w-10 text-destructive mx-auto" />
                )}
                <p className="text-sm font-medium">
                  {data.status === "approved"
                    ? "Thanks — your proof has been approved."
                    : "Thanks — we'll review your requested changes."}
                </p>
                {data.comment && (
                  <p className="text-xs text-muted-foreground italic max-w-md mx-auto">
                    "{data.comment}"
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
