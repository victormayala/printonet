import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/DashboardLayout";
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
import ProductPreview from "./pages/ProductPreview";
import ReviewDesign from "./pages/ReviewDesign";
import Checkout from "./pages/Checkout";
import CheckoutReturn from "./pages/CheckoutReturn";
import Cart from "./pages/Cart";
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
    <BrowserRouter>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <Routes>
            {/* Redirect root to auth */}
            <Route path="/" element={<Navigate to="/auth" replace />} />

            {/* Auth */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Public */}
            <Route path="/demo" element={<Demo />} />
            <Route path="/embed/:sessionId" element={<EmbedCustomizer />} />
            <Route path="/preview/:productId" element={<ProductPreview />} />
            <Route path="/print/:sessionId" element={<PrintView />} />
            <Route path="/review/:sessionId" element={<ReviewDesign />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout/return" element={<CheckoutReturn />} />
            <Route path="/checkout/:sessionId" element={<Checkout />} />

            {/* Dashboard */}
            <Route path="/products" element={<DashboardRoute><Products initialTab="products" /></DashboardRoute>} />
            <Route path="/storefront/shopify" element={<DashboardRoute><Products initialTab="shopify" /></DashboardRoute>} />
            <Route path="/storefront/woocommerce" element={<DashboardRoute><Products initialTab="woocommerce" /></DashboardRoute>} />
            <Route path="/storefront" element={<Navigate to="/storefront/shopify" replace />} />
            <Route path="/suppliers" element={<DashboardRoute><Products initialTab="suppliers" /></DashboardRoute>} />
            <Route path="/orders" element={<DashboardRoute><Orders /></DashboardRoute>} />
            <Route path="/templates" element={<DashboardRoute><Templates /></DashboardRoute>} />
            <Route path="/brand-settings" element={<DashboardRoute><BrandSettings /></DashboardRoute>} />
            <Route path="/developers" element={<DashboardRoute><Developers /></DashboardRoute>} />
            <Route path="/profile" element={<DashboardRoute><ProfileSettings /></DashboardRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
