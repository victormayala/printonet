import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useHostedStoresEnabled } from "@/hooks/useHostedStoresEnabled";

export function HostedStoresRoute({ children }: { children: React.ReactNode }) {
  const { hostedStoresEnabled, isLoading } = useHostedStoresEnabled();
  if (isLoading) {
    return (
      <div className="p-10 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!hostedStoresEnabled) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
