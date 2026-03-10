import { LayoutDashboard, Columns3, Bell, Settings, LogOut, ListChecks, ShoppingCart, Sun, Moon, UserCircle, Car, Instagram } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { useIsAppAdmin, useCanManage } from "@/hooks/useUserRole";
import { useState, useEffect, useMemo } from "react";
import { useNotificationCount } from "@/pages/Notifications";
import { Badge } from "@/components/ui/badge";
import logoFox from "@/assets/logo-fox.png";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarSeparator,
} from "@/components/ui/sidebar";

const baseNav = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Quadros", url: "/boards", icon: Columns3 },
  { title: "Tarefas Fixas", url: "/recurring-tasks", icon: ListChecks },
  { title: "Notificações", url: "/notifications", icon: Bell },
  { title: "Configurações", url: "/settings", icon: Settings },
  { title: "Meu Perfil", url: "/profile", icon: UserCircle },
];

export function AppSidebar() {
  const { signOut } = useAuth();
  const { data: isAdmin } = useIsAppAdmin();
  const canViewPurchases = useCanManage("can_view_purchases");
  const canViewFleet = useCanManage("can_view_fleet");
  const canManageFleet = useCanManage("can_manage_fleet");
  const canViewSocial = useCanManage("can_view_social");
  const canManageSocial = useCanManage("can_manage_social");
  const notificationCount = useNotificationCount();
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
      document.documentElement.classList.add("dark");
      setIsDark(true);
    } else if (saved === "light") {
      document.documentElement.classList.remove("dark");
      setIsDark(false);
    }
  }, []);

  const mainNav = useMemo(() => {
    const nav = [...baseNav];
    if (isAdmin || canViewPurchases) {
      nav.splice(3, 0, { title: "Compras", url: "/purchases", icon: ShoppingCart });
    }
    if (isAdmin || canViewFleet || canManageFleet) {
      const insertIdx = nav.findIndex(n => n.title === "Notificações");
      nav.splice(insertIdx >= 0 ? insertIdx : nav.length, 0, { title: "Frota", url: "/fleet", icon: Car });
    }
    if (isAdmin || canViewSocial || canManageSocial) {
      const insertIdx = nav.findIndex(n => n.title === "Notificações");
      nav.splice(insertIdx >= 0 ? insertIdx : nav.length, 0, { title: "Social Media", url: "/social-media", icon: Instagram });
    }
    return nav;
  }, [isAdmin, canViewPurchases, canViewFleet, canManageFleet, canViewSocial, canManageSocial]);

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <img src={logoFox} alt="TaskFox" className="h-8 w-auto" />
          <span className="text-lg font-bold tracking-tight">TaskFox</span>
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end={item.url === "/"} activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                      <item.icon className="h-4 w-4" />
                      <span className="flex-1">{item.title}</span>
                      {item.title === "Notificações" && notificationCount > 0 && (
                        <Badge variant="destructive" className="ml-auto h-5 min-w-5 px-1 text-xs flex items-center justify-center">
                          {notificationCount > 99 ? "99+" : notificationCount}
                        </Badge>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={toggleTheme} className="text-muted-foreground hover:text-foreground">
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              <span>{isDark ? "Tema Claro" : "Tema Escuro"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut} className="text-muted-foreground hover:text-destructive">
              <LogOut className="h-4 w-4" />
              <span>Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
