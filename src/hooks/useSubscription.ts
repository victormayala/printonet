import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getStripeEnvironment } from "@/lib/stripe";

export type PlanKey =
  | "customizer_monthly"
  | "starter_monthly"
  | "growth_monthly"
  | "pro_monthly";

export const PLAN_META: Record<PlanKey, {
  name: string;
  monthly: number;
  includedStores: number;
  includedSeats: number;
  productsPerStore: number | null; // null = N/A (e.g. customizer-only)
  support: string;
  feeBps: number;
  feeLabel: string;
}> = {
  customizer_monthly: {
    name: "Printonet Product Customizer",
    monthly: 29,
    includedStores: 0,
    includedSeats: 1,
    productsPerStore: null,
    support: "Email Support",
    feeBps: 0,
    feeLabel: "—",
  },
  starter_monthly: {
    name: "Starter",
    monthly: 39,
    includedStores: 1,
    includedSeats: 1,
    productsPerStore: 100,
    support: "Email Support",
    feeBps: 250,
    feeLabel: "2.5%",
  },
  growth_monthly: {
    name: "Grow",
    monthly: 99,
    includedStores: 3,
    includedSeats: 3,
    productsPerStore: 250,
    support: "Email + Chat Support",
    feeBps: 150,
    feeLabel: "1.5%",
  },
  pro_monthly: {
    name: "Pro",
    monthly: 299,
    includedStores: 10,
    includedSeats: 10,
    productsPerStore: 500,
    support: "Email + Chat + Priority Support",
    feeBps: 50,
    feeLabel: "0.5%",
  },
};

export const EXTRA_STORE_PRICE = 29;
export const EXTRA_SEAT_PRICE = 10;

export function useSubscription() {
  const { user } = useAuth();
  const env = getStripeEnvironment();

  const query = useQuery({
    queryKey: ["subscription", user?.id, env],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user!.id)
        .eq("environment", env)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const sub = query.data;
  const planKey = (sub?.price_id ?? null) as PlanKey | null;
  const meta = planKey && PLAN_META[planKey] ? PLAN_META[planKey] : null;
  const periodEnd = sub?.current_period_end ? new Date(sub.current_period_end) : null;

  const isActive = !!sub && (
    (["active", "trialing", "past_due"].includes(sub.status) &&
      (!periodEnd || periodEnd > new Date()))
    || (sub.status === "canceled" && periodEnd && periodEnd > new Date())
  );

  const extraStores = sub?.extra_store_quantity ?? 0;
  const includedStores = meta?.includedStores ?? 0;
  const totalStoreLimit = isActive ? includedStores + extraStores : 0;

  return {
    ...query,
    subscription: sub,
    planKey,
    planMeta: meta,
    isActive,
    extraStores,
    includedStores,
    totalStoreLimit,
    feeBps: meta?.feeBps ?? null,
    feeLabel: meta?.feeLabel ?? null,
    periodEnd,
    cancelAtPeriodEnd: !!sub?.cancel_at_period_end,
  };
}
