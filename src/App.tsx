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
import Demo from "./pages/Demo";
import Products from "./pages/Products";
import Orders from "./pages/Orders";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import ProfileSettings from "./pages/ProfileSettings";
import PrintView from "./pages/PrintView";
import ProductPreview from "./pages/ProductPreview";
import ReviewDesign from "./pages/ReviewDesign";
import Checkout from "./pages/Checkout";
import CheckoutReturn from "./pages/CheckoutReturn";
import Cart from "./pages/Cart";
import CorporateStores from "./pages/CorporateStores";
import CorporateStoreDetails from "./pages/CorporateStoreDetails";
import StoreShop from "./pages/StoreShop";
import StoreCustomize from "./pages/StoreCustomize";
import NotFound from "./pages/NotFound";
import LayersPreview from "./pages/LayersPreview";
import Pricing from "./pages/Pricing";
import Billing from "./pages/Billing";
import BillingReturn from "./pages/BillingReturn";
import Customizer from "./pages/Customizer";

const queryClient = new QueryClient();

const currentHost = typeof window !== "undefined" ? window.location.hostname.toLowerCase() : "";
const isPotentialStoreHost =
  !!currentHost &&
  !["localhost", "127.0.0.1", "platform.printonet.com", "printonet.lovable.app", "customizerstudio.com"].includes(currentHost) &&
  !currentHost.endsWith(".lovable.app") &&
  !currentHost.endsWith(".lovableproject.com");

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
            <Route path="/" element={isPotentialStoreHost ? <StoreShop customDomainHost={currentHost} /> : <Navigate to="/auth" replace />} />

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
            <Route path="/s/:tenantSlug" element={<StoreShop />} />
            <Route path="/s/:tenantSlug/customize/:productId" element={<StoreCustomize />} />
            <Route path="/customize/:productId" element={isPotentialStoreHost ? <StoreCustomize customDomainHost={currentHost} /> : <NotFound />} />
            <Route path="/layers-preview" element={<LayersPreview />} />

            {/* Dashboard */}
            <Route path="/products" element={isPotentialStoreHost ? <StoreShop customDomainHost={currentHost} /> : <DashboardRoute><Products initialTab="products" /></DashboardRoute>} />
            <Route path="/storefront" element={<Navigate to="/corporate-stores?tab=shopify" replace />} />
            <Route path="/corporate-stores" element={<DashboardRoute><CorporateStores /></DashboardRoute>} />
            <Route path="/corporate-stores/:id" element={<DashboardRoute><CorporateStoreDetails /></DashboardRoute>} />
            <Route path="/suppliers" element={<DashboardRoute><Products initialTab="suppliers" /></DashboardRoute>} />
            <Route path="/orders" element={<DashboardRoute><Orders /></DashboardRoute>} />
            <Route path="/customizer" element={<DashboardRoute><Customizer /></DashboardRoute>} />
            <Route path="/customizer/brand" element={<Navigate to="/customizer" replace />} />
            <Route path="/customizer/developers" element={<Navigate to="/customizer" replace />} />
            <Route path="/brand-settings" element={<Navigate to="/customizer" replace />} />
            <Route path="/developers" element={<Navigate to="/customizer" replace />} />
            <Route path="/profile" element={<DashboardRoute><ProfileSettings /></DashboardRoute>} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/billing" element={<DashboardRoute><Billing /></DashboardRoute>} />
            <Route path="/billing/return" element={<BillingReturn />} />
            <Route path="*" element={isPotentialStoreHost ? <StoreShop customDomainHost={currentHost} /> : <NotFound />} />
          </Routes>
        </TooltipProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
