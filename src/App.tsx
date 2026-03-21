import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/DashboardLayout";
import Index from "./pages/Index";
import DesignStudio from "./pages/DesignStudio";
import EmbedCustomizer from "./pages/EmbedCustomizer";
import Developers from "./pages/Developers";
import Demo from "./pages/Demo";
import BrandSettings from "./pages/BrandSettings";
import Products from "./pages/Products";
import Orders from "./pages/Orders";
import Templates from "./pages/Templates";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import ProfileSettings from "./pages/ProfileSettings";
import PrintView from "./pages/PrintView";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function DashboardRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <DashboardLayout>{children}</DashboardLayout>
    </ProtectedRoute>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/demo" element={<Demo />} />
            <Route path="/embed/:sessionId" element={<EmbedCustomizer />} />
            <Route path="/print/:sessionId" element={<PrintView />} />
            <Route path="/products" element={<DashboardRoute><Products /></DashboardRoute>} />
            <Route path="/orders" element={<DashboardRoute><Orders /></DashboardRoute>} />
            <Route path="/templates" element={<DashboardRoute><Templates /></DashboardRoute>} />
            <Route path="/brand-settings" element={<DashboardRoute><BrandSettings /></DashboardRoute>} />
            <Route path="/developers" element={<DashboardRoute><Developers /></DashboardRoute>} />
            <Route path="/profile" element={<DashboardRoute><ProfileSettings /></DashboardRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
