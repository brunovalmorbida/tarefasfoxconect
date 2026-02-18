import { useAuth } from "@/hooks/useAuth";
import { useBoards } from "@/hooks/useBoards";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Play, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { isPast } from "date-fns";

export default function Dashboard() {
  const { user } = useAuth();
  const { boards, isLoading } = useBoards();

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const cards = [
    { label: "Total de tarefas", value: stats.total, icon: ClipboardList, color: "text-primary" },
    { label: "Em andamento", value: stats.inProgress, icon: Play, color: "text-blue-600" },
    { label: "Concluídas", value: stats.done, icon: CheckCircle2, color: "text-green-600" },
    { label: "Atrasadas", value: stats.overdue, icon: AlertTriangle, color: "text-destructive" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Bem-vindo ao TaskFox</p>
      </div>

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
    </div>
  );
}
