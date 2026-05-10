import { useState } from "react";
import { Paintbrush, Code } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import BrandSettings from "@/pages/BrandSettings";
import Developers from "@/pages/Developers";

type Tab = "brand" | "developers";

export function StoreCustomizerSettings({ storeName }: { storeName: string }) {
  const [tab, setTab] = useState<Tab>("brand");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customizer studio</CardTitle>
        <CardDescription>
          Appearance defaults and WooCommerce embed docs for <span className="font-medium text-foreground">{storeName}</span>.
          Enable products in <span className="font-medium text-foreground">Customizable products</span> above before going live.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Brand settings save to your Printonet account. Sessions tied to this store usually pick up colors and logos from the{" "}
          <span className="font-medium text-foreground">Branding</span> section above; theme and radius apply when you pass{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">brand</code> in the SDK or for sessions without store metadata.
        </p>
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList className="mb-4 w-full sm:w-auto flex-wrap">
            <TabsTrigger value="brand" className="gap-2 flex-1 sm:flex-none">
              <Paintbrush className="h-4 w-4" /> Brand settings
            </TabsTrigger>
            <TabsTrigger value="developers" className="gap-2 flex-1 sm:flex-none">
              <Code className="h-4 w-4" /> Developers
            </TabsTrigger>
          </TabsList>
          <TabsContent value="brand" className="mt-0 border rounded-lg p-4 sm:p-6 bg-muted/30">
            <BrandSettings />
          </TabsContent>
          <TabsContent value="developers" className="mt-0 border rounded-lg p-4 sm:p-6 bg-muted/30">
            <Developers />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
