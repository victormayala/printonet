import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Paintbrush, Code, Info } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import BrandSettings from "@/pages/BrandSettings";
import Developers from "@/pages/Developers";

type Tab = "brand" | "developers";

export default function Customizer() {
  const [tab, setTab] = useState<Tab>("brand");

  return (
    <div className="container max-w-7xl mx-auto py-8 px-4 space-y-6">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold">Customizer Studio</h1>
        <p className="mt-1 text-muted-foreground">
          Configure the embeddable customizer's appearance and copy the snippet to install it on your Shopify store.
        </p>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6 flex items-start gap-3">
          <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm text-foreground">
            These are your <span className="font-medium">account-wide</span> customizer brand settings — used when you embed the
            customizer on an external Shopify store via plugin. To override branding for a specific Printonet
            hosted store, open it from{" "}
            <Link to="/corporate-stores" className="font-medium text-primary hover:underline">My Stores</Link> and edit the
            Customizer tab.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>Brand the embedded customizer and grab your install snippet.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
            <TabsList className="mb-4 w-full sm:w-auto flex-wrap">
              <TabsTrigger value="brand" className="gap-2 flex-1 sm:flex-none">
                <Paintbrush className="h-4 w-4" /> Brand settings
              </TabsTrigger>
              <TabsTrigger value="developers" className="gap-2 flex-1 sm:flex-none">
                <Code className="h-4 w-4" /> Install & developers
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
    </div>
  );
}
