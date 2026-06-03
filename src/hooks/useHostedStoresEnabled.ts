import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";

/**
 * Returns whether the current user should see the Hosted Stores
 * features (My Stores, Shopify, WooCommerce, hosted storefront).
 * Super admins always see them.
 */
export function useHostedStoresEnabled() {
  const { user } = useAuth();
  const { isSuperAdmin, isLoading: adminLoading } = useIsSuperAdmin();

  const { data, isLoading } = useQuery({
    queryKey: ["hosted-stores-enabled", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("hosted_stores_enabled")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) return false;
      return !!(data as { hosted_stores_enabled?: boolean } | null)?.hosted_stores_enabled;
    },
  });

  return {
    hostedStoresEnabled: isSuperAdmin || !!data,
    isLoading: adminLoading || isLoading,
  };
}
