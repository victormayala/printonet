import { useSearchParams, Link } from "react-router-dom";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CheckoutReturn() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
          <CheckCircle className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Payment Complete!</h1>
        <p className="text-muted-foreground">
          Thank you for your order. You'll receive a confirmation email shortly.
        </p>
        {sessionId && (
          <div className="px-4 py-3 rounded-lg bg-muted/50 border border-border">
            <span className="text-xs text-muted-foreground">Order Reference</span>
            <p className="text-sm font-mono text-foreground select-all">{sessionId.slice(0, 12)}...</p>
          </div>
        )}
        <Button asChild>
          <Link to="/">Return Home</Link>
        </Button>
      </div>
    </div>
  );
}
