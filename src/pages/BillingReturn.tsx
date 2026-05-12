import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function BillingReturn() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const [seconds, setSeconds] = useState(3);

  useEffect(() => {
    if (!sessionId) return;
    const t = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [sessionId]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="p-8 max-w-md text-center">
        <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Subscription started</h1>
        <p className="text-muted-foreground mb-6">
          {sessionId
            ? "Your plan is active. We're setting things up — this usually takes a few seconds."
            : "We couldn't find a checkout session."}
        </p>
        <div className="flex gap-3 justify-center">
          <Button asChild>
            <Link to="/billing">Go to Billing</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/corporate-stores">Open dashboard</Link>
          </Button>
        </div>
        {sessionId && seconds <= 0 && (
          <p className="text-xs text-muted-foreground mt-4">
            Plan still not visible? Refresh in a moment — webhooks typically arrive within seconds.
          </p>
        )}
      </Card>
    </div>
  );
}
