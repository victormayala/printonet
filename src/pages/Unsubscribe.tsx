import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type State =
  | { kind: "loading" }
  | { kind: "valid" }
  | { kind: "already" }
  | { kind: "invalid"; message: string }
  | { kind: "submitting" }
  | { kind: "success" };

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (!token) {
      setState({ kind: "invalid", message: "Missing unsubscribe token." });
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_ANON } },
        );
        const data = await res.json();
        if (!res.ok) {
          setState({ kind: "invalid", message: data?.error || "Invalid link." });
          return;
        }
        if (data.valid === false && data.reason === "already_unsubscribed") {
          setState({ kind: "already" });
          return;
        }
        setState({ kind: "valid" });
      } catch (e) {
        setState({ kind: "invalid", message: (e as Error).message });
      }
    })();
  }, [token]);

  const confirm = async () => {
    setState({ kind: "submitting" });
    const { data, error } = await supabase.functions.invoke(
      "handle-email-unsubscribe",
      { body: { token } },
    );
    if (error) {
      setState({ kind: "invalid", message: error.message });
      return;
    }
    if (data?.success === false && data?.reason === "already_unsubscribed") {
      setState({ kind: "already" });
      return;
    }
    setState({ kind: "success" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">Email preferences</h1>
          <p className="text-sm text-muted-foreground">
            Manage your email subscription for Printonet.
          </p>
        </div>

        {state.kind === "loading" && (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {state.kind === "valid" && (
          <div className="space-y-4">
            <p className="text-sm">
              Click the button below to unsubscribe from these emails. You can
              always re-subscribe later by contacting the sender.
            </p>
            <Button className="w-full" onClick={confirm}>
              Confirm unsubscribe
            </Button>
          </div>
        )}

        {state.kind === "submitting" && (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {state.kind === "success" && (
          <div className="text-center space-y-3 py-2">
            <CheckCircle2 className="h-10 w-10 text-primary mx-auto" />
            <p className="text-sm">
              You've been unsubscribed. You won't receive further emails of this
              type.
            </p>
          </div>
        )}

        {state.kind === "already" && (
          <div className="text-center space-y-3 py-2">
            <CheckCircle2 className="h-10 w-10 text-primary mx-auto" />
            <p className="text-sm">You're already unsubscribed.</p>
          </div>
        )}

        {state.kind === "invalid" && (
          <div className="text-center space-y-3 py-2">
            <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
            <p className="text-sm text-muted-foreground">{state.message}</p>
          </div>
        )}
      </Card>
    </div>
  );
}
