import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBoards } from "@/hooks/useBoards";
import { usePurchases } from "@/hooks/usePurchases";
import { useFleetVehicles, useFleetMaintenances } from "@/hooks/useFleet";
import { useIsAppAdmin, useCanManage } from "@/hooks/useUserRole";
import { StatCard, DashboardSkeleton } from "./DashboardComponents";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Users, ClipboardList, AlertTriangle, ShoppingCart, Wrench,
  Activity, TrendingUp, CheckCircle2, Clock, BarChart3, Crown, Zap,
  ChevronDown, ChevronUp, ExternalLink,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { isPast, isToday, subDays, format, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [showOverdueTasks, setShowOverdueTasks] = useState(false);
  const { boards, isLoading: boardsLoading } = useBoards();
  const { purchases, isLoading: purchasesLoading } = usePurchases();
  const canViewFleet = useCanManage("can_view_fleet");
  const canViewPurchases = useCanManage("can_view_purchases");
  const { data: isAdmin } = useIsAppAdmin();

  const { vehicles, isLoading: vehiclesLoading } = useFleetVehicles();
  const { maintenances, isLoading: maintenancesLoading } = useFleetMaintenances();

  // Fetch all profiles for "most active" section
  const { data: profiles } = useQuery({
    queryKey: ["admin-dashboard-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, name, avatar_url");
      return data || [];
    },
  });

  // Fetch activity logs (last 7 days)
  const { data: activityLogs } = useQuery({
    queryKey: ["admin-dashboard-activity-logs"],
    queryFn: async () => {
      const sevenDaysAgo = subDays(new Date(), 7).toISOString();
      const { data } = await supabase
        .from("activity_log")
        .select("*")
        .gte("created_at", sevenDaysAgo)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Fetch recent activities with user names
  const { data: recentActivities } = useQuery({
    queryKey: ["admin-dashboard-recent-activities"],
    queryFn: async () => {
      const { data: logs } = await supabase
        .from("activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(8);
      if (!logs?.length) return [];
      const userIds = [...new Set(logs.map((l) => l.user_id))];
      const { data: profs } = await supabase.from("profiles").select("user_id, name").in("user_id", userIds);
      const profileMap = new Map(profs?.map((p) => [p.user_id, p.name]) || []);
      return logs.map((l) => ({ ...l, user_name: profileMap.get(l.user_id) || "Usuário" }));
    },
  });

  const isLoading = boardsLoading || purchasesLoading;

  // All tasks from all boards
  const allTasks = useMemo(() => {
    if (!boards) return [];
    const tasks: any[] = [];
    boards.forEach((board: any) => {
      board.board_columns?.forEach((col: any) => {
        col.tasks?.forEach((task: any) => {
          tasks.push({ ...task, columnName: col.name, boardName: board.name });
        });
      });
    });
    return tasks;
  }, [boards]);

  // Stats
  const stats = useMemo(() => {
    const totalTasks = allTasks.length;
    const doneTasks = allTasks.filter((t) => {
      const cn = t.columnName?.toLowerCase();
      return cn?.includes("concluí") || cn?.includes("done") || cn?.includes("concluido");
    }).length;
    const overdueTasks = allTasks.filter((t) => {
      if (!t.due_date) return false;
      const cn = t.columnName?.toLowerCase();
      const isDone = cn?.includes("concluí") || cn?.includes("done") || cn?.includes("concluido");
      return !isDone && isPast(new Date(t.due_date));
    }).length;

    const pendingPurchases = purchases.filter((p) => p.status === "pending").length;
    const vehiclesInMaintenance = vehicles?.filter((v) => v.status === "maintenance").length || 0;
    const pendingMaintenances = maintenances?.filter((m) => m.status !== "completed").length || 0;

    return { totalTasks, doneTasks, overdueTasks, pendingPurchases, vehiclesInMaintenance, pendingMaintenances };
  }, [allTasks, purchases, vehicles, maintenances]);

  // Most active users (by activity_log count in last 7 days)
  const mostActiveUsers = useMemo(() => {
    if (!activityLogs || !profiles) return [];
    const countMap = new Map<string, number>();
    activityLogs.forEach((log) => {
      countMap.set(log.user_id, (countMap.get(log.user_id) || 0) + 1);
    });
    return Array.from(countMap.entries())
      .map(([userId, count]) => {
        const profile = profiles.find((p) => p.user_id === userId);
        return { userId, name: profile?.name || "Usuário", count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [activityLogs, profiles]);

  // Weekly productivity chart data
  const weekChartData = useMemo(() => {
    if (!activityLogs) return [];
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

    return days.map((day) => {
      const dayStr = format(day, "yyyy-MM-dd");
      const count = activityLogs.filter((log) => log.created_at.startsWith(dayStr)).length;
      return {
        day: format(day, "EEE", { locale: ptBR }),
        atividades: count,
        isToday: isToday(day),
      };
    });
  }, [activityLogs]);

  // System alerts
  const alerts = useMemo(() => {
    const items: { type: string; label: string; count: number; color: string }[] = [];
    if (stats.overdueTasks > 0) items.push({ type: "overdue", label: "Tarefas atrasadas", count: stats.overdueTasks, color: "text-destructive" });
    if (stats.pendingPurchases > 0) items.push({ type: "purchases", label: "Compras pendentes", count: stats.pendingPurchases, color: "text-warning" });
    if (stats.pendingMaintenances > 0) items.push({ type: "maintenance", label: "Manutenções abertas", count: stats.pendingMaintenances, color: "text-blue-600" });
    return items;
  }, [stats]);

  if (isLoading) return <DashboardSkeleton />;

  const teamProductivityPct = stats.totalTasks > 0
    ? Math.round((stats.doneTasks / stats.totalTasks) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Overview stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total de Tarefas" value={stats.totalTasks} desc="Em todos os quadros" icon={ClipboardList} color="text-primary" delay={0} />
        <StatCard label="Concluídas" value={stats.doneTasks} desc={`${teamProductivityPct}% produtividade`} icon={CheckCircle2} color="text-success" delay={80} />
        <StatCard label="Atrasadas" value={stats.overdueTasks} desc={stats.overdueTasks > 0 ? "Atenção necessária" : "Tudo em dia!"} icon={AlertTriangle} color="text-destructive" delay={160} />
        <StatCard label="Usuários Ativos" value={mostActiveUsers.length} desc="Últimos 7 dias" icon={Users} color="text-blue-600" delay={240} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Weekly productivity chart */}
        <div className="card-premium p-6 animate-fade-in" style={{ animationDelay: "300ms" }}>
          <div className="flex items-center gap-2 mb-5">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm">Produtividade da Semana</p>
              <p className="text-xs text-muted-foreground">Atividades registradas por dia</p>
            </div>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekChartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="day" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                  labelFormatter={(label) => `${label}`}
                  formatter={(value: number) => [`${value} atividades`, "Atividades"]}
                />
                <Bar dataKey="atividades" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Most active users */}
        <div className="card-premium animate-fade-in" style={{ animationDelay: "350ms" }}>
          <div className="p-5 pb-3">
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-500" />
              <h3 className="font-semibold text-sm">Usuários Mais Ativos</h3>
              <Badge variant="secondary" className="ml-auto text-[10px] rounded-lg">7 dias</Badge>
            </div>
          </div>
          <div className="px-5 pb-5 space-y-2">
            {mostActiveUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma atividade registrada</p>
            ) : (
              mostActiveUsers.map((user, i) => (
                <div
                  key={user.userId}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border transition-all hover:shadow-sm animate-fade-in"
                  style={{ animationDelay: `${(i + 1) * 60}ms` }}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold",
                    i === 0 ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600" :
                    i === 1 ? "bg-slate-100 dark:bg-slate-800/50 text-slate-600" :
                    "bg-muted text-muted-foreground"
                  )}>
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}º`}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.name}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5 text-primary" />
                    <span className="text-sm font-bold text-primary">{user.count}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* System alerts */}
      {alerts.length > 0 && (
        <div className="card-premium animate-fade-in" style={{ animationDelay: "400ms" }}>
          <div className="p-5 pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <h3 className="font-semibold text-sm">Alertas do Sistema</h3>
            </div>
          </div>
          <div className="px-5 pb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {alerts.map((alert) => (
              <div
                key={alert.type}
                className={cn(
                  "flex items-center gap-3 p-4 rounded-xl border transition-all",
                  alert.color === "text-destructive" ? "border-destructive/20 bg-destructive/5" :
                  alert.color === "text-warning" ? "border-amber-500/20 bg-amber-500/5" :
                  "border-blue-500/20 bg-blue-500/5"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  alert.color === "text-destructive" ? "bg-destructive/10" :
                  alert.color === "text-warning" ? "bg-amber-500/10" :
                  "bg-blue-500/10"
                )}>
                  {alert.type === "overdue" && <AlertTriangle className={cn("h-5 w-5", alert.color)} />}
                  {alert.type === "purchases" && <ShoppingCart className={cn("h-5 w-5", alert.color)} />}
                  {alert.type === "maintenance" && <Wrench className={cn("h-5 w-5", alert.color)} />}
                </div>
                <div>
                  <p className={cn("text-2xl font-extrabold", alert.color)}>{alert.count}</p>
                  <p className="text-xs text-muted-foreground">{alert.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Company activity feed */}
      {recentActivities && recentActivities.length > 0 && (
        <div className="card-premium animate-fade-in" style={{ animationDelay: "450ms" }}>
          <div className="p-5 pb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Atividade da Empresa</h3>
            </div>
          </div>
          <div className="px-5 pb-5 space-y-1">
            {recentActivities.map((act: any, i: number) => (
              <div
                key={act.id}
                className="flex items-start gap-3 py-2.5 border-b border-border/50 last:border-0 animate-fade-in"
                style={{ animationDelay: `${(i + 1) * 60}ms` }}
              >
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-primary">
                    {(act.user_name as string).charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-semibold">{act.user_name}</span>{" "}
                    <span className="text-muted-foreground">{act.action.toLowerCase()}</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(act.created_at).toLocaleString("pt-BR", {
                      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
