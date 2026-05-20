import { useEffect } from "react";
import {
  Package,
  User,
  LogOut,
  ShoppingBag,
  Building2,
  LayoutDashboard,
  LayoutGrid,
  Truck,
  Globe,
  CreditCard,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { NavLink as RouterNavLink } from "@/components/NavLink";
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

type SubItem = { title: string; to: string; icon: React.ComponentType<{ className?: string }> };
type NavItem = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Path prefixes that should expand & highlight this parent. */
  matchPaths?: string[];
  subItems?: SubItem[];
};

const navItems: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  {
    title: "My Stores",
    url: "/corporate-stores",
    icon: Building2,
    matchPaths: ["/corporate-stores"],
    subItems: [
      { title: "My Stores", to: "/corporate-stores", icon: Building2 },
      { title: "Shopify", to: "/corporate-stores?tab=shopify", icon: ShoppingBag },
      { title: "WooCommerce", to: "/corporate-stores?tab=woocommerce", icon: Globe },
    ],
  },
  {
    title: "Products",
    url: "/products",
    icon: Package,
    matchPaths: ["/products", "/suppliers"],
    subItems: [
      { title: "Products", to: "/products", icon: Package },
      { title: "Categories", to: "/products?tab=categories", icon: LayoutGrid },
      { title: "Suppliers", to: "/suppliers", icon: Truck },
    ],
  },
  { title: "Orders", url: "/orders", icon: ShoppingBag },
];

const profileItem: NavItem = {
  title: "Profile",
  url: "/profile",
  icon: User,
  matchPaths: ["/profile"],
  subItems: [
    { title: "Profile", to: "/profile", icon: User },
    { title: "Billing", to: "/profile?tab=billing", icon: CreditCard },
  ],
};

function isSubActive(to: string, pathname: string, search: string): boolean {
  const [toPath, toQuery = ""] = to.split("?");
  if (toPath !== pathname) return false;
  const current = new URLSearchParams(search);
  const target = new URLSearchParams(toQuery);
  const currentTab = current.get("tab") ?? "";
  const targetTab = target.get("tab") ?? "";
  return currentTab === targetTab;
}

function isParentActive(item: NavItem, pathname: string): boolean {
  const paths = item.matchPaths ?? [item.url];
  return paths.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function DashboardSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { signOut } = useAuth();
  const { pathname, search } = useLocation();

  useEffect(() => {
    try {
      localStorage.removeItem("customizer_cart");
      localStorage.removeItem("customizer_synced_sessions");
    } catch {
      /* ignore */
    }
  }, []);

  const renderItem = (item: NavItem) => {
    const parentActive = isParentActive(item, pathname);
    const showSub = !collapsed && !!item.subItems && parentActive;

    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton asChild>
          <RouterNavLink
            to={item.url}
            end
            className="hover:bg-sidebar-accent"
            activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{item.title}</span>}
          </RouterNavLink>
        </SidebarMenuButton>
        {showSub && (
          <SidebarMenuSub>
            {item.subItems!.map((sub) => {
              const active = isSubActive(sub.to, pathname, search);
              return (
                <SidebarMenuSubItem key={sub.to}>
                  <SidebarMenuSubButton asChild isActive={active}>
                    <NavLink to={sub.to} className="flex items-center gap-2">
                      <sub.icon className="h-3.5 w-3.5 shrink-0" />
                      <span>{sub.title}</span>
                    </NavLink>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        )}
      </SidebarMenuItem>
    );
  };

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
            <SidebarMenu>{navItems.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {renderItem(profileItem)}
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
