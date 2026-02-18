import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Trash2, Plus, Pencil, ArrowLeft, User, CalendarDays, CalendarRange, Calendar, Clock, MoreVertical } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
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

function taskFrequencyIcon(freq: string) {
  if (freq === "daily") return Clock;
  if (freq === "weekday") return CalendarDays;
  if (freq === "weekly") return CalendarRange;
  return Calendar;
}

// ---- Board detail view (tasks inside a board) ----
function BoardDetail({
  board,
  onBack,
  canManage,
  teamMembers,
  onUpdateBoard,
}: {
  board: RecurringTaskBoard;
  onBack: () => void;
  canManage: boolean;
  teamMembers: any[];
  onUpdateBoard: (params: { id: string; name: string; frequencyType: "weekday" | "weekly" | "monthly"; weekday: number; assignedUserId: string | null }) => Promise<void>;
}) {
  const { tasks, isLoading, isTaskCompleted, toggleCompletion, createTask, deleteTask } =
    useRecurringTasks(board.id);
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newFrequency, setNewFrequency] = useState<"daily" | "weekly" | "weekday" | "monthly">("daily");
  const [newWeekday, setNewWeekday] = useState("0");
  const [newMonthDay, setNewMonthDay] = useState("1");

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [assignedUser, setAssignedUser] = useState(board.assigned_user_id ?? "");

  const handleSaveSettings = async () => {
    try {
      await onUpdateBoard({
        id: board.id,
        name: board.name,
        frequencyType: board.frequency_type,
        weekday: board.weekday ?? 0,
        assignedUserId: assignedUser && assignedUser !== "none" ? assignedUser : null,
      });
      setSettingsOpen(false);
      toast({ title: "Configurações salvas" });
    } catch {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    }
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    try {
      await createTask.mutateAsync({
        title: newTitle.trim(),
        description: newDesc.trim(),
        boardId: board.id,
        teamId: board.team_id,
        frequency: newFrequency,
        weekday: newFrequency === "weekday" ? parseInt(newWeekday) : null,
        monthDay: newFrequency === "monthly" ? parseInt(newMonthDay) : null,
      });
      setNewTitle("");
      setNewDesc("");
      setNewFrequency("daily");
      setNewWeekday("0");
      setNewMonthDay("1");
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{board.name}</h1>
            <p className="text-muted-foreground">Tarefas recorrentes</p>
          </div>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon">
                  <Pencil className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Configurações do Quadro</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Select value={assignedUser || "none"} onValueChange={setAssignedUser}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos da equipe (sem atribuição)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Todos da equipe</SelectItem>
                      {teamMembers?.map((m: any) => (
                        <SelectItem key={m.user_id} value={m.user_id}>
                          {m.profiles?.name ?? m.user_id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={handleSaveSettings} className="w-full">
                    Salvar Configurações
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" /> Nova Tarefa
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nova Tarefa</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    placeholder="Título da tarefa"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                  />
                  <Textarea
                    placeholder="Descrição (opcional)"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                  />
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Frequência</label>
                    <Select value={newFrequency} onValueChange={(v) => setNewFrequency(v as any)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
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
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {WEEKDAYS.map((d) => (
                            <SelectItem key={d.value} value={d.value}>
                              {d.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {newFrequency === "monthly" && (
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Dia do mês</label>
                      <Select value={newMonthDay} onValueChange={setNewMonthDay}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MONTH_DAYS.map((d) => (
                            <SelectItem key={d.value} value={d.value}>
                              {d.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <Button
                    onClick={handleCreate}
                    disabled={!newTitle.trim() || createTask.isPending}
                    className="w-full"
                  >
                    Criar Tarefa
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : tasks.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhuma tarefa cadastrada neste quadro.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <ul className="space-y-2">
              {tasks.map((task) => {
                const completed = isTaskCompleted(task);
                const active = isTaskActiveToday(task);
                const Icon = taskFrequencyIcon(task.frequency);
                return (
                  <li
                    key={task.id}
                    className={`flex items-start gap-3 rounded-md border p-3 ${!active ? "opacity-50" : ""}`}
                  >
                    <Checkbox
                      checked={completed}
                      onCheckedChange={() => toggleCompletion.mutate({ task })}
                      className="mt-0.5"
                      disabled={!active}
                    />
                    <div className="flex-1 min-w-0">
                      <span className={completed ? "line-through text-muted-foreground" : ""}>
                        {task.title}
                      </span>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs gap-1">
                          <Icon className="h-3 w-3" />
                          {getTaskFrequencyLabel(task)}
                        </Badge>
                      </div>
                      {task.description && (
                        <p className="text-xs text-muted-foreground mt-1">{task.description}</p>
                      )}
                    </div>
                    {canManage && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => handleDelete(task.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---- Main page: board list ----
export default function RecurringTasks() {
  const { data: teams } = useTeams();
  const canManage = useCanManage("can_manage_recurring_tasks");
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const teamId = selectedTeam || teams?.[0]?.id || "";
  const { boards, isLoading, createBoard, updateBoard, deleteBoard } =
    useRecurringTaskBoards(teamId);
  const { data: teamMembers } = useTeamMembers(teamId);
  const { toast } = useToast();

  const [selectedBoard, setSelectedBoard] = useState<RecurringTaskBoard | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState("");
  const [editName, setEditName] = useState("");

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleEdit = async () => {
    if (!editName.trim() || !editId) return;
    try {
      await updateBoard.mutateAsync({
        id: editId,
        name: editName.trim(),
        frequencyType: "weekly",
        weekday: 0,
        assignedUserId: null,
      });
      setEditOpen(false);
      toast({ title: "Quadro atualizado" });
    } catch {
      toast({ title: "Erro ao atualizar quadro", variant: "destructive" });
    }
  };

  const handleCreate = async () => {
    if (!newName.trim() || !teamId) return;
    try {
      await createBoard.mutateAsync({
        name: newName.trim(),
        frequencyType: "weekly",
        weekday: 0,
        teamId,
        assignedUserId: null,
      });
      setNewName("");
      setCreateOpen(false);
      toast({ title: "Quadro criado com sucesso" });
    } catch {
      toast({ title: "Erro ao criar quadro", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBoard.mutateAsync(id);
      toast({ title: "Quadro removido" });
    } catch {
      toast({ title: "Erro ao remover quadro", variant: "destructive" });
    }
  };

  const getMemberName = (userId: string) => {
    const member = (teamMembers as any[])?.find((m) => m.user_id === userId);
    return member?.profiles?.name ?? "Usuário";
  };

  if (selectedBoard) {
    return (
      <BoardDetail
        board={selectedBoard}
        onBack={() => setSelectedBoard(null)}
        canManage={!!canManage}
        teamMembers={teamMembers as any[] ?? []}
        onUpdateBoard={async (params) => {
          await updateBoard.mutateAsync(params);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tarefas Fixas</h1>
          <p className="text-muted-foreground">Quadros de tarefas recorrentes</p>
        </div>
        <div className="flex items-center gap-2">
          {teams && teams.length > 1 && (
            <Select value={teamId} onValueChange={setSelectedTeam}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Equipe" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {canManage && (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" /> Novo Quadro
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Novo Quadro de Tarefas</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    placeholder="Nome do quadro"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                  <Button
                    onClick={handleCreate}
                    disabled={!newName.trim() || createBoard.isPending}
                    className="w-full"
                  >
                    Criar Quadro
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : boards.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhum quadro criado ainda.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((board) => (
            <Card
              key={board.id}
              className="cursor-pointer transition-colors hover:border-primary/50 relative"
              onClick={() => setSelectedBoard(board)}
            >
              <CardHeader className="pb-2 flex flex-row items-start justify-between">
                <CardTitle className="text-base">{board.name}</CardTitle>
                {canManage && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-7 w-7 -mt-1 -mr-2">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem onClick={() => { setEditId(board.id); setEditName(board.name); setEditOpen(true); }}>
                        <Pencil className="h-4 w-4 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(board.id)}>
                        <Trash2 className="h-4 w-4 mr-2" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </CardHeader>
              <CardContent>
                {board.assigned_user_id && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" /> {getMemberName(board.assigned_user_id)}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Board Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Quadro</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Nome do quadro" value={editName} onChange={(e) => setEditName(e.target.value)} />
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
