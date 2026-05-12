import { useEffect } from "react";
import { Package, User, LogOut, ShoppingBag, Truck, Building2, CreditCard } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import logoIcon from "@/assets/printonet-logo-sidebar.svg";
import logoFull from "@/assets/printonet-logo-sidebar-full.svg";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Products", url: "/products", icon: Package },
  { title: "My Stores", url: "/corporate-stores", icon: Building2 },
  { title: "Suppliers", url: "/suppliers", icon: Truck },
  { title: "Orders", url: "/orders", icon: ShoppingBag },
  { title: "Billing", url: "/billing", icon: CreditCard },
];

export function DashboardSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { signOut } = useAuth();

  useEffect(() => {
    try {
      // Platform dashboard no longer uses hosted cart UX.
      localStorage.removeItem("customizer_cart");
      localStorage.removeItem("customizer_synced_sessions");
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 px-4 py-4 border-b border-sidebar-border">
          {collapsed ? (
            <img src={logoIcon} alt="Printonet" className="h-7 w-7 shrink-0" />
          ) : (
            <img src={logoFull} alt="Printonet" className="h-7 w-auto shrink-0" />
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink to="/profile" className="hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                <User className="h-4 w-4 shrink-0" />
                {!collapsed && <span>Profile</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={signOut}
              className="hover:bg-sidebar-accent text-destructive hover:text-destructive cursor-pointer"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {!collapsed && <span>Sign Out</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="h-6" />
      </SidebarFooter>
    </Sidebar>
  );
}
