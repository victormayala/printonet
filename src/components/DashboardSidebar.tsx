import { Package, Wand2, User, LogOut, Home, ShoppingBag, ShoppingCart, Truck, Building2 } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/hooks/useCart";
import { Badge } from "@/components/ui/badge";
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
  { title: "Customizer", url: "/customizer", icon: Wand2 },
];

export function DashboardSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { signOut } = useAuth();
  const { totalItems } = useCart();

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
                      end={item.url !== "/storefront" && item.url !== "/customizer"}
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
              <NavLink to="/cart" className="hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                <div className="relative">
                  <ShoppingCart className="h-4 w-4 shrink-0" />
                  {totalItems > 0 && (
                    <Badge className="absolute -top-2 -right-3 h-4 min-w-4 px-1 text-[10px] flex items-center justify-center">
                      {totalItems}
                    </Badge>
                  )}
                </div>
                {!collapsed && <span>Cart</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink to="/" className="hover:bg-sidebar-accent" activeClassName="">
                <Home className="h-4 w-4 shrink-0" />
                {!collapsed && <span>Back to Home</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
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
