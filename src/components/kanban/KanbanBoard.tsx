import { useState } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { useBoardDetail } from "@/hooks/useBoards";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus, MoreHorizontal, Trash2, CalendarIcon, User, AlertTriangle, Pencil, Copy, ArrowRightLeft, Clock, CheckCircle2, ListChecks } from "lucide-react";
import { TaskComments } from "./TaskComments";
import { SubtaskChecklist, SubtaskProgress } from "./SubtaskChecklist";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";

const priorityBorderClass: Record<string, string> = {
  low: "priority-border-low",
  medium: "priority-border-medium",
  high: "priority-border-high",
  urgent: "priority-border-urgent",
};

interface Props {
  boardId: string;
  onBack: () => void;
}

export function KanbanBoard({ boardId, onBack }: Props) {
  const queryClient = useQueryClient();
  const { board, isLoading, addColumn, addTask, deleteColumn, deleteTask, moveTask, updateTask } = useBoardDetail(boardId);
  const [newColumnName, setNewColumnName] = useState("");
  const [addingColumn, setAddingColumn] = useState(false);
  const [addingTaskCol, setAddingTaskCol] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskAssignee, setNewTaskAssignee] = useState<string>("");
  const [newTaskDueDate, setNewTaskDueDate] = useState<Date | undefined>(undefined);
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<string>("medium");
  const [newTaskScheduledTime, setNewTaskScheduledTime] = useState<string>("");
  const [newSubtaskTitles, setNewSubtaskTitles] = useState<string[]>([]);
  const [newSubtaskInput, setNewSubtaskInput] = useState("");
  const [editingTask, setEditingTask] = useState<any>(null);
  const [hoveredTask, setHoveredTask] = useState<string | null>(null);

  const { data: teamMembers } = useQuery({
    queryKey: ["team-members-profiles", board?.team_id],
    queryFn: async () => {
      const { data: members, error: mErr } = await supabase
        .from("team_members").select("user_id").eq("team_id", board!.team_id);
      if (mErr) throw mErr;
      const userIds = members.map((m) => m.user_id);
      if (userIds.length === 0) return [];
      const { data: profiles, error: pErr } = await supabase
        .from("profiles").select("user_id, name").in("user_id", userIds);
      if (pErr) throw pErr;
      return profiles ?? [];
    },
    enabled: !!board?.team_id,
  });

  const getAssigneeName = (assigneeId: string | null) => {
    if (!assigneeId || !teamMembers) return null;
    return teamMembers.find((m) => m.user_id === assigneeId)?.name ?? null;
  };

  const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  const handleAddColumn = async () => {
    if (!newColumnName.trim()) return;
    const position = board?.board_columns?.length ?? 0;
    try {
      await addColumn.mutateAsync({ name: newColumnName.trim(), position });
      setNewColumnName("");
      setAddingColumn(false);
    } catch { toast.error("Erro ao adicionar coluna"); }
  };

  const handleAddTask = async (columnId: string) => {
    if (!newTaskTitle.trim()) return;
    if (!newTaskDescription.trim()) { toast.error("A descrição é obrigatória"); return; }
    if (!newTaskDueDate) { toast.error("O prazo é obrigatório"); return; }
    if (!newTaskAssignee || newTaskAssignee === "none") { toast.error("O responsável é obrigatório"); return; }
    try {
      const result = await addTask.mutateAsync({
        columnId, title: newTaskTitle.trim(),
        assigneeId: newTaskAssignee,
        dueDate: newTaskDueDate.toISOString(),
        description: newTaskDescription.trim(),
        priority: newTaskPriority || "medium",
        scheduledTime: newTaskScheduledTime || undefined,
      });
      // Create subtasks if any were added
      if (newSubtaskTitles.length > 0 && result?.id) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await Promise.all(
            newSubtaskTitles.map((title, index) =>
              supabase.from("subtasks").insert({
                task_id: result.id,
                title,
                position: index,
                created_by: user.id,
              })
            )
          );
        }
      }
      setNewTaskTitle(""); setNewTaskAssignee(""); setNewTaskDueDate(undefined); setNewTaskDescription(""); setNewTaskPriority("medium"); setNewTaskScheduledTime(""); setNewSubtaskTitles([]); setNewSubtaskInput(""); setAddingTaskCol(null);
    } catch { toast.error("Erro ao criar tarefa"); }
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination || !board?.board_columns || moveTask.isPending) return;

    const { draggableId, source, destination } = result;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const queryKey = ["board", boardId];
    const previousBoard = queryClient.getQueryData(queryKey);
    const updatedOrder = {
      sourceTaskIds: [] as string[],
      destinationTaskIds: [] as string[],
    };

    void queryClient.cancelQueries({ queryKey });

    queryClient.setQueryData(queryKey, (old: any) => {
      if (!old?.board_columns) return old;

      const cols = old.board_columns.map((c: any) => ({ ...c, tasks: [...(c.tasks || [])] }));
      const srcCol = cols.find((c: any) => c.id === source.droppableId);
      const dstCol = cols.find((c: any) => c.id === destination.droppableId);
      if (!srcCol || !dstCol) return old;

      const sourceTasks = [...srcCol.tasks];
      const destinationTasks = srcCol.id === dstCol.id ? sourceTasks : [...dstCol.tasks];

      const [movedTask] = sourceTasks.splice(source.index, 1);
      if (!movedTask) return old;

      const moved = { ...movedTask, column_id: destination.droppableId };
      destinationTasks.splice(destination.index, 0, moved);

      const normalize = (tasks: any[]) => tasks.map((task, position) => ({ ...task, position }));
      const normalizedSource = normalize(sourceTasks);
      const normalizedDestination = srcCol.id === dstCol.id ? normalizedSource : normalize(destinationTasks);

      updatedOrder.sourceTaskIds = normalizedSource.map((task: any) => task.id);
      updatedOrder.destinationTaskIds = normalizedDestination.map((task: any) => task.id);

      const updatedColumns = cols.map((col: any) => {
        if (col.id === srcCol.id) return { ...col, tasks: normalizedSource };
        if (col.id === dstCol.id) return { ...col, tasks: normalizedDestination };
        return col;
      });

      return { ...old, board_columns: updatedColumns };
    });

    if (!updatedOrder.sourceTaskIds.length || !updatedOrder.destinationTaskIds.length) {
      queryClient.setQueryData(queryKey, previousBoard);
      return;
    }

    moveTask.mutate(
      {
        taskId: draggableId,
        sourceColumnId: source.droppableId,
        destinationColumnId: destination.droppableId,
        sourceTaskIds: updatedOrder.sourceTaskIds,
        destinationTaskIds: updatedOrder.destinationTaskIds,
      },
      {
        onError: () => {
          queryClient.setQueryData(queryKey, previousBoard);
          toast.error("Erro ao mover tarefa");
        },
      }
    );
  };

  const handleUpdateTask = async () => {
    if (!editingTask) return;
    if (!editingTask.due_date) { toast.error("O prazo é obrigatório"); return; }
    try {
      await updateTask.mutateAsync({
        id: editingTask.id, title: editingTask.title, description: editingTask.description || null,
        priority: editingTask.priority, due_date: editingTask.due_date || null, assignee_id: editingTask.assignee_id || null,
        scheduled_time: editingTask.scheduled_time || null,
      });
      setEditingTask(null);
      toast.success("Tarefa atualizada!");
    } catch { toast.error("Erro ao atualizar"); }
  };

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Carregando quadro...</p>
      </div>
    </div>
  );
  if (!board) return <div className="text-muted-foreground">Quadro não encontrado.</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          ← Voltar
        </Button>
        <div>
          <h1 className="text-xl font-bold tracking-tight">{board.name}</h1>
          {board.description && <p className="text-xs text-muted-foreground">{board.description}</p>}
        </div>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: 400 }}>
          {board.board_columns?.map((col: any, colIndex: number) => {
            const taskCount = col.tasks?.length ?? 0;
            const isLastColumn = colIndex === (board.board_columns?.length ?? 0) - 1;
            return (
              <div key={col.id} className="flex-shrink-0 w-[300px] bg-muted/40 rounded-xl p-3.5 space-y-3">
                {/* Column header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm text-foreground">{col.name}</h3>
                    <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-foreground/10 text-[11px] font-semibold text-foreground">
                      {taskCount}
                    </span>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-50 hover:opacity-100">
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem className="text-destructive" onClick={() => deleteColumn.mutateAsync(col.id)}>
                        <Trash2 className="mr-2 h-3.5 w-3.5" /> Excluir coluna
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(
                        "space-y-2.5 min-h-[50px] rounded-lg transition-colors",
                        snapshot.isDraggingOver && "bg-primary/5"
                      )}
                    >
                      {col.tasks?.map((task: any, index: number) => {
                        const assigneeName = getAssigneeName(task.assignee_id);
                        const isOverdue = task.due_date && isPast(new Date(task.due_date));
                        const isHovered = hoveredTask === task.id;
                        const isCompleted = isLastColumn;
                        const isCompletedLate = isCompleted && isOverdue;

                        return (
                          <Draggable key={task.id} draggableId={task.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={cn(
                                  `bg-card rounded-xl border shadow-sm p-3.5 cursor-grab transition-all duration-200 ${isCompleted ? "" : priorityBorderClass[task.priority] || ""}`,
                                  snapshot.isDragging && "shadow-lg ring-2 ring-primary/20 rotate-1 cursor-grabbing",
                                  !isCompleted && isOverdue && "bg-destructive/5",
                                  isCompleted && "opacity-75 bg-muted/60 border-muted-foreground/15",
                                  !snapshot.isDragging && "hover:shadow-md hover:-translate-y-0.5"
                                )}
                                onClick={() => setEditingTask({ ...task })}
                                onMouseEnter={() => setHoveredTask(task.id)}
                                onMouseLeave={() => setHoveredTask(null)}
                              >
                                <div className="space-y-2 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    {isCompleted && (
                                      <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-500" />
                                    )}
                                    {isCompletedLate && (
                                      <span className="text-destructive text-xs font-bold flex-shrink-0" title="Concluída fora do prazo">!</span>
                                    )}
                                    <p className={cn("text-sm font-medium leading-tight", isCompleted && "line-through text-muted-foreground")}>{task.title}</p>
                                  </div>
                                  {task.description && (
                                    <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
                                  )}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {task.due_date && (
                                      <span className={cn(
                                        "text-[11px] px-2 py-0.5 rounded-md font-medium inline-flex items-center gap-1",
                                        isOverdue
                                          ? "bg-destructive/15 text-destructive"
                                          : "bg-muted text-muted-foreground"
                                      )}>
                                        {isOverdue && <AlertTriangle className="h-3 w-3" />}
                                        <CalendarIcon className="h-3 w-3" />
                                        {format(new Date(task.due_date), "dd/MM", { locale: ptBR })}
                                      </span>
                                    )}
                                    {task.scheduled_time && (
                                      <span className="text-[11px] px-2 py-0.5 rounded-md font-medium inline-flex items-center gap-1 bg-muted text-muted-foreground">
                                        <Clock className="h-3 w-3" />
                                        {task.scheduled_time.slice(0, 5)}
                                      </span>
                                    )}
                                    {assigneeName && (
                                      <Avatar className="h-5 w-5">
                                        <AvatarFallback className="text-[9px] bg-primary/10 text-primary font-semibold">
                                          {getInitials(assigneeName)}
                                        </AvatarFallback>
                                      </Avatar>
                                    )}
                                    <SubtaskProgress taskId={task.id} />
                                  </div>
                                </div>

                                {/* Hover quick actions */}
                                {isHovered && !snapshot.isDragging && (
                                  <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/50 animate-fade-in">
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); setEditingTask({ ...task }); }}>
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>

                  <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground hover:text-foreground" onClick={() => { setAddingTaskCol(col.id); setNewTaskTitle(""); setNewTaskAssignee(""); setNewTaskDueDate(undefined); setNewTaskDescription(""); setNewTaskPriority("medium"); setNewTaskScheduledTime(""); setNewSubtaskTitles([]); setNewSubtaskInput(""); }}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar tarefa
                  </Button>
              </div>
            );
          })}

          {/* Add column */}
          <div className="flex-shrink-0 w-[300px]">
            {addingColumn ? (
              <div className="bg-muted/40 rounded-xl p-3.5 space-y-2 animate-scale-in">
                <Input value={newColumnName} onChange={(e) => setNewColumnName(e.target.value)} placeholder="Nome da coluna" autoFocus onKeyDown={(e) => e.key === "Enter" && handleAddColumn()} />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAddColumn} disabled={!newColumnName.trim()}>Adicionar</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setAddingColumn(false); setNewColumnName(""); }}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" className="w-full border-dashed h-12 rounded-xl" onClick={() => setAddingColumn(true)}>
                <Plus className="mr-2 h-4 w-4" /> Nova Coluna
              </Button>
            )}
          </div>
        </div>
      </DragDropContext>

      {/* Task edit dialog */}
      <Dialog open={!!editingTask} onOpenChange={(o) => !o && setEditingTask(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar Tarefa</DialogTitle></DialogHeader>
          {editingTask && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Título</label>
                <Input value={editingTask.title} onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Descrição</label>
                <Textarea value={editingTask.description || ""} onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })} rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Responsável</label>
                  <Select value={editingTask.assignee_id || "none"} onValueChange={(v) => setEditingTask({ ...editingTask, assignee_id: v === "none" ? null : v })}>
                    <SelectTrigger><SelectValue placeholder="Selecionar responsável" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem responsável</SelectItem>
                      {teamMembers?.map((m) => (<SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Prioridade</label>
                  <Select value={editingTask.priority} onValueChange={(v) => setEditingTask({ ...editingTask, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baixa</SelectItem>
                      <SelectItem value="medium">Média</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                      <SelectItem value="urgent">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Prazo *</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !editingTask.due_date && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {editingTask.due_date ? format(new Date(editingTask.due_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : "Selecionar prazo"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={editingTask.due_date ? new Date(editingTask.due_date) : undefined} onSelect={(date) => setEditingTask({ ...editingTask, due_date: date ? date.toISOString() : null })} disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))} initialFocus className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className="text-sm font-medium">Horário Agendado</label>
                <Input type="time" value={editingTask.scheduled_time?.slice(0, 5) || ""} onChange={(e) => setEditingTask({ ...editingTask, scheduled_time: e.target.value || null })} />
                <p className="text-xs text-muted-foreground mt-1">Notificações 1h e 10min antes</p>
              </div>
              <div className="border-t pt-4">
                <SubtaskChecklist taskId={editingTask.id} />
              </div>
              <div className="border-t pt-4">
                <TaskComments taskId={editingTask.id} />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="destructive" size="sm" onClick={async () => { await deleteTask.mutateAsync(editingTask.id); setEditingTask(null); toast.success("Tarefa excluída"); }}>
                  <Trash2 className="mr-1 h-3 w-3" /> Excluir
                </Button>
                <Button onClick={handleUpdateTask}>Salvar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Task dialog */}
      <Dialog open={!!addingTaskCol} onOpenChange={(o) => { if (!o) { setAddingTaskCol(null); setNewTaskTitle(""); setNewTaskAssignee(""); setNewTaskDueDate(undefined); setNewTaskDescription(""); setNewTaskPriority("medium"); setNewSubtaskTitles([]); setNewSubtaskInput(""); } }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova Tarefa</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Título *</label>
              <Input value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} placeholder="Digite o título da tarefa" autoFocus />
            </div>
            <div>
              <label className="text-sm font-medium">Descrição *</label>
              <Textarea value={newTaskDescription} onChange={(e) => setNewTaskDescription(e.target.value)} placeholder="Adicione uma descrição" rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Responsável *</label>
                <Select value={newTaskAssignee} onValueChange={setNewTaskAssignee}>
                  <SelectTrigger><SelectValue placeholder="Selecionar responsável" /></SelectTrigger>
                  <SelectContent>
                    {teamMembers?.map((m) => (<SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Prioridade</label>
                <Select value={newTaskPriority} onValueChange={setNewTaskPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Prazo *</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !newTaskDueDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {newTaskDueDate ? format(newTaskDueDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : "Selecionar prazo"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={newTaskDueDate} onSelect={setNewTaskDueDate} disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="text-sm font-medium">Horário Agendado</label>
              <Input type="time" value={newTaskScheduledTime} onChange={(e) => setNewTaskScheduledTime(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">Notificações 1h e 10min antes</p>
            </div>

            {/* Subtasks section */}
            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Subtarefas</span>
                {newSubtaskTitles.length > 0 && (
                  <span className="text-xs text-muted-foreground">{newSubtaskTitles.length} adicionada(s)</span>
                )}
              </div>
              {newSubtaskTitles.map((title, idx) => (
                <div key={idx} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-muted/50 group">
                  <Checkbox checked={false} disabled />
                  <span className="text-sm flex-1">{title}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setNewSubtaskTitles(prev => prev.filter((_, i) => i !== idx))}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input
                  value={newSubtaskInput}
                  onChange={(e) => setNewSubtaskInput(e.target.value)}
                  placeholder="Nova subtarefa..."
                  className="h-8 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newSubtaskInput.trim()) {
                      e.preventDefault();
                      setNewSubtaskTitles(prev => [...prev, newSubtaskInput.trim()]);
                      setNewSubtaskInput("");
                    }
                  }}
                />
                <Button size="sm" className="h-8" onClick={() => { if (newSubtaskInput.trim()) { setNewSubtaskTitles(prev => [...prev, newSubtaskInput.trim()]); setNewSubtaskInput(""); } }} disabled={!newSubtaskInput.trim()}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => { setAddingTaskCol(null); setNewTaskTitle(""); setNewTaskAssignee(""); setNewTaskDueDate(undefined); setNewTaskDescription(""); setNewTaskPriority("medium"); setNewTaskScheduledTime(""); setNewSubtaskTitles([]); setNewSubtaskInput(""); }}>Cancelar</Button>
              <Button onClick={() => addingTaskCol && handleAddTask(addingTaskCol)} disabled={!newTaskTitle.trim() || !newTaskDescription.trim() || !newTaskDueDate || !newTaskAssignee || newTaskAssignee === "none"}>Criar Tarefa</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}