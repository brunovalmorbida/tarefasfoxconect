import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Trash2, Plus, CalendarDays, CalendarRange, Calendar } from "lucide-react";
import { useRecurringTasks, RecurringTask } from "@/hooks/useRecurringTasks";
import { useTeams } from "@/hooks/useBoards";
import { useIsAppAdmin } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";

function TaskSection({
  title,
  icon: Icon,
  tasks,
  isCompleted,
  onToggle,
  onDelete,
  isAdmin,
}: {
  title: string;
  icon: React.ElementType;
  tasks: RecurringTask[];
  isCompleted: (t: RecurringTask) => boolean;
  onToggle: (t: RecurringTask) => void;
  onDelete: (id: string) => void;
  isAdmin: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Icon className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma tarefa cadastrada.</p>
        ) : (
          <ul className="space-y-2">
            {tasks.map((task) => {
              const completed = isCompleted(task);
              return (
                <li key={task.id} className="flex items-start gap-3 rounded-md border p-3">
                  <Checkbox
                    checked={completed}
                    onCheckedChange={() => onToggle(task)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <span className={completed ? "line-through text-muted-foreground" : ""}>
                      {task.title}
                    </span>
                    {task.description && (
                      <p className="text-xs text-muted-foreground mt-1">{task.description}</p>
                    )}
                  </div>
                  {isAdmin && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(task.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default function RecurringTasks() {
  const { data: teams } = useTeams();
  const { data: isAdmin } = useIsAppAdmin();
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const teamId = selectedTeam || teams?.[0]?.id || "";
  const {
    dailyTasks,
    weeklyTasks,
    monthlyTasks,
    isLoading,
    isTaskCompleted,
    toggleCompletion,
    createTask,
    deleteTask,
  } = useRecurringTasks(teamId);
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newFreq, setNewFreq] = useState<"daily" | "weekly" | "monthly">("daily");

  const handleCreate = async () => {
    if (!newTitle.trim() || !teamId) return;
    try {
      await createTask.mutateAsync({ title: newTitle.trim(), description: newDesc.trim(), frequency: newFreq, teamId });
      setNewTitle("");
      setNewDesc("");
      setDialogOpen(false);
      toast({ title: "Tarefa criada com sucesso" });
    } catch {
      toast({ title: "Erro ao criar tarefa", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTask.mutateAsync(id);
      toast({ title: "Tarefa removida" });
    } catch {
      toast({ title: "Erro ao remover tarefa", variant: "destructive" });
    }
  };

  const handleToggle = (task: RecurringTask) => {
    toggleCompletion.mutate(task);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tarefas Fixas</h1>
          <p className="text-muted-foreground">Tarefas recorrentes com reset automático</p>
        </div>
        <div className="flex items-center gap-2">
          {teams && teams.length > 1 && (
            <Select value={teamId} onValueChange={setSelectedTeam}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Equipe" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {isAdmin && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" /> Nova Tarefa</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nova Tarefa Fixa</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Input placeholder="Título da tarefa" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
                  <Textarea placeholder="Descrição (opcional)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
                  <Select value={newFreq} onValueChange={(v) => setNewFreq(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Diária</SelectItem>
                      <SelectItem value="weekly">Semanal</SelectItem>
                      <SelectItem value="monthly">Mensal</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={handleCreate} disabled={!newTitle.trim() || createTask.isPending} className="w-full">
                    Criar Tarefa
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          <TaskSection title="Diárias" icon={CalendarDays} tasks={dailyTasks} isCompleted={isTaskCompleted} onToggle={handleToggle} onDelete={handleDelete} isAdmin={!!isAdmin} />
          <TaskSection title="Semanais" icon={CalendarRange} tasks={weeklyTasks} isCompleted={isTaskCompleted} onToggle={handleToggle} onDelete={handleDelete} isAdmin={!!isAdmin} />
          <TaskSection title="Mensais" icon={Calendar} tasks={monthlyTasks} isCompleted={isTaskCompleted} onToggle={handleToggle} onDelete={handleDelete} isAdmin={!!isAdmin} />
        </div>
      )}
    </div>
  );
}
