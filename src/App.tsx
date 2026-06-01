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
import Websites from "./pages/Websites";
import WebsiteDetails from "./pages/WebsiteDetails";
import StoreShop from "./pages/StoreShop";
import StoreCustomize from "./pages/StoreCustomize";
import NotFound from "./pages/NotFound";
import LayersPreview from "./pages/LayersPreview";
import OrderApproval from "./pages/OrderApproval";
import {
  PublicWebsiteHome,
  PublicWebsitePage,
  PublicWebsiteBlogIndex,
  PublicWebsiteBlogPost,
} from "./pages/PublicWebsite";

import Unsubscribe from "./pages/Unsubscribe";
import Pricing from "./pages/Pricing";
import Billing from "./pages/Billing";
import BillingReturn from "./pages/BillingReturn";
import Dashboard from "./pages/Dashboard";
import { AdminLayout } from "@/components/AdminLayout";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminStores from "./pages/admin/AdminStores";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminSubscriptions from "./pages/admin/AdminSubscriptions";
import AdminInvites from "./pages/admin/AdminInvites";



const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Show cached data instantly on every navigation; refetch silently
      // in the background instead of flashing a full-page spinner.
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      staleTime: 5 * 60 * 1000,
      // Keep query data in memory for the whole session so revisiting
      // a page renders from cache with no loading state.
      gcTime: Infinity,
      // When a query key changes (e.g. switching store ids), keep the
      // previously rendered data on screen while the new request runs.
      placeholderData: (previousData: unknown) => previousData,
    },
  },
});

const currentHost = typeof window !== "undefined" ? window.location.hostname.toLowerCase() : "";
const isPotentialStoreHost =
  !!currentHost &&
  !["localhost", "127.0.0.1", "platform.printonet.com", "printonet.lovable.app", "customizerstudio.com"].includes(currentHost) &&
  !currentHost.endsWith(".lovable.app") &&
  !currentHost.endsWith(".lovableproject.com");

function DashboardRoute() {
  return (
    <ProtectedRoute>
      <DashboardLayout />
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
            <Route path="/" element={isPotentialStoreHost ? <StoreShop customDomainHost={currentHost} /> : <Navigate to="/dashboard" replace />} />
            <Route element={<DashboardRoute />}>
              <Route path="/dashboard" element={isPotentialStoreHost ? <StoreShop customDomainHost={currentHost} /> : <Dashboard />} />
              <Route path="/products" element={isPotentialStoreHost ? <StoreShop customDomainHost={currentHost} /> : <Products initialTab="products" />} />
              <Route path="/storefront" element={<Navigate to="/corporate-stores?tab=shopify" replace />} />
              <Route path="/corporate-stores" element={<CorporateStores />} />
              <Route path="/corporate-stores/:id" element={<CorporateStoreDetails />} />
              <Route path="/websites" element={<Websites />} />
              <Route path="/websites/:id" element={<WebsiteDetails />} />
              <Route path="/suppliers" element={<Products initialTab="suppliers" />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/customizer" element={<Navigate to="/corporate-stores" replace />} />
              <Route path="/customizer/brand" element={<Navigate to="/corporate-stores" replace />} />
              <Route path="/customizer/developers" element={<Navigate to="/corporate-stores" replace />} />
              <Route path="/brand-settings" element={<Navigate to="/corporate-stores" replace />} />
              <Route path="/developers" element={<Navigate to="/corporate-stores" replace />} />
              <Route path="/profile" element={<ProfileSettings />} />
            </Route>

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
            <Route path="/approval/:token" element={<OrderApproval />} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />

            {/* Public website preview (also served at sites.printonet.com without /w prefix) */}
            <Route path="/w/:storeSlug" element={<PublicWebsiteHome />} />
            <Route path="/w/:storeSlug/blog" element={<PublicWebsiteBlogIndex />} />
            <Route path="/w/:storeSlug/blog/:postSlug" element={<PublicWebsiteBlogPost />} />
            <Route path="/w/:storeSlug/:pageSlug" element={<PublicWebsitePage />} />

            {/* Dashboard */}
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/billing" element={<Navigate to="/profile?tab=billing" replace />} />
            <Route path="/billing/return" element={<BillingReturn />} />

            {/* Super admin */}
            <Route path="/admin" element={<AdminLayout><AdminOverview /></AdminLayout>} />
            <Route path="/admin/users" element={<AdminLayout><AdminUsers /></AdminLayout>} />
            <Route path="/admin/invites" element={<AdminLayout><AdminInvites /></AdminLayout>} />
            <Route path="/admin/stores" element={<AdminLayout><AdminStores /></AdminLayout>} />
            <Route path="/admin/orders" element={<AdminLayout><AdminOrders /></AdminLayout>} />
            <Route path="/admin/subscriptions" element={<AdminLayout><AdminSubscriptions /></AdminLayout>} />

            <Route path="*" element={isPotentialStoreHost ? <StoreShop customDomainHost={currentHost} /> : <NotFound />} />
          </Routes>
          )}
        </TooltipProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
