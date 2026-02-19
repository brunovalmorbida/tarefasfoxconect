import { useAuth } from "@/hooks/useAuth";
import { useBoards } from "@/hooks/useBoards";
import { useRecurringTaskBoards, isTaskActiveToday } from "@/hooks/useRecurringTasks";
import { usePurchases } from "@/hooks/usePurchases";
import { useMemo, useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import {
  ClipboardList, Play, CheckCircle2, AlertTriangle, RefreshCw,
  ShoppingCart, Package, Clock, LayoutGrid, TrendingUp, Target, Zap,
  Activity, ArrowRight, Flame, CalendarCheck,
} from "lucide-react";
import { isPast, startOfDay, startOfWeek, startOfMonth, format as formatDate, isToday } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

// ── Premium Stat Card ──
function StatCard({ label, value, desc, icon: Icon, color, delay = 0 }: {
  label: string; value: number | string; desc?: string; icon: any; color: string; delay?: number;
}) {
  return (
    <div className="card-premium p-5 animate-fade-in group" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">{label}</p>
          <p className={cn("text-3xl font-extrabold tracking-tight", color)}>{value}</p>
          {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
        </div>
        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center transition-transform duration-200 group-hover:scale-110", 
          color === "text-primary" ? "bg-primary/10" :
          color === "text-blue-600" ? "bg-blue-100 dark:bg-blue-900/30" :
          color === "text-success" ? "bg-green-100 dark:bg-green-900/30" :
          color === "text-destructive" ? "bg-red-100 dark:bg-red-900/30" :
          color === "text-warning" ? "bg-amber-100 dark:bg-amber-900/30" :
          "bg-muted"
        )}>
          <Icon className={cn("h-5 w-5", color)} />
        </div>
      </div>
    </div>
  );
}

// ── Gradient Progress Bar ──
function GradientProgressBar({ pct, label, sublabel, icon: Icon }: {
  pct: number; label: string; sublabel: string; icon: any;
}) {
  const barColor = pct >= 70 ? "from-emerald-500 to-cyan-500" :
    pct >= 40 ? "from-amber-400 to-yellow-500" : "from-red-400 to-rose-500";
  const textColor = pct >= 70 ? "text-success" : pct >= 40 ? "text-warning" : "text-destructive";

  return (
    <div className="card-premium p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm">{label}</p>
            <p className="text-xs text-muted-foreground">{sublabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pct === 100 && <Flame className="h-5 w-5 text-amber-500 animate-pulse" />}
          <span className={cn("text-3xl font-extrabold tracking-tight", textColor)}>
            {pct}%
          </span>
        </div>
      </div>
      <div className="w-full h-3 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-1000 ease-out", barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Skeleton Loader ──
function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-2">
        <div className="h-8 w-64 rounded-lg skeleton-loading" />
        <div className="h-4 w-48 rounded-lg skeleton-loading" />
      </div>
      <div className="h-28 rounded-xl skeleton-loading" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-28 rounded-xl skeleton-loading" />)}
      </div>
      <div className="h-40 rounded-xl skeleton-loading" />
    </div>
  );
}

// ── Activity Feed ──
function ActivityFeed() {
  const { data: activities, isLoading } = useQuery({
    queryKey: ["dashboard-activities"],
    queryFn: async () => {
      const { data: logs } = await supabase
        .from("activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(6);
      if (!logs || logs.length === 0) return [];

      const userIds = [...new Set(logs.map((l: any) => l.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name")
        .in("user_id", userIds);
      const profileMap = new Map(profiles?.map((p) => [p.user_id, p.name]) || []);

      return logs.map((l: any) => ({
        ...l,
        user_name: profileMap.get(l.user_id) || "Usuário",
      }));
    },
  });

  if (isLoading) return null;
  if (!activities || activities.length === 0) return null;

  return (
    <div className="card-premium animate-fade-in" style={{ animationDelay: "400ms" }}>
      <div className="p-5 pb-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Últimas Atividades</h3>
        </div>
      </div>
      <div className="px-5 pb-5 space-y-1">
        {activities.map((act: any, i: number) => (
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
  );
}

// ── Kanban Section ──
function KanbanDashboard({ boards, user }: { boards: any[]; user: any }) {
  const stats = useMemo(() => {
    if (!boards || boards.length === 0) return { total: 0, inProgress: 0, done: 0, overdue: 0, tasks: [] };
    const allTasks: any[] = [];
    boards.forEach((board: any) => {
      board.board_columns?.forEach((col: any) => {
        col.tasks?.forEach((task: any) => {
          if (task.assignee_id === user?.id) {
            allTasks.push({ ...task, columnName: col.name, boardName: board.name });
          }
        });
      });
    });
    const total = allTasks.length;
    const done = allTasks.filter((t) => { const cn = t.columnName?.toLowerCase(); return cn?.includes("concluí") || cn?.includes("done") || cn?.includes("concluido"); }).length;
    const inProgress = allTasks.filter((t) => { const cn = t.columnName?.toLowerCase(); return cn?.includes("andamento") || cn?.includes("progress"); }).length;
    const overdue = allTasks.filter((t) => { if (!t.due_date) return false; const cn = t.columnName?.toLowerCase(); const isDone = cn?.includes("concluí") || cn?.includes("done") || cn?.includes("concluido"); return !isDone && isPast(new Date(t.due_date)); }).length;
    return { total, inProgress, done, overdue, tasks: allTasks };
  }, [boards, user]);

  const overdueTasks = useMemo(() => stats.tasks.filter((t) => { if (!t.due_date) return false; const cn = t.columnName?.toLowerCase(); const isDone = cn?.includes("concluí") || cn?.includes("done") || cn?.includes("concluido"); return !isDone && isPast(new Date(t.due_date)); }), [stats.tasks]);

  const todayTasks = useMemo(() => stats.tasks.filter((t) => {
    if (!t.due_date) return false;
    return isToday(new Date(t.due_date));
  }), [stats.tasks]);

  const weekPct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

  const cards = [
    { label: "Total de tarefas", value: stats.total, desc: "Tarefas no seu quadro ativo", icon: ClipboardList, color: "text-primary" },
    { label: "Em andamento", value: stats.inProgress, desc: "Em progresso agora", icon: Play, color: "text-blue-600" },
    { label: "Concluídas", value: stats.done, desc: "Finalizadas com sucesso", icon: CheckCircle2, color: "text-success" },
    { label: "Atrasadas", value: stats.overdue, desc: stats.overdue > 0 ? "Precisam de atenção" : "Tudo em dia!", icon: AlertTriangle, color: "text-destructive" },
  ];

  return (
    <div className="space-y-5">
      {stats.total > 0 && (
        <GradientProgressBar
          pct={weekPct}
          label="Score de Produtividade"
          sublabel={`${stats.done} de ${stats.total} tarefas concluídas`}
          icon={Zap}
        />
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card, i) => (
          <StatCard key={card.label} {...card} delay={i * 80} />
        ))}
      </div>

      {overdueTasks.length > 0 && (
        <div className="card-premium animate-fade-in" style={{ animationDelay: "300ms" }}>
          <div className="p-5 pb-3">
            <h3 className="font-semibold text-sm text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Tarefas Atrasadas
            </h3>
          </div>
          <div className="px-5 pb-5 space-y-2">
            {overdueTasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between rounded-xl border border-destructive/20 bg-destructive/5 p-3 transition-all hover:shadow-sm">
                <div>
                  <p className="text-sm font-medium">{task.title}</p>
                  <p className="text-xs text-muted-foreground">{task.boardName} — {task.columnName}</p>
                </div>
                <Badge variant="destructive" className="text-xs rounded-lg">
                  {new Date(task.due_date).toLocaleDateString("pt-BR")}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Próximas tarefas de hoje */}
      {todayTasks.length > 0 && (
        <div className="card-premium animate-fade-in" style={{ animationDelay: "350ms" }}>
          <div className="p-5 pb-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-primary" />
              Tarefas para Hoje
            </h3>
          </div>
          <div className="px-5 pb-5 space-y-2">
            {todayTasks.slice(0, 5).map((task) => {
              const colLower = task.columnName?.toLowerCase();
              const isDone = colLower?.includes("concluí") || colLower?.includes("done") || colLower?.includes("concluido");
              return (
                <div key={task.id} className={cn(
                  "flex items-center justify-between rounded-xl p-3 border transition-all hover:shadow-sm",
                  isDone ? "opacity-60 border-success/20 bg-success/5" : "border-border"
                )}>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className={cn("h-4 w-4", isDone ? "text-success" : "text-muted-foreground/40")} />
                    <div>
                      <p className={cn("text-sm font-medium", isDone && "line-through")}>{task.title}</p>
                      <p className="text-xs text-muted-foreground">{task.boardName}</p>
                    </div>
                  </div>
                  <Badge variant={isDone ? "default" : "secondary"} className="text-[10px] rounded-lg">
                    {task.columnName}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <ActivityFeed />

      {stats.total === 0 && (
        <div className="text-center py-16 animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <ClipboardList className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="font-medium text-muted-foreground">Nenhuma tarefa atribuída a você</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Quando tarefas forem atribuídas, aparecerão aqui.</p>
        </div>
      )}
    </div>
  );
}

// ── Recurring Tasks Section ──
function RecurringTasksDashboard({ user }: { user: any }) {
  const { boards, isLoading: boardsLoading } = useRecurringTaskBoards();
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [allCompletions, setAllCompletions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (boardsLoading || !boards.length) { setLoading(boardsLoading); return; }
    const fetchAll = async () => {
      setLoading(true);
      const boardIds = boards.map((b) => b.id);
      const { data: tasks } = await supabase.from("recurring_tasks").select("*").in("board_id", boardIds);
      const taskIds = (tasks || []).map((t: any) => t.id);
      let completions: any[] = [];
      if (taskIds.length > 0) { const { data } = await supabase.from("recurring_task_completions").select("*").in("recurring_task_id", taskIds); completions = data || []; }
      setAllTasks(tasks || []); setAllCompletions(completions); setLoading(false);
    };
    fetchAll();
  }, [boards, boardsLoading]);

  const stats = useMemo(() => {
    const activeTasks = allTasks.filter((t: any) => isTaskActiveToday(t as any));
    const completedToday = activeTasks.filter((task: any) => {
      const now = new Date();
      let periodStart: string;
      switch (task.frequency) {
        case "daily": case "weekday": periodStart = formatDate(startOfDay(now), "yyyy-MM-dd"); break;
        case "weekly": periodStart = formatDate(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"); break;
        case "monthly": periodStart = formatDate(startOfMonth(now), "yyyy-MM-dd"); break;
        default: periodStart = formatDate(startOfDay(now), "yyyy-MM-dd");
      }
      return allCompletions.some((c: any) => c.recurring_task_id === task.id && c.period_start === periodStart);
    });
    const pendingTasks = activeTasks.filter((task: any) => {
      const now = new Date();
      let periodStart: string;
      switch (task.frequency) {
        case "daily": case "weekday": periodStart = formatDate(startOfDay(now), "yyyy-MM-dd"); break;
        case "weekly": periodStart = formatDate(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"); break;
        case "monthly": periodStart = formatDate(startOfMonth(now), "yyyy-MM-dd"); break;
        default: periodStart = formatDate(startOfDay(now), "yyyy-MM-dd");
      }
      return !allCompletions.some((c: any) => c.recurring_task_id === task.id && c.period_start === periodStart);
    });
    return {
      totalBoards: boards.length,
      totalTasks: allTasks.length,
      activeToday: activeTasks.length,
      completedToday: completedToday.length,
      pendingToday: activeTasks.length - completedToday.length,
      pendingTasks,
      completedTasks: completedToday,
    };
  }, [allTasks, allCompletions, boards]);

  if (loading) return <DashboardSkeleton />;

  const todayPct = stats.activeToday > 0 ? Math.round((stats.completedToday / stats.activeToday) * 100) : 0;

  const cards = [
    { label: "Quadros", value: stats.totalBoards, desc: "Quadros de tarefas fixas", icon: LayoutGrid, color: "text-primary" },
    { label: "Total de tarefas", value: stats.totalTasks, desc: "Cadastradas no sistema", icon: RefreshCw, color: "text-blue-600" },
    { label: "Ativas hoje", value: stats.activeToday, desc: "Programadas para hoje", icon: Clock, color: "text-warning" },
    { label: "Concluídas hoje", value: stats.completedToday, desc: todayPct === 100 ? "Tudo feito! 🔥" : "Continue assim!", icon: CheckCircle2, color: "text-success" },
  ];

  return (
    <div className="space-y-5">
      {stats.activeToday > 0 && (
        <GradientProgressBar
          pct={todayPct}
          label="Progresso de Hoje"
          sublabel={`${stats.completedToday} de ${stats.activeToday} tarefas concluídas hoje`}
          icon={Target}
        />
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card, i) => (
          <StatCard key={card.label} {...card} delay={i * 80} />
        ))}
      </div>

      {/* Próximas tarefas pendentes do dia */}
      {stats.pendingTasks.length > 0 && (
        <div className="card-premium animate-fade-in" style={{ animationDelay: "300ms" }}>
          <div className="p-5 pb-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-warning" />
              Próximas Tarefas do Dia
              <Badge variant="secondary" className="rounded-lg ml-auto text-[10px]">
                {stats.pendingTasks.length} pendente{stats.pendingTasks.length !== 1 ? "s" : ""}
              </Badge>
            </h3>
          </div>
          <div className="px-5 pb-5 space-y-2">
            {stats.pendingTasks.slice(0, 5).map((task: any, i: number) => (
              <div
                key={task.id}
                className="flex items-center gap-3 rounded-xl p-3 border border-border transition-all hover:shadow-sm animate-fade-in"
                style={{ animationDelay: `${(i + 1) * 60}ms` }}
              >
                <div className="w-2 h-2 rounded-full bg-warning flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{task.title}</p>
                  {task.description && (
                    <p className="text-xs text-muted-foreground truncate">{task.description}</p>
                  )}
                </div>
                <Badge variant="outline" className="text-[10px] rounded-lg capitalize flex-shrink-0">
                  {task.frequency === "daily" ? "Diária" : task.frequency === "weekly" ? "Semanal" : task.frequency === "weekday" ? "Dia útil" : "Mensal"}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats.totalTasks === 0 && (
        <div className="text-center py-16 animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <RefreshCw className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="font-medium text-muted-foreground">Nenhuma tarefa fixa cadastrada</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Crie tarefas fixas para organizar sua rotina diária.</p>
        </div>
      )}
    </div>
  );
}

// ── Purchases Section ──
function PurchasesDashboard() {
  const { purchases, isLoading } = usePurchases();
  const navigate = useNavigate();

  const stats = useMemo(() => {
    const pending = purchases.filter((p) => p.status === "pending").length;
    const purchased = purchases.filter((p) => p.status === "purchased").length;
    const received = purchases.filter((p) => p.status === "received").length;
    const allItems = purchases.flatMap((p) => p.items);
    const itemsPending = allItems.filter((i) => i.status === "pending").length;
    const itemsPurchased = allItems.filter((i) => i.status === "purchased").length;
    const itemsReceived = allItems.filter((i) => i.status === "received").length;
    const totalEstimated = purchases.reduce((acc, p) => acc + p.items.reduce((sum, item) => sum + (item.estimated_value || 0) * item.quantity, 0), 0);
    const totalActual = purchases.reduce((acc, p) => acc + p.items.reduce((sum, item) => sum + (item.actual_value || 0) * item.quantity, 0), 0);
    return { total: purchases.length, pending, purchased, received, itemsPending, itemsPurchased, itemsReceived, totalEstimated, totalActual };
  }, [purchases]);

  if (isLoading) return <DashboardSkeleton />;

  const cards = [
    { label: "Total de listas", value: stats.total, desc: "Listas de compras criadas", icon: ClipboardList, color: "text-primary" },
    { label: "Itens pendentes", value: stats.itemsPending, desc: "Aguardando compra", icon: Clock, color: "text-warning" },
    { label: "Itens comprados", value: stats.itemsPurchased, desc: "Comprados com sucesso", icon: ShoppingCart, color: "text-blue-600" },
    { label: "Itens recebidos", value: stats.itemsReceived, desc: "Recebidos no destino", icon: Package, color: "text-success" },
  ];

  return (
    <div className="space-y-5">
      {stats.total > 0 ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {cards.map((card, i) => (
              <StatCard key={card.label} {...card} delay={i * 80} />
            ))}
          </div>

          {(stats.totalEstimated > 0 || stats.totalActual > 0) && (
            <div className="card-premium p-6 animate-fade-in" style={{ animationDelay: "300ms" }}>
              <div className="flex items-center gap-2 mb-5">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Resumo Financeiro</p>
                  <p className="text-xs text-muted-foreground">Valores consolidados de todas as listas</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="p-4 rounded-xl bg-muted/50">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Estimado</p>
                  <p className="text-2xl font-extrabold mt-1">{stats.totalEstimated.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
                </div>
                <div className="p-4 rounded-xl bg-success/5 border border-success/10">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Valor Real</p>
                  <p className="text-2xl font-extrabold text-success mt-1">{stats.totalActual.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
                </div>
              </div>
              {stats.totalEstimated > 0 && stats.totalActual > 0 && (
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                    <span>Execução do orçamento</span>
                    <span className="font-semibold">{Math.round((stats.totalActual / stats.totalEstimated) * 100)}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-1000"
                      style={{ width: `${Math.min(100, Math.round((stats.totalActual / stats.totalEstimated) * 100))}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Recent purchases */}
          {purchases.filter(p => p.status === "pending").length > 0 && (
            <div className="card-premium animate-fade-in" style={{ animationDelay: "350ms" }}>
              <div className="p-5 pb-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4 text-warning" />
                  Listas Pendentes
                </h3>
              </div>
              <div className="px-5 pb-5 space-y-2">
                {purchases.filter(p => p.status === "pending").slice(0, 4).map((list, i) => (
                  <div
                    key={list.id}
                    className="flex items-center justify-between rounded-xl p-3 border border-border transition-all hover:shadow-sm animate-fade-in"
                    style={{ animationDelay: `${(i + 1) * 60}ms` }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-warning flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium">{list.title}</p>
                        <p className="text-xs text-muted-foreground">{list.items.length} ite{list.items.length !== 1 ? "ns" : "m"} • {list.requester_name}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] rounded-lg capitalize">
                      {list.urgency === "urgent" ? "Urgente" : list.urgency === "high" ? "Alta" : list.urgency === "medium" ? "Média" : "Baixa"}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-20 animate-fade-in">
          <div className="w-20 h-20 rounded-3xl bg-muted flex items-center justify-center mx-auto mb-5">
            <ShoppingCart className="h-10 w-10 text-muted-foreground" />
          </div>
          <p className="font-semibold text-lg text-foreground">Nenhuma lista de compras ainda</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            Crie sua primeira lista de compras para gerenciar pedidos, acompanhar valores e recebimentos.
          </p>
          <Button className="mt-5 gap-2" onClick={() => navigate("/purchases")}>
            Criar primeira lista
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard ──
export default function Dashboard() {
  const { user } = useAuth();
  const { boards, isLoading } = useBoards();

  if (isLoading) return <DashboardSkeleton />;

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
        <p className="text-sm text-muted-foreground mt-1">Aqui está o resumo da sua produtividade</p>
      </div>

      <Tabs defaultValue="kanban" className="space-y-5">
        <TabsList className="bg-muted/60 p-1 rounded-xl">
          <TabsTrigger value="kanban" className="gap-2 rounded-lg data-[state=active]:shadow-sm transition-all">
            <LayoutGrid className="h-4 w-4" />
            Quadros Kanban
          </TabsTrigger>
          <TabsTrigger value="recurring" className="gap-2 rounded-lg data-[state=active]:shadow-sm transition-all">
            <RefreshCw className="h-4 w-4" />
            Tarefas Fixas
          </TabsTrigger>
          <TabsTrigger value="purchases" className="gap-2 rounded-lg data-[state=active]:shadow-sm transition-all">
            <ShoppingCart className="h-4 w-4" />
            Compras
          </TabsTrigger>
        </TabsList>

        <TabsContent value="kanban" className="animate-fade-in">
          <KanbanDashboard boards={boards} user={user} />
        </TabsContent>
        <TabsContent value="recurring" className="animate-fade-in">
          <RecurringTasksDashboard user={user} />
        </TabsContent>
        <TabsContent value="purchases" className="animate-fade-in">
          <PurchasesDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
