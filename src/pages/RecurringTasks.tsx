import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Trash2, Plus, Pencil, ArrowLeft, User, CalendarDays, CalendarRange, Calendar, Clock, MoreVertical, Target, GripVertical } from "lucide-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import {
  useRecurringTaskBoards,
  useRecurringTasks,
  getWeekdayName,
  getTaskFrequencyLabel,
  isTaskActiveToday,
  RecurringTaskBoard,
  RecurringTask,
} from "@/hooks/useRecurringTasks";
import { useTeams, useTeamMembers } from "@/hooks/useBoards";
import { useCanManage } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const WEEKDAYS = [
  { value: "0", label: "Segunda" },
  { value: "1", label: "Terça" },
  { value: "2", label: "Quarta" },
  { value: "3", label: "Quinta" },
  { value: "4", label: "Sexta" },
  { value: "5", label: "Sábado" },
  { value: "6", label: "Domingo" },
];

const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}));

const freqConfig: Record<string, { icon: any; label: string; emoji: string }> = {
  daily: { icon: Clock, label: "Diária", emoji: "🔄" },
  weekly: { icon: CalendarRange, label: "Semanal", emoji: "📅" },
  weekday: { icon: CalendarDays, label: "Dia da Semana", emoji: "📆" },
  monthly: { icon: Calendar, label: "Dia do Mês", emoji: "📆" },
};

// ---- Board detail view ----
function BoardDetail({
  board, onBack, canManage, teamMembers, onUpdateBoard,
}: {
  board: RecurringTaskBoard;
  onBack: () => void;
  canManage: boolean;
  teamMembers: any[];
  onUpdateBoard: (params: { id: string; name: string; frequencyType: "weekday" | "weekly" | "monthly"; weekday: number; assignedUserId: string | null }) => Promise<void>;
}) {
  const { tasks, isLoading, isTaskCompleted, toggleCompletion, createTask, updateTask, deleteTask, reorderTasks } =
    useRecurringTasks(board.id);
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newFrequency, setNewFrequency] = useState<"daily" | "weekly" | "weekday" | "monthly">("daily");
  const [newWeekday, setNewWeekday] = useState("0");
  const [newMonthDay, setNewMonthDay] = useState("1");
  const [newScheduledTime, setNewScheduledTime] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [assignedUser, setAssignedUser] = useState(board.assigned_user_id ?? "");
  const [editingTask, setEditingTask] = useState<RecurringTask | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editFrequency, setEditFrequency] = useState<"daily" | "weekly" | "weekday" | "monthly">("daily");
  const [editWeekday, setEditWeekday] = useState("0");
  const [editMonthDay, setEditMonthDay] = useState("1");
  const [editScheduledTime, setEditScheduledTime] = useState("");

  // Progress stats
  const progressStats = useMemo(() => {
    const activeTasks = tasks.filter(t => isTaskActiveToday(t));
    const completedTasks = activeTasks.filter(t => isTaskCompleted(t));
    return {
      active: activeTasks.length,
      completed: completedTasks.length,
      pct: activeTasks.length > 0 ? Math.round((completedTasks.length / activeTasks.length) * 100) : 0,
    };
  }, [tasks, isTaskCompleted]);

  const handleSaveSettings = async () => {
    try {
      await onUpdateBoard({ id: board.id, name: board.name, frequencyType: board.frequency_type, weekday: board.weekday ?? 0, assignedUserId: assignedUser && assignedUser !== "none" ? assignedUser : null });
      setSettingsOpen(false);
      toast({ title: "Configurações salvas" });
    } catch { toast({ title: "Erro ao salvar", variant: "destructive" }); }
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    try {
      await createTask.mutateAsync({ title: newTitle.trim(), description: newDesc.trim(), boardId: board.id, teamId: board.team_id, frequency: newFrequency, weekday: newFrequency === "weekday" ? parseInt(newWeekday) : null, monthDay: newFrequency === "monthly" ? parseInt(newMonthDay) : null, scheduledTime: newScheduledTime || null });
      setNewTitle(""); setNewDesc(""); setNewFrequency("daily"); setNewWeekday("0"); setNewMonthDay("1"); setNewScheduledTime(""); setDialogOpen(false);
      toast({ title: "Tarefa criada com sucesso" });
    } catch { toast({ title: "Erro ao criar tarefa", variant: "destructive" }); }
  };

  const handleDelete = async (id: string) => {
    try { await deleteTask.mutateAsync(id); toast({ title: "Tarefa removida" }); }
    catch { toast({ title: "Erro ao remover tarefa", variant: "destructive" }); }
  };

  const openEditDialog = (task: RecurringTask) => {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditDesc(task.description ?? "");
    setEditFrequency(task.frequency as any);
    setEditWeekday(String(task.weekday ?? 0));
    setEditMonthDay(String(task.month_day ?? 1));
    setEditScheduledTime(task.scheduled_time ?? "");
  };

  const handleEditSave = async () => {
    if (!editingTask || !editTitle.trim()) return;
    try {
      await updateTask.mutateAsync({
        id: editingTask.id,
        title: editTitle.trim(),
        description: editDesc.trim() || null,
        frequency: editFrequency,
        weekday: editFrequency === "weekday" ? parseInt(editWeekday) : null,
        monthDay: editFrequency === "monthly" ? parseInt(editMonthDay) : null,
        scheduledTime: editScheduledTime || null,
        teamId: editingTask.team_id,
      });
      setEditingTask(null);
      toast({ title: "Tarefa atualizada" });
    } catch { toast({ title: "Erro ao atualizar tarefa", variant: "destructive" }); }
  };

  // Sort by position within each frequency group
  const sortedByFreq = (freq: string) => {
    return tasks.filter((t) => t.frequency === freq).sort((a, b) => a.position - b.position);
  };

  const handleDragEnd = useCallback(async (result: DropResult) => {
    if (!result.destination) return;
    const freq = result.source.droppableId;
    const freqTasks = sortedByFreq(freq);
    const reordered = [...freqTasks];
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    try {
      await reorderTasks.mutateAsync(reordered.map(t => t.id));
    } catch { toast({ title: "Erro ao reordenar", variant: "destructive" }); }
  }, [tasks, reorderTasks, toast]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{board.name}</h1>
            <p className="text-sm text-muted-foreground">Tarefas recorrentes</p>
          </div>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
              <DialogTrigger asChild><Button variant="outline" size="icon"><Pencil className="h-4 w-4" /></Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Configurações do Quadro</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <Select value={assignedUser || "none"} onValueChange={setAssignedUser}>
                    <SelectTrigger><SelectValue placeholder="Todos da equipe (sem atribuição)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Todos da equipe</SelectItem>
                      {teamMembers?.map((m: any) => (<SelectItem key={m.user_id} value={m.user_id}>{m.profiles?.name ?? m.user_id}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <Button onClick={handleSaveSettings} className="w-full">Salvar Configurações</Button>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Nova Tarefa</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nova Tarefa</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <Input placeholder="Título da tarefa" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
                  <Textarea placeholder="Descrição (opcional)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Frequência</label>
                    <Select value={newFrequency} onValueChange={(v) => setNewFrequency(v as any)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Diária</SelectItem>
                        <SelectItem value="weekly">Semanal</SelectItem>
                        <SelectItem value="weekday">Dia da semana específico</SelectItem>
                        <SelectItem value="monthly">Dia do mês específico</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {newFrequency === "weekday" && (
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Dia da semana</label>
                      <Select value={newWeekday} onValueChange={setNewWeekday}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{WEEKDAYS.map((d) => (<SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>))}</SelectContent>
                      </Select>
                    </div>
                  )}
                  {newFrequency === "monthly" && (
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Dia do mês</label>
                      <Select value={newMonthDay} onValueChange={setNewMonthDay}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{MONTH_DAYS.map((d) => (<SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>))}</SelectContent>
                      </Select>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Horário (opcional)</label>
                    <Input type="time" value={newScheduledTime} onChange={(e) => setNewScheduledTime(e.target.value)} placeholder="Ex: 09:00" />
                    <p className="text-xs text-muted-foreground mt-1">Se definido, você será notificado caso a tarefa não seja concluída até esse horário.</p>
                  </div>
                  <Button onClick={handleCreate} disabled={!newTitle.trim() || createTask.isPending} className="w-full">Criar Tarefa</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {/* Today's progress bar */}
      {progressStats.active > 0 && (
        <div className="card-premium p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Progresso de Hoje</span>
            </div>
            <span className="text-sm font-bold text-primary">
              {progressStats.completed}/{progressStats.active} tarefas
            </span>
          </div>
          <div className="progress-bar h-3">
            <div
              className={cn(
                "progress-bar-fill animate-progress-fill",
                progressStats.pct >= 70 ? "bg-success" : progressStats.pct >= 40 ? "bg-warning" : "bg-primary"
              )}
              style={{ "--progress-width": `${progressStats.pct}%`, width: `${progressStats.pct}%` } as any}
            />
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1,2,3,4].map(i => <div key={i} className="skeleton-loading h-32 rounded-xl" />)}
        </div>
      ) : tasks.length === 0 ? (
        <div className="card-premium p-8 text-center">
          <p className="text-muted-foreground">Nenhuma tarefa cadastrada neste quadro.</p>
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {(["daily", "weekly", "weekday", "monthly"] as const).map((freq) => {
            const freqTasks = sortedByFreq(freq);
            if (freqTasks.length === 0) return null;
            const config = freqConfig[freq];

            return (
              <div key={freq} className="space-y-3 animate-fade-in">
                {/* Frequency header */}
                <div className="flex items-center gap-2 px-1">
                  <span className="text-lg">{config.emoji}</span>
                  <h3 className="font-semibold text-sm">{config.label}</h3>
                  <span className="ml-auto inline-flex items-center justify-center h-5 min-w-[20px] rounded-full bg-foreground/10 text-[11px] font-semibold px-1.5">
                    {freqTasks.length}
                  </span>
                </div>

                {/* Tasks with drag-and-drop */}
                <Droppable droppableId={freq}>
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                      {freqTasks.map((task, taskIndex) => {
                        const completed = isTaskCompleted(task);
                        const active = isTaskActiveToday(task);
                        return (
                          <Draggable key={task.id} draggableId={task.id} index={taskIndex} isDragDisabled={!canManage}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={cn(
                                  "card-premium p-3.5 transition-all duration-300 group",
                                  !active && "opacity-40",
                                  completed && "opacity-60",
                                  snapshot.isDragging && "shadow-lg ring-2 ring-primary/30"
                                )}
                              >
                                <div className="flex items-start gap-3">
                                  {canManage && (
                                    <div {...provided.dragHandleProps} className="mt-0.5 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
                                      <GripVertical className="h-4 w-4" />
                                    </div>
                                  )}
                                  <Checkbox
                                    checked={completed}
                                    onCheckedChange={() => toggleCompletion.mutate({ task })}
                                    className="mt-0.5"
                                    disabled={!active}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <span className={cn(
                                      "text-sm transition-all duration-300",
                                      completed && "line-through text-muted-foreground"
                                    )}>
                                      {task.title}
                                    </span>
                                    {(task.frequency === "weekday" || task.frequency === "monthly") && (
                                      <p className="text-xs text-muted-foreground mt-0.5">{getTaskFrequencyLabel(task)}</p>
                                    )}
                                    {task.scheduled_time && (
                                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                        <Clock className="h-3 w-3" /> {task.scheduled_time.slice(0, 5)}
                                      </p>
                                    )}
                                    {task.description && (
                                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
                                    )}
                                  </div>
                                  {canManage && (
                                    <div className="flex items-center gap-0.5 flex-shrink-0">
                                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-accent" onClick={() => openEditDialog(task)}>
                                        <Pencil className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/70 hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(task.id)}>
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
        </DragDropContext>
      )}

      {/* Edit Task Dialog */}
      <Dialog open={!!editingTask} onOpenChange={(open) => !open && setEditingTask(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Tarefa</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Título da tarefa" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            <Textarea placeholder="Descrição (opcional)" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
            <div>
              <label className="text-sm font-medium mb-1.5 block">Frequência</label>
              <Select value={editFrequency} onValueChange={(v) => setEditFrequency(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Diária</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="weekday">Dia da semana específico</SelectItem>
                  <SelectItem value="monthly">Dia do mês específico</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editFrequency === "weekday" && (
              <div>
                <label className="text-sm font-medium mb-1.5 block">Dia da semana</label>
                <Select value={editWeekday} onValueChange={setEditWeekday}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{WEEKDAYS.map((d) => (<SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>))}</SelectContent>
                </Select>
              </div>
            )}
            {editFrequency === "monthly" && (
              <div>
                <label className="text-sm font-medium mb-1.5 block">Dia do mês</label>
                <Select value={editMonthDay} onValueChange={setEditMonthDay}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTH_DAYS.map((d) => (<SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>))}</SelectContent>
                </Select>
              </div>
             )}
            <div>
              <label className="text-sm font-medium mb-1.5 block">Horário (opcional)</label>
              <Input type="time" value={editScheduledTime} onChange={(e) => setEditScheduledTime(e.target.value)} placeholder="Ex: 09:00" />
              <p className="text-xs text-muted-foreground mt-1">Se definido, você será notificado caso a tarefa não seja concluída até esse horário.</p>
            </div>
            <Button onClick={handleEditSave} disabled={!editTitle.trim() || updateTask.isPending} className="w-full">Salvar Alterações</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- Main page: board list ----
export default function RecurringTasks() {
  const { data: teams } = useTeams();
  const canManage = useCanManage("can_manage_recurring_tasks");
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const teamId = selectedTeam || teams?.[0]?.id || "";
  const { boards, isLoading, createBoard, updateBoard, deleteBoard } = useRecurringTaskBoards(teamId);
  const { data: teamMembers } = useTeamMembers(teamId);
  const { toast } = useToast();
  const [selectedBoard, setSelectedBoard] = useState<RecurringTaskBoard | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAssignedUser, setNewAssignedUser] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState("");
  const [editName, setEditName] = useState("");
  const [editTeamId, setEditTeamId] = useState("");
  const [editAssignedUser, setEditAssignedUser] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleEdit = async () => {
    if (!editName.trim() || !editId || !editTeamId) return;
    try {
      await updateBoard.mutateAsync({ id: editId, name: editName.trim(), frequencyType: "weekly", weekday: 0, assignedUserId: editAssignedUser && editAssignedUser !== "none" ? editAssignedUser : null, teamId: editTeamId });
      setEditOpen(false); toast({ title: "Quadro atualizado" });
    } catch { toast({ title: "Erro ao atualizar quadro", variant: "destructive" }); }
  };

  const handleCreate = async () => {
    if (!newName.trim() || !teamId) return;
    if (!newAssignedUser) { toast({ title: "Selecione um responsável", variant: "destructive" }); return; }
    try {
      await createBoard.mutateAsync({ name: newName.trim(), frequencyType: "weekly", weekday: 0, teamId, assignedUserId: newAssignedUser });
      setNewName(""); setNewAssignedUser(""); setCreateOpen(false); toast({ title: "Quadro criado com sucesso" });
    } catch { toast({ title: "Erro ao criar quadro", variant: "destructive" }); }
  };

  const handleDelete = async (id: string) => {
    try { await deleteBoard.mutateAsync(id); toast({ title: "Quadro removido" }); }
    catch { toast({ title: "Erro ao remover quadro", variant: "destructive" }); }
  };

  const getMemberName = (userId: string) => {
    const member = (teamMembers as any[])?.find((m) => m.user_id === userId);
    return member?.profiles?.name ?? "Usuário";
  };

  if (selectedBoard) {
    return (
      <BoardDetail
        board={selectedBoard} onBack={() => setSelectedBoard(null)} canManage={!!canManage}
        teamMembers={teamMembers as any[] ?? []}
        onUpdateBoard={async (params) => { await updateBoard.mutateAsync(params); }}
      />
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tarefas Fixas</h1>
          <p className="text-sm text-muted-foreground mt-1">Quadros de tarefas recorrentes</p>
        </div>
        <div className="flex items-center gap-2">
          {teams && teams.length > 1 && (
            <Select value={teamId} onValueChange={setSelectedTeam}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Equipe" /></SelectTrigger>
              <SelectContent>{teams.map((t) => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}</SelectContent>
            </Select>
          )}
          {canManage && (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Novo Quadro</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Novo Quadro de Tarefas</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <Input placeholder="Nome do quadro" value={newName} onChange={(e) => setNewName(e.target.value)} />
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Responsável *</label>
                    <Select value={newAssignedUser} onValueChange={setNewAssignedUser}>
                      <SelectTrigger><SelectValue placeholder="Selecione o responsável" /></SelectTrigger>
                      <SelectContent>
                        {(teamMembers as any[])?.map((m: any) => (<SelectItem key={m.user_id} value={m.user_id}>{m.profiles?.name ?? m.user_id}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleCreate} disabled={!newName.trim() || !newAssignedUser || createBoard.isPending} className="w-full">Criar Quadro</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1,2,3].map(i => <div key={i} className="skeleton-loading h-28 rounded-xl" />)}
        </div>
      ) : boards.length === 0 ? (
        <div className="card-premium p-12 text-center space-y-3 animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto">
            <Clock className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">Nenhum quadro criado ainda.</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((board, index) => (
            <div
              key={board.id}
              className="card-premium cursor-pointer group animate-fade-in"
              style={{ animationDelay: `${index * 50}ms` }}
              onClick={() => setSelectedBoard(board)}
            >
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-base">{board.name}</h3>
                    {board.assigned_user_id && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <User className="h-3 w-3" /> {getMemberName(board.assigned_user_id)}
                      </p>
                    )}
                  </div>
                  {canManage && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={() => { setEditId(board.id); setEditName(board.name); setEditTeamId(board.team_id); setEditAssignedUser(board.assigned_user_id || "none"); setEditOpen(true); }}>
                          <Pencil className="h-4 w-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(board.id)}>
                          <Trash2 className="h-4 w-4 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Board Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Quadro</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Nome do quadro" value={editName} onChange={(e) => setEditName(e.target.value)} />
            {teams && teams.length > 1 && (
              <div>
                <label className="text-sm font-medium mb-1.5 block">Equipe</label>
                <Select value={editTeamId} onValueChange={setEditTeamId}>
                  <SelectTrigger><SelectValue placeholder="Selecione a equipe" /></SelectTrigger>
                  <SelectContent>{teams.map((t) => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
            )}
            <div>
              <label className="text-sm font-medium mb-1.5 block">Responsável</label>
              <Select value={editAssignedUser || "none"} onValueChange={setEditAssignedUser}>
                <SelectTrigger><SelectValue placeholder="Selecione o responsável" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Todos da equipe</SelectItem>
                  {(teamMembers as any[])?.map((m: any) => (<SelectItem key={m.user_id} value={m.user_id}>{m.profiles?.name ?? m.user_id}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleEdit} disabled={!editName.trim() || updateBoard.isPending} className="w-full">Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Board Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir quadro?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita. Todas as tarefas deste quadro serão removidas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteId) { handleDelete(deleteId); setDeleteId(null); } }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}