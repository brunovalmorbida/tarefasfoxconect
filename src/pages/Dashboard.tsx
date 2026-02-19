import { useAuth } from "@/hooks/useAuth";
import { useBoards } from "@/hooks/useBoards";
import { useRecurringTaskBoards, useRecurringTasks, isTaskActiveToday } from "@/hooks/useRecurringTasks";
import { usePurchases } from "@/hooks/usePurchases";
import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ClipboardList, Play, CheckCircle2, AlertTriangle, Loader2, RefreshCw,
  ShoppingCart, Package, Clock, LayoutGrid, TrendingUp, Target, Zap,
} from "lucide-react";
import { isPast, startOfDay, startOfWeek, startOfMonth, format as formatDate } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

function StatCard({ label, value, icon: Icon, color, delay = 0 }: { label: string; value: number | string; icon: any; color: string; delay?: number }) {
  return (
    <div className="card-premium p-5 animate-fade-in" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color} bg-current/10`}>
          <Icon className="h-5 w-5" style={{ color: 'inherit' }} />
        </div>
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

  const weekPct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

  const cards = [
    { label: "Total de tarefas", value: stats.total, icon: ClipboardList, color: "text-primary" },
    { label: "Em andamento", value: stats.inProgress, icon: Play, color: "text-blue-600" },
    { label: "Concluídas", value: stats.done, icon: CheckCircle2, color: "text-success" },
    { label: "Atrasadas", value: stats.overdue, icon: AlertTriangle, color: "text-destructive" },
  ];

  return (
    <div className="space-y-5">
      {/* Score card */}
      {stats.total > 0 && (
        <div className="card-premium p-5 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              <span className="font-semibold text-sm">Score de Produtividade</span>
            </div>
            <span className={cn("text-2xl font-bold", weekPct >= 70 ? "text-success" : weekPct >= 40 ? "text-warning" : "text-destructive")}>
              {weekPct}%
            </span>
          </div>
          <div className="progress-bar h-2.5">
            <div
              className={cn("progress-bar-fill animate-progress-fill", weekPct >= 70 ? "bg-success" : weekPct >= 40 ? "bg-warning" : "bg-destructive")}
              style={{ "--progress-width": `${weekPct}%`, width: `${weekPct}%` } as any}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">{stats.done} de {stats.total} tarefas concluídas</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card, i) => (
          <StatCard key={card.label} label={card.label} value={card.value} icon={card.icon} color={card.color} delay={i * 80} />
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
              <div key={task.id} className="flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                <div>
                  <p className="text-sm font-medium">{task.title}</p>
                  <p className="text-xs text-muted-foreground">{task.boardName} — {task.columnName}</p>
                </div>
                <Badge variant="destructive" className="text-xs">
                  {new Date(task.due_date).toLocaleDateString("pt-BR")}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats.total === 0 && (
        <div className="text-center py-12 animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
            <ClipboardList className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">Nenhuma tarefa atribuída a você.</p>
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
    return { totalBoards: boards.length, totalTasks: allTasks.length, activeToday: activeTasks.length, completedToday: completedToday.length, pendingToday: activeTasks.length - completedToday.length };
  }, [allTasks, allCompletions, boards]);

  if (loading) return <div className="flex items-center justify-center py-12"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  const todayPct = stats.activeToday > 0 ? Math.round((stats.completedToday / stats.activeToday) * 100) : 0;

  const cards = [
    { label: "Quadros", value: stats.totalBoards, icon: LayoutGrid, color: "text-primary" },
    { label: "Total de tarefas", value: stats.totalTasks, icon: RefreshCw, color: "text-blue-600" },
    { label: "Ativas hoje", value: stats.activeToday, icon: Clock, color: "text-warning" },
    { label: "Concluídas hoje", value: stats.completedToday, icon: CheckCircle2, color: "text-success" },
  ];

  return (
    <div className="space-y-5">
      {/* Today progress */}
      {stats.activeToday > 0 && (
        <div className="card-premium p-5 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <span className="font-semibold text-sm">Progresso de Hoje</span>
            </div>
            <span className={cn("text-2xl font-bold", todayPct >= 70 ? "text-success" : todayPct >= 40 ? "text-warning" : "text-primary")}>
              {stats.completedToday}/{stats.activeToday}
            </span>
          </div>
          <div className="progress-bar h-2.5">
            <div
              className={cn("progress-bar-fill animate-progress-fill", todayPct >= 70 ? "bg-success" : todayPct >= 40 ? "bg-warning" : "bg-primary")}
              style={{ "--progress-width": `${todayPct}%`, width: `${todayPct}%` } as any}
            />
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card, i) => (
          <StatCard key={card.label} label={card.label} value={card.value} icon={card.icon} color={card.color} delay={i * 80} />
        ))}
      </div>

      {stats.pendingToday > 0 && (
        <div className="card-premium p-5 animate-fade-in" style={{ animationDelay: "300ms" }}>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-warning" />
            <span className="text-sm font-medium text-warning">{stats.pendingToday} tarefa(s) pendente(s) hoje</span>
          </div>
        </div>
      )}

      {stats.totalTasks === 0 && (
        <div className="text-center py-12 animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
            <RefreshCw className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">Nenhuma tarefa fixa cadastrada.</p>
        </div>
      )}
    </div>
  );
}

// ── Purchases Section ──
function PurchasesDashboard() {
  const { purchases, isLoading } = usePurchases();
  const stats = useMemo(() => {
    const pending = purchases.filter((p) => p.status === "pending").length;
    const purchased = purchases.filter((p) => p.status === "purchased").length;
    const received = purchases.filter((p) => p.status === "received").length;
    const totalEstimated = purchases.reduce((acc, p) => acc + p.items.reduce((sum, item) => sum + (item.estimated_value || 0) * item.quantity, 0), 0);
    const totalActual = purchases.reduce((acc, p) => acc + p.items.reduce((sum, item) => sum + (item.actual_value || 0) * item.quantity, 0), 0);
    return { total: purchases.length, pending, purchased, received, totalEstimated, totalActual };
  }, [purchases]);

  if (isLoading) return <div className="flex items-center justify-center py-12"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  const cards = [
    { label: "Total de listas", value: stats.total, icon: ClipboardList, color: "text-primary" },
    { label: "Pendentes", value: stats.pending, icon: Clock, color: "text-warning" },
    { label: "Compradas", value: stats.purchased, icon: ShoppingCart, color: "text-blue-600" },
    { label: "Recebidas", value: stats.received, icon: Package, color: "text-success" },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card, i) => (
          <StatCard key={card.label} label={card.label} value={card.value} icon={card.icon} color={card.color} delay={i * 80} />
        ))}
      </div>

      {(stats.totalEstimated > 0 || stats.totalActual > 0) && (
        <div className="card-premium p-5 animate-fade-in" style={{ animationDelay: "300ms" }}>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Resumo Financeiro</span>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Estimado</p>
              <p className="text-xl font-bold mt-1">{stats.totalEstimated.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Valor Real</p>
              <p className="text-xl font-bold text-success mt-1">{stats.totalActual.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
            </div>
          </div>
        </div>
      )}

      {stats.total === 0 && (
        <div className="text-center py-12 animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
            <ShoppingCart className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">Nenhuma lista de compras cadastrada.</p>
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard ──
export default function Dashboard() {
  const { user } = useAuth();
  const { boards, isLoading } = useBoards();

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Carregando dashboard...</p>
      </div>
    </div>
  );

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
        <h1 className="text-2xl font-bold tracking-tight">{greeting}, {userName} 👋</h1>
        <p className="text-sm text-muted-foreground mt-1">Aqui está o resumo da sua produtividade</p>
      </div>

      <Tabs defaultValue="kanban" className="space-y-5">
        <TabsList className="bg-muted/60 p-1 rounded-xl">
          <TabsTrigger value="kanban" className="gap-2 rounded-lg data-[state=active]:shadow-sm">
            <LayoutGrid className="h-4 w-4" />
            Quadros Kanban
          </TabsTrigger>
          <TabsTrigger value="recurring" className="gap-2 rounded-lg data-[state=active]:shadow-sm">
            <RefreshCw className="h-4 w-4" />
            Tarefas Fixas
          </TabsTrigger>
          <TabsTrigger value="purchases" className="gap-2 rounded-lg data-[state=active]:shadow-sm">
            <ShoppingCart className="h-4 w-4" />
            Compras
          </TabsTrigger>
        </TabsList>

        <TabsContent value="kanban">
          <KanbanDashboard boards={boards} user={user} />
        </TabsContent>
        <TabsContent value="recurring">
          <RecurringTasksDashboard user={user} />
        </TabsContent>
        <TabsContent value="purchases">
          <PurchasesDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}