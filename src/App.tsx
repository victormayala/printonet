import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index";
import Products from "./pages/Products";
import DesignStudio from "./pages/DesignStudio";
import Inventory from "./pages/Inventory";
import EmbedCustomizer from "./pages/EmbedCustomizer";
import Developers from "./pages/Developers";
import NotFound from "./pages/NotFound";
import { useParams } from "react-router-dom";

function DesignStudioWrapper() {
  const { productId } = useParams();
  return <DesignStudio key={productId} />;
}

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/products" element={<Products />} />
          <Route path="/design/:productId" element={<DesignStudioWrapper />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/embed/:sessionId" element={<EmbedCustomizer />} />
          <Route path="/developers" element={<Developers />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
