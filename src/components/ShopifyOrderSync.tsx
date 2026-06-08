import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type Props = {
  storeId: string;
  onDone?: () => void;
};

export default function ShopifyOrderSync({ storeId, onDone }: Props) {
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("shopify-register-orders-webhook", {
        body: { storeId },
      });
      if (error) throw error;
      const backfilled = (data as any)?.backfill?.backfilled ?? 0;
      toast({
        title: "Shopify orders synced",
        description:
          backfilled > 0
            ? `Imported ${backfilled} recent order${backfilled === 1 ? "" : "s"}. New orders will appear automatically.`
            : "Webhook registered. New paid orders will appear in the Orders tab automatically.",
      });
      onDone?.();
    } catch (e) {
      toast({
        title: "Could not sync Shopify orders",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sync Shopify orders</CardTitle>
        <CardDescription>
          Connect Shopify orders to the Printonet Orders tab so print files and design data show up
          for every customized product. Click once to subscribe to Shopify order webhooks and import
          orders from the last 30 days.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={run} disabled={busy} size="sm" className="gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {busy ? "Syncing…" : "Register webhook & backfill"}
        </Button>
      </CardContent>
    </Card>
  );
}
