import { useMemo, useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useBoards } from "@/hooks/useBoards";
import { useRecurringTaskBoards, isTaskActiveToday } from "@/hooks/useRecurringTasks";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StatCard, GradientProgressBar, DashboardSkeleton } from "./DashboardComponents";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ClipboardList, Play, CheckCircle2, AlertTriangle,
  Clock, Zap, Activity, CalendarCheck, Target,
} from "lucide-react";
import { isPast, startOfDay, startOfWeek, startOfMonth, format as formatDate, isToday } from "date-fns";

export default function MemberDashboard() {
  const { user } = useAuth();
  const { boards, isLoading: boardsLoading } = useBoards();

  // ── Personal Kanban Stats ──
  const taskStats = useMemo(() => {
    if (!boards || !user) return { total: 0, inProgress: 0, done: 0, overdue: 0, tasks: [] };
    const allTasks: any[] = [];
    boards.forEach((board: any) => {
      board.board_columns?.forEach((col: any) => {
        col.tasks?.forEach((task: any) => {
          if (task.assignee_id === user.id) {
            allTasks.push({ ...task, columnName: col.name, boardName: board.name });
          }
        });
      });
    });
    const total = allTasks.length;
    const done = allTasks.filter((t) => {
      const cn = t.columnName?.toLowerCase();
      return cn?.includes("concluí") || cn?.includes("done") || cn?.includes("concluido");
    }).length;
    const inProgress = allTasks.filter((t) => {
      const cn = t.columnName?.toLowerCase();
      return cn?.includes("andamento") || cn?.includes("progress");
    }).length;
    const overdue = allTasks.filter((t) => {
      if (!t.due_date) return false;
      const cn = t.columnName?.toLowerCase();
      const isDone = cn?.includes("concluí") || cn?.includes("done") || cn?.includes("concluido");
      return !isDone && isPast(new Date(t.due_date));
    }).length;
    return { total, inProgress, done, overdue, tasks: allTasks };
  }, [boards, user]);

  const overdueTasks = useMemo(() => taskStats.tasks.filter((t) => {
    if (!t.due_date) return false;
    const cn = t.columnName?.toLowerCase();
    const isDone = cn?.includes("concluí") || cn?.includes("done") || cn?.includes("concluido");
    return !isDone && isPast(new Date(t.due_date));
  }), [taskStats.tasks]);

  const todayTasks = useMemo(() => taskStats.tasks.filter((t) => {
    if (!t.due_date) return false;
    return isToday(new Date(t.due_date));
  }), [taskStats.tasks]);

  // ── Recurring Tasks Stats ──
  const { boards: recurringBoards, isLoading: recurringLoading } = useRecurringTaskBoards();
  const [recurringTasks, setRecurringTasks] = useState<any[]>([]);
  const [recurringCompletions, setRecurringCompletions] = useState<any[]>([]);
  const [recurringFetching, setRecurringFetching] = useState(true);

  useEffect(() => {
    if (recurringLoading || !recurringBoards.length) { setRecurringFetching(recurringLoading); return; }
    const fetchAll = async () => {
      setRecurringFetching(true);
      const boardIds = recurringBoards.map((b) => b.id);
      const { data: tasks } = await supabase.from("recurring_tasks").select("*").in("board_id", boardIds);
      const taskIds = (tasks || []).map((t: any) => t.id);
      let completions: any[] = [];
      if (taskIds.length > 0) {
        const { data } = await supabase.from("recurring_task_completions").select("*").in("recurring_task_id", taskIds);
        completions = data || [];
      }
      setRecurringTasks(tasks || []);
      setRecurringCompletions(completions);
      setRecurringFetching(false);
    };
    fetchAll();
  }, [recurringBoards, recurringLoading]);

  const recurringStats = useMemo(() => {
    const activeTasks = recurringTasks.filter((t: any) => isTaskActiveToday(t as any));
    const completedToday = activeTasks.filter((task: any) => {
      const now = new Date();
      let periodStart: string;
      switch (task.frequency) {
        case "daily": case "weekday": periodStart = formatDate(startOfDay(now), "yyyy-MM-dd"); break;
        case "weekly": periodStart = formatDate(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"); break;
        case "monthly": periodStart = formatDate(startOfMonth(now), "yyyy-MM-dd"); break;
        default: periodStart = formatDate(startOfDay(now), "yyyy-MM-dd");
      }
      return recurringCompletions.some((c: any) => c.recurring_task_id === task.id && c.period_start === periodStart);
    });
    return {
      activeToday: activeTasks.length,
      completedToday: completedToday.length,
      pendingToday: activeTasks.length - completedToday.length,
    };
  }, [recurringTasks, recurringCompletions]);

  // ── My recent activities ──
  const { data: myActivities } = useQuery({
    queryKey: ["member-dashboard-my-activities", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("activity_log")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(6);
      return data || [];
    },
    enabled: !!user,
  });

  const isLoading = boardsLoading;
  if (isLoading) return <DashboardSkeleton />;

  // ── Combined productivity score ──
  const totalPersonalTasks = taskStats.total + recurringStats.activeToday;
  const totalDone = taskStats.done + recurringStats.completedToday;
  const productivityPct = totalPersonalTasks > 0 ? Math.round((totalDone / totalPersonalTasks) * 100) : 0;

  const cards = [
    { label: "Minhas Tarefas", value: taskStats.total, desc: "Atribuídas a você", icon: ClipboardList, color: "text-primary" },
    { label: "Em Andamento", value: taskStats.inProgress, desc: "Em progresso agora", icon: Play, color: "text-blue-600" },
    { label: "Concluídas", value: taskStats.done, desc: "Finalizadas com sucesso", icon: CheckCircle2, color: "text-success" },
    { label: "Atrasadas", value: taskStats.overdue, desc: taskStats.overdue > 0 ? "Precisam de atenção" : "Tudo em dia!", icon: AlertTriangle, color: "text-destructive" },
  ];

  return (
    <div className="space-y-5">
      {/* Productivity score */}
      <GradientProgressBar
        pct={productivityPct}
        label="Meu Score de Produtividade"
        sublabel={`${totalDone} de ${totalPersonalTasks} tarefas concluídas`}
        icon={Zap}
      />

      {/* Daily progress (recurring) */}
      {recurringStats.activeToday > 0 && (
        <GradientProgressBar
          pct={recurringStats.activeToday > 0 ? Math.round((recurringStats.completedToday / recurringStats.activeToday) * 100) : 0}
          label="Progresso do Dia"
          sublabel={`${recurringStats.completedToday} de ${recurringStats.activeToday} tarefas fixas concluídas`}
          icon={Target}
        />
      )}

      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card, i) => (
          <StatCard key={card.label} {...card} delay={i * 80} />
        ))}
      </div>

      {/* Overdue tasks */}
      {overdueTasks.length > 0 && (
        <div className="card-premium animate-fade-in" style={{ animationDelay: "300ms" }}>
          <div className="p-5 pb-3">
            <h3 className="font-semibold text-sm text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Minhas Tarefas Atrasadas
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

      {/* Today's tasks */}
      {todayTasks.length > 0 && (
        <div className="card-premium animate-fade-in" style={{ animationDelay: "350ms" }}>
          <div className="p-5 pb-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-primary" />
              Minhas Tarefas de Hoje
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

      {/* Upcoming tasks (next tasks with due date) */}
      {(() => {
        const upcoming = taskStats.tasks
          .filter((t) => {
            if (!t.due_date) return false;
            const cn = t.columnName?.toLowerCase();
            const isDone = cn?.includes("concluí") || cn?.includes("done") || cn?.includes("concluido");
            return !isDone && !isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date));
          })
          .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
          .slice(0, 5);

        if (upcoming.length === 0) return null;
        return (
          <div className="card-premium animate-fade-in" style={{ animationDelay: "380ms" }}>
            <div className="p-5 pb-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-600" />
                Próximas Tarefas
              </h3>
            </div>
            <div className="px-5 pb-5 space-y-2">
              {upcoming.map((task) => (
                <div key={task.id} className="flex items-center justify-between rounded-xl p-3 border border-border transition-all hover:shadow-sm">
                  <div>
                    <p className="text-sm font-medium">{task.title}</p>
                    <p className="text-xs text-muted-foreground">{task.boardName}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] rounded-lg">
                    {new Date(task.due_date).toLocaleDateString("pt-BR")}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* My recent activities */}
      {myActivities && myActivities.length > 0 && (
        <div className="card-premium animate-fade-in" style={{ animationDelay: "400ms" }}>
          <div className="p-5 pb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Minhas Atividades Recentes</h3>
            </div>
          </div>
          <div className="px-5 pb-5 space-y-1">
            {myActivities.map((act: any, i: number) => (
              <div
                key={act.id}
                className="flex items-start gap-3 py-2.5 border-b border-border/50 last:border-0 animate-fade-in"
                style={{ animationDelay: `${(i + 1) * 60}ms` }}
              >
                <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-muted-foreground">{act.action}</p>
                  <p className="text-[11px] text-muted-foreground/70">
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

      {taskStats.total === 0 && recurringStats.activeToday === 0 && (
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
