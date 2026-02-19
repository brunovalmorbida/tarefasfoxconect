import { useAuth } from "@/hooks/useAuth";
import { useBoards } from "@/hooks/useBoards";
import { useRecurringTaskBoards, useRecurringTasks, isTaskActiveToday } from "@/hooks/useRecurringTasks";
import { usePurchases } from "@/hooks/usePurchases";
import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ClipboardList,
  Play,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ShoppingCart,
  Package,
  Clock,
  LayoutGrid,
} from "lucide-react";
import { isPast, startOfDay, startOfWeek, startOfMonth, format as formatDate } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

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
    const done = allTasks.filter((t) => {
      const colName = t.columnName?.toLowerCase();
      return colName?.includes("concluí") || colName?.includes("done") || colName?.includes("concluido");
    }).length;
    const inProgress = allTasks.filter((t) => {
      const colName = t.columnName?.toLowerCase();
      return colName?.includes("andamento") || colName?.includes("progress");
    }).length;
    const overdue = allTasks.filter((t) => {
      if (!t.due_date) return false;
      const colName = t.columnName?.toLowerCase();
      const isDone = colName?.includes("concluí") || colName?.includes("done") || colName?.includes("concluido");
      return !isDone && isPast(new Date(t.due_date));
    }).length;

    return { total, inProgress, done, overdue, tasks: allTasks };
  }, [boards, user]);

  const overdueTasks = useMemo(() => {
    return stats.tasks.filter((t) => {
      if (!t.due_date) return false;
      const colName = t.columnName?.toLowerCase();
      const isDone = colName?.includes("concluí") || colName?.includes("done") || colName?.includes("concluido");
      return !isDone && isPast(new Date(t.due_date));
    });
  }, [stats.tasks]);

  const cards = [
    { label: "Total de tarefas", value: stats.total, icon: ClipboardList, color: "text-primary" },
    { label: "Em andamento", value: stats.inProgress, icon: Play, color: "text-blue-600" },
    { label: "Concluídas", value: stats.done, icon: CheckCircle2, color: "text-green-600" },
    { label: "Atrasadas", value: stats.overdue, icon: AlertTriangle, color: "text-destructive" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                  <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
                </div>
                <card.icon className={`h-8 w-8 ${card.color} opacity-40`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {overdueTasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Tarefas Atrasadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {overdueTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="font-medium">{task.title}</p>
                    <p className="text-xs text-muted-foreground">{task.boardName} — {task.columnName}</p>
                  </div>
                  <Badge variant="destructive" className="text-xs">
                    Prazo: {new Date(task.due_date).toLocaleDateString("pt-BR")}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {stats.total === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">Nenhuma tarefa atribuída a você.</p>
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
    if (boardsLoading || !boards.length) {
      setLoading(boardsLoading);
      return;
    }

    const fetchAll = async () => {
      setLoading(true);
      const boardIds = boards.map((b) => b.id);
      const { data: tasks } = await supabase
        .from("recurring_tasks")
        .select("*")
        .in("board_id", boardIds);

      const taskIds = (tasks || []).map((t: any) => t.id);
      let completions: any[] = [];
      if (taskIds.length > 0) {
        const { data } = await supabase
          .from("recurring_task_completions")
          .select("*")
          .in("recurring_task_id", taskIds);
        completions = data || [];
      }

      setAllTasks(tasks || []);
      setAllCompletions(completions);
      setLoading(false);
    };

    fetchAll();
  }, [boards, boardsLoading]);

  const stats = useMemo(() => {
    const activeTasks = allTasks.filter((t: any) => isTaskActiveToday(t as any));
    const completedToday = activeTasks.filter((task: any) => {
      const now = new Date();
      let periodStart: string;
      switch (task.frequency) {
        case "daily":
        case "weekday":
          periodStart = formatDate(startOfDay(now), "yyyy-MM-dd");
          break;
        case "weekly":
          periodStart = formatDate(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
          break;
        case "monthly":
          periodStart = formatDate(startOfMonth(now), "yyyy-MM-dd");
          break;
        default:
          periodStart = formatDate(startOfDay(now), "yyyy-MM-dd");
      }
      return allCompletions.some(
        (c: any) => c.recurring_task_id === task.id && c.period_start === periodStart
      );
    });

    return {
      totalBoards: boards.length,
      totalTasks: allTasks.length,
      activeToday: activeTasks.length,
      completedToday: completedToday.length,
      pendingToday: activeTasks.length - completedToday.length,
    };
  }, [allTasks, allCompletions, boards]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const cards = [
    { label: "Quadros", value: stats.totalBoards, icon: LayoutGrid, color: "text-primary" },
    { label: "Total de tarefas", value: stats.totalTasks, icon: RefreshCw, color: "text-blue-600" },
    { label: "Ativas hoje", value: stats.activeToday, icon: Clock, color: "text-amber-600" },
    { label: "Concluídas hoje", value: stats.completedToday, icon: CheckCircle2, color: "text-green-600" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                  <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
                </div>
                <card.icon className={`h-8 w-8 ${card.color} opacity-40`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {stats.pendingToday > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-amber-600 flex items-center gap-2">
              <Clock className="h-5 w-5" />
              {stats.pendingToday} tarefa(s) pendente(s) hoje
            </CardTitle>
          </CardHeader>
        </Card>
      )}

      {stats.totalTasks === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">Nenhuma tarefa fixa cadastrada.</p>
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
    const total = purchases.length;

    const totalEstimated = purchases.reduce((acc, p) => {
      return acc + p.items.reduce((sum, item) => sum + (item.estimated_value || 0) * item.quantity, 0);
    }, 0);

    const totalActual = purchases.reduce((acc, p) => {
      return acc + p.items.reduce((sum, item) => sum + (item.actual_value || 0) * item.quantity, 0);
    }, 0);

    return { total, pending, purchased, received, totalEstimated, totalActual };
  }, [purchases]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const cards = [
    { label: "Total de listas", value: stats.total, icon: ClipboardList, color: "text-primary" },
    { label: "Pendentes", value: stats.pending, icon: Clock, color: "text-amber-600" },
    { label: "Compradas", value: stats.purchased, icon: ShoppingCart, color: "text-blue-600" },
    { label: "Recebidas", value: stats.received, icon: Package, color: "text-green-600" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                  <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
                </div>
                <card.icon className={`h-8 w-8 ${card.color} opacity-40`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {(stats.totalEstimated > 0 || stats.totalActual > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              Valores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-6">
              <div>
                <p className="text-sm text-muted-foreground">Estimado total</p>
                <p className="text-xl font-bold">
                  {stats.totalEstimated.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Valor real total</p>
                <p className="text-xl font-bold text-green-600">
                  {stats.totalActual.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {stats.total === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">Nenhuma lista de compras cadastrada.</p>
      )}
    </div>
  );
}

// ── Main Dashboard ──
export default function Dashboard() {
  const { user } = useAuth();
  const { boards, isLoading } = useBoards();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Bem-vindo ao TaskFox</p>
      </div>

      <Tabs defaultValue="kanban" className="space-y-4">
        <TabsList>
          <TabsTrigger value="kanban" className="gap-2">
            <LayoutGrid className="h-4 w-4" />
            Quadros Kanban
          </TabsTrigger>
          <TabsTrigger value="recurring" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Tarefas Fixas
          </TabsTrigger>
          <TabsTrigger value="purchases" className="gap-2">
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
