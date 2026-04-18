import { useState } from "react";
import { Package, Paintbrush, Code, User, LogOut, Home, ShoppingBag, ShoppingCart, LayoutTemplate, Truck, Store, Globe, ChevronDown } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/hooks/useCart";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import logo from "@/assets/customizer-studio-short-logo-2.svg";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Products", url: "/products", icon: Package },
];

const storefrontItems = [
  { title: "Shopify", url: "/storefront/shopify", icon: ShoppingBag },
  { title: "WooCommerce", url: "/storefront/woocommerce", icon: Globe },
];

const secondaryItems = [
  { title: "Suppliers", url: "/suppliers", icon: Truck },
  { title: "Orders", url: "/orders", icon: ShoppingBag },
  { title: "Templates", url: "/templates", icon: LayoutTemplate },
  { title: "Brand Settings", url: "/brand-settings", icon: Paintbrush },
  { title: "Developers", url: "/developers", icon: Code },
  { title: "Profile", url: "/profile", icon: User },
];

export function DashboardSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut } = useAuth();
  const { totalItems } = useCart();

  const isStorefrontActive = location.pathname.startsWith("/storefront");
  const [storefrontOpen, setStorefrontOpen] = useState(isStorefrontActive);

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Logo */}
        <div className="flex items-center gap-2 px-4 py-4 border-b border-sidebar-border">
          <img src={logo} alt="Printonet" className="h-7 w-7 shrink-0" />
          {!collapsed && (
            <span className="font-semibold text-sm text-sidebar-foreground truncate">
              Printonet
            </span>
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

              {/* Storefront — collapsible group */}
              <Collapsible open={collapsed ? true : storefrontOpen} onOpenChange={setStorefrontOpen}>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      className={`hover:bg-sidebar-accent ${isStorefrontActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : ""}`}
                    >
                      <Store className="h-4 w-4 shrink-0" />
                      {!collapsed && (
                        <>
                          <span className="flex-1 text-left">Storefront</span>
                          <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${storefrontOpen ? "rotate-180" : ""}`} />
                        </>
                      )}
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  {!collapsed && (
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {storefrontItems.map((sub) => (
                          <SidebarMenuSubItem key={sub.title}>
                            <SidebarMenuSubButton asChild>
                              <NavLink
                                to={sub.url}
                                end
                                className="hover:bg-sidebar-accent"
                                activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                              >
                                <sub.icon className="h-4 w-4 shrink-0" />
                                <span>{sub.title}</span>
                              </NavLink>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  )}
                </SidebarMenuItem>
              </Collapsible>

              {secondaryItems.map((item) => (
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
            <SidebarMenuButton
              onClick={signOut}
              className="hover:bg-sidebar-accent text-destructive hover:text-destructive cursor-pointer"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {!collapsed && <span>Sign Out</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
