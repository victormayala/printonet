import { useNavigate, useLocation } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Paintbrush, Code } from "lucide-react";
import BrandSettings from "./BrandSettings";
import Developers from "./Developers";

type CustomizerTab = "brand" | "developers";

export default function Customizer({ initialTab = "brand" }: { initialTab?: CustomizerTab } = {}) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleChange = (v: string) => {
    const path = v === "developers" ? "/customizer/developers" : "/customizer/brand";
    if (location.pathname !== path) navigate(path);
  };

  return (
    <div className="bg-background">
      <div className="p-4 sm:p-6 lg:p-8">
        <Tabs value={initialTab} onValueChange={handleChange}>
          <TabsList className="mb-6 w-full sm:w-auto flex-wrap">
            <TabsTrigger value="brand" className="gap-2 flex-1 sm:flex-none">
              <Paintbrush className="h-4 w-4" /> Brand Settings
            </TabsTrigger>
            <TabsTrigger value="developers" className="gap-2 flex-1 sm:flex-none">
              <Code className="h-4 w-4" /> Developers
            </TabsTrigger>
          </TabsList>

          <TabsContent value="brand" className="mt-0">
            <BrandSettings />
          </TabsContent>
          <TabsContent value="developers" className="mt-0">
            <Developers />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
