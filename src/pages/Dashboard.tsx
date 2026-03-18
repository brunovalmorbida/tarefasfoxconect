import { useAuth } from "@/hooks/useAuth";
import { useIsAppAdmin } from "@/hooks/useUserRole";
import { DashboardSkeleton } from "@/components/dashboard/DashboardComponents";
import AdminDashboard from "@/components/dashboard/AdminDashboard";
import MemberDashboard from "@/components/dashboard/MemberDashboard";

export default function Dashboard() {
  const { user } = useAuth();
  const { data: isAdmin, isLoading: roleLoading } = useIsAppAdmin();

  if (roleLoading) return <DashboardSkeleton />;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  })();

  const userName = user?.user_metadata?.name || user?.email?.split("@")[0] || "";

  return (
    <div className="space-y-6">
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold tracking-tight">
          {greeting}, <span className="text-primary">{userName}</span> 👋
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isAdmin
            ? "Painel de gestão — visão geral da empresa"
            : "Aqui está o resumo da sua produtividade"
          }
        </p>
      </div>

      {isAdmin ? <AdminDashboard /> : <MemberDashboard />}
    </div>
  );
}
