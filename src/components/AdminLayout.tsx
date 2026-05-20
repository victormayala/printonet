import { NavLink, Navigate, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, Building2, ShoppingBag, CreditCard, ArrowLeft, Shield, Loader2, LogOut, Mail } from "lucide-react";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const items = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/invites", label: "Invites", icon: Mail },
  { to: "/admin/stores", label: "Stores", icon: Building2 },
  { to: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { to: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const { isSuperAdmin, isLoading } = useIsSuperAdmin();
  const { pathname } = useLocation();

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="w-60 shrink-0 border-r border-border bg-card flex flex-col">
        <div className="h-14 flex items-center gap-2 px-4 border-b border-border">
          <Shield className="h-5 w-5 text-accent" />
          <div className="leading-tight">
            <div className="text-sm font-semibold">Platform Admin</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Printonet</div>
          </div>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-accent/15 text-accent font-medium"
                    : "text-foreground/80 hover:bg-muted hover:text-foreground"
                )
              }
            >
              <it.icon className="h-4 w-4" />
              {it.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-2 border-t border-border space-y-1">
          <NavLink
            to="/dashboard"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground/80 hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </NavLink>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive hover:bg-muted"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 overflow-auto">
        <div className="p-8 max-w-[1400px] mx-auto w-full">{children}</div>
      </main>
    </div>
  );
}
