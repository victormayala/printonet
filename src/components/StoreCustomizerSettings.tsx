import { useState } from "react";
import { Paintbrush, Code } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StoreBrandSettings } from "@/components/StoreBrandSettings";
import Developers from "@/pages/Developers";
import { CorporateStore } from "@/types/corporateStore";

type Tab = "brand" | "developers";

export function StoreCustomizerSettings({ store }: { store: CorporateStore }) {
  const [tab, setTab] = useState<Tab>("brand");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customizer studio</CardTitle>
        <CardDescription>
          Per-store customizer appearance and embed instructions for{" "}
          <span className="font-medium text-foreground">{store.name}</span>.
          These settings only affect this store — your account-wide brand stays untouched.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
            <StoreBrandSettings store={store} />
          </TabsContent>
          <TabsContent value="developers" className="mt-0 border rounded-lg p-4 sm:p-6 bg-muted/30">
            <Developers />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
