import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Trash2, Plus, CalendarDays, CalendarRange, Calendar, Pencil, ArrowLeft } from "lucide-react";
import {
  useRecurringTaskBoards,
  useRecurringTasks,
  getWeekdayName,
  RecurringTaskBoard,
  RecurringTask,
} from "@/hooks/useRecurringTasks";
import { useTeams } from "@/hooks/useBoards";
import { useCanManage } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";

const WEEKDAYS = [
  { value: "0", label: "Segunda" },
  { value: "1", label: "Terça" },
  { value: "2", label: "Quarta" },
  { value: "3", label: "Quinta" },
  { value: "4", label: "Sexta" },
  { value: "5", label: "Sábado" },
  { value: "6", label: "Domingo" },
];

function frequencyLabel(board: RecurringTaskBoard): string {
  if (board.frequency_type === "weekday") return getWeekdayName(board.weekday ?? 0);
  if (board.frequency_type === "weekly") return "Semanal";
  return "Mensal";
}

function frequencyIcon(type: string) {
  if (type === "weekday") return CalendarDays;
  if (type === "weekly") return CalendarRange;
  return Calendar;
}

// ---- Board detail view (tasks inside a board) ----
function BoardDetail({
  board,
  onBack,
  canManage,
}: {
  board: RecurringTaskBoard;
  onBack: () => void;
  canManage: boolean;
}) {
  const { tasks, isLoading, isTaskCompleted, toggleCompletion, createTask, deleteTask } =
    useRecurringTasks(board.id);
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    try {
      await createTask.mutateAsync({
        title: newTitle.trim(),
        description: newDesc.trim(),
        boardId: board.id,
        teamId: board.team_id,
      });
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

  const Icon = frequencyIcon(board.frequency_type);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Icon className="h-5 w-5 text-primary" />
              {board.name}
            </h1>
            <p className="text-muted-foreground">{frequencyLabel(board)}</p>
          </div>
        </div>
        {canManage && (
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
                const completed = isTaskCompleted(task, board);
                return (
                  <li key={task.id} className="flex items-start gap-3 rounded-md border p-3">
                    <Checkbox
                      checked={completed}
                      onCheckedChange={() => toggleCompletion.mutate({ task, board })}
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
  const { boards, isLoading, createBoard, updateBoard, deleteBoard, isActiveToday } =
    useRecurringTaskBoards(teamId);
  const { toast } = useToast();

  const [selectedBoard, setSelectedBoard] = useState<RecurringTaskBoard | null>(null);

  // Create board dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newFreqType, setNewFreqType] = useState<"weekday" | "weekly" | "monthly">("weekday");
  const [newWeekday, setNewWeekday] = useState("0");

  // Edit board dialog
  const [editBoard, setEditBoard] = useState<RecurringTaskBoard | null>(null);
  const [editName, setEditName] = useState("");
  const [editFreqType, setEditFreqType] = useState<"weekday" | "weekly" | "monthly">("weekday");
  const [editWeekday, setEditWeekday] = useState("0");

  const handleCreate = async () => {
    if (!newName.trim() || !teamId) return;
    try {
      await createBoard.mutateAsync({
        name: newName.trim(),
        frequencyType: newFreqType,
        weekday: parseInt(newWeekday),
        teamId,
      });
      setNewName("");
      setCreateOpen(false);
      toast({ title: "Quadro criado com sucesso" });
    } catch {
      toast({ title: "Erro ao criar quadro", variant: "destructive" });
    }
  };

  const handleEdit = async () => {
    if (!editBoard || !editName.trim()) return;
    try {
      await updateBoard.mutateAsync({
        id: editBoard.id,
        name: editName.trim(),
        frequencyType: editFreqType,
        weekday: parseInt(editWeekday),
      });
      setEditBoard(null);
      toast({ title: "Quadro atualizado" });
    } catch {
      toast({ title: "Erro ao atualizar quadro", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBoard.mutateAsync(id);
      setEditBoard(null);
      toast({ title: "Quadro removido" });
    } catch {
      toast({ title: "Erro ao remover quadro", variant: "destructive" });
    }
  };

  const openEdit = (board: RecurringTaskBoard) => {
    setEditName(board.name);
    setEditFreqType(board.frequency_type);
    setEditWeekday(String(board.weekday ?? 0));
    setEditBoard(board);
  };

  if (selectedBoard) {
    return (
      <BoardDetail
        board={selectedBoard}
        onBack={() => setSelectedBoard(null)}
        canManage={!!canManage}
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
                  <Select value={newFreqType} onValueChange={(v) => setNewFreqType(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekday">Dia da semana</SelectItem>
                      <SelectItem value="weekly">Semanal</SelectItem>
                      <SelectItem value="monthly">Mensal</SelectItem>
                    </SelectContent>
                  </Select>
                  {newFreqType === "weekday" && (
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
                  )}
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
          {boards.map((board) => {
            const Icon = frequencyIcon(board.frequency_type);
            const active = isActiveToday(board);
            return (
              <Card
                key={board.id}
                className={`cursor-pointer transition-colors hover:border-primary/50 ${!active ? "opacity-50" : ""}`}
                onClick={() => setSelectedBoard(board)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Icon className="h-4 w-4 text-primary" />
                      {board.name}
                    </CardTitle>
                    {canManage && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(board);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{frequencyLabel(board)}</p>
                  {!active && (
                    <p className="text-xs text-muted-foreground mt-1">Não ativo hoje</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit board dialog */}
      <Dialog open={!!editBoard} onOpenChange={(open) => !open && setEditBoard(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" /> Editar Quadro
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Nome do quadro"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
            <Select value={editFreqType} onValueChange={(v) => setEditFreqType(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekday">Dia da semana</SelectItem>
                <SelectItem value="weekly">Semanal</SelectItem>
                <SelectItem value="monthly">Mensal</SelectItem>
              </SelectContent>
            </Select>
            {editFreqType === "weekday" && (
              <Select value={editWeekday} onValueChange={setEditWeekday}>
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
            )}
            <Button
              onClick={handleEdit}
              disabled={!editName.trim() || updateBoard.isPending}
              className="w-full"
            >
              Salvar Alterações
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full gap-2">
                  <Trash2 className="h-4 w-4" /> Excluir Quadro
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir quadro?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Todas as tarefas deste quadro serão excluídas permanentemente.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => editBoard && handleDelete(editBoard.id)}>
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
