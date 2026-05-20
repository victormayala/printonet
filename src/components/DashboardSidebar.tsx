import { useEffect, useState } from "react";
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
  Store,
  BookOpen,
  Shield,
  ChevronRight,
} from "lucide-react";

import { NavLink, useLocation } from "react-router-dom";
import { NavLink as RouterNavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";
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
      { title: "Stores", to: "/corporate-stores", icon: Store },
      { title: "Shopify", to: "/corporate-stores?tab=shopify", icon: ShoppingBag },
      { title: "WooCommerce", to: "/corporate-stores?tab=woocommerce", icon: Globe },
    ],
  },
  {
    title: "Catalog",
    url: "/products",
    icon: BookOpen,
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
  const { isSuperAdmin } = useIsSuperAdmin();
  const { pathname, search } = useLocation();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      localStorage.removeItem("customizer_cart");
      localStorage.removeItem("customizer_synced_sessions");
    } catch {
      /* ignore */
    }
  }, []);

  const renderItem = (item: NavItem) => {
    const hasSub = !!item.subItems?.length;
    const isOpen = !!openGroups[item.title];
    const showSub = !collapsed && hasSub && isOpen;

    return (
      <SidebarMenuItem key={item.title}>
        <div className="relative">
          <SidebarMenuButton asChild>
            <RouterNavLink
              to={item.url}
              end
              className={`hover:bg-sidebar-accent ${hasSub && !collapsed ? "pr-9" : ""}`}
              activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
              onClick={() => {
                if (hasSub && !collapsed) {
                  setOpenGroups((prev) => ({ ...prev, [item.title]: true }));
                }
              }}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.title}</span>}
            </RouterNavLink>
          </SidebarMenuButton>
          {hasSub && !collapsed && (
            <button
              type="button"
              aria-label={isOpen ? `Collapse ${item.title}` : `Expand ${item.title}`}
              aria-expanded={isOpen}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOpenGroups((prev) => ({ ...prev, [item.title]: !prev[item.title] }));
              }}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 inline-flex items-center justify-center rounded hover:bg-sidebar-accent text-sidebar-foreground/70"
            >
              <ChevronRight
                className={`h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
              />
            </button>
          )}
        </div>
        {showSub && (
          <SidebarMenuSub className="mt-2 mb-1">
            {item.subItems!.map((sub) => {
              const active = isSubActive(sub.to, pathname, search);
              return (
                <SidebarMenuSubItem key={sub.to}>
                  <SidebarMenuSubButton
                    asChild
                    isActive={active}
                    className={
                      active
                        ? "!text-accent hover:!text-accent !bg-transparent [&>svg]:!text-accent"
                        : ""
                    }
                  >
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
            <SidebarMenu>
              {navItems.map(renderItem)}
              {isSuperAdmin && renderItem({ title: "Admin", url: "/admin", icon: Shield })}
            </SidebarMenu>
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
