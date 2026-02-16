import { useState } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { useBoardDetail } from "@/hooks/useBoards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, MoreHorizontal, Trash2, GripVertical, Calendar } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { differenceInDays, format, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";

function getDueDateColor(dueDate: string | null, createdAt: string): string {
  if (!dueDate) return "";
  const now = new Date();
  const due = new Date(dueDate);
  const created = new Date(createdAt);
  if (isPast(due)) return "bg-destructive/15 text-destructive border-destructive/30";
  const total = due.getTime() - created.getTime();
  const elapsed = now.getTime() - created.getTime();
  if (total <= 0) return "";
  const pct = elapsed / total;
  if (pct >= 0.9) return "bg-destructive/15 text-destructive border-destructive/30";
  if (pct >= 0.7) return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30";
  if (pct >= 0.5) return "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30";
  return "bg-muted text-muted-foreground border-border";
}

const priorityColors: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-primary/10 text-primary",
  high: "bg-warning/10 text-warning-foreground",
  urgent: "bg-destructive/10 text-destructive",
};

const priorityLabels: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
};

interface Props {
  boardId: string;
  onBack: () => void;
}

export function KanbanBoard({ boardId, onBack }: Props) {
  const { board, isLoading, addColumn, addTask, deleteColumn, deleteTask, moveTask, updateTask } = useBoardDetail(boardId);
  const [newColumnName, setNewColumnName] = useState("");
  const [addingColumn, setAddingColumn] = useState(false);
  const [addingTaskCol, setAddingTaskCol] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [editingTask, setEditingTask] = useState<any>(null);

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
    try {
      await addTask.mutateAsync({ columnId, title: newTaskTitle.trim() });
      setNewTaskTitle("");
      setAddingTaskCol(null);
    } catch { toast.error("Erro ao criar tarefa"); }
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination || !board?.board_columns) return;
    const { draggableId, destination } = result;
    try {
      await moveTask.mutateAsync({
        taskId: draggableId,
        newColumnId: destination.droppableId,
        newPosition: destination.index,
      });
    } catch { toast.error("Erro ao mover tarefa"); }
  };

  const handleUpdateTask = async () => {
    if (!editingTask) return;
    try {
      await updateTask.mutateAsync({
        id: editingTask.id,
        title: editingTask.title,
        description: editingTask.description || null,
        priority: editingTask.priority,
        due_date: editingTask.due_date || null,
      });
      setEditingTask(null);
      toast.success("Tarefa atualizada!");
    } catch { toast.error("Erro ao atualizar"); }
  };

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Carregando...</div>;
  if (!board) return <div className="text-muted-foreground">Quadro não encontrado.</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>← Voltar</Button>
        <h1 className="text-2xl font-bold tracking-tight">{board.name}</h1>
        {board.description && <span className="text-muted-foreground text-sm">— {board.description}</span>}
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: 400 }}>
          {board.board_columns?.map((col: any) => (
            <div key={col.id} className="flex-shrink-0 w-72 bg-secondary/50 rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-foreground">{col.name}</h3>
                <div className="flex items-center gap-1">
                  <Badge variant="secondary" className="text-xs">{col.tasks?.length ?? 0}</Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6"><MoreHorizontal className="h-3 w-3" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem className="text-destructive" onClick={() => deleteColumn.mutateAsync(col.id)}>
                        <Trash2 className="mr-2 h-3 w-3" /> Excluir coluna
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <Droppable droppableId={col.id}>
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2 min-h-[40px]">
                    {col.tasks?.map((task: any, index: number) => (
                      <Draggable key={task.id} draggableId={task.id} index={index}>
                        {(provided, snapshot) => (
                          <Card
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`p-3 cursor-pointer hover:shadow-md transition-shadow ${snapshot.isDragging ? "shadow-lg ring-2 ring-primary/20" : ""}`}
                            onClick={() => setEditingTask({ ...task })}
                          >
                            <div className="flex items-start gap-2">
                              <div {...provided.dragHandleProps} className="mt-0.5">
                                <GripVertical className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div className="flex-1 space-y-1.5">
                                <p className="text-sm font-medium leading-tight">{task.title}</p>
                                {task.description && <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>}
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${priorityColors[task.priority]}`}>
                                    {priorityLabels[task.priority]}
                                  </span>
                                  {task.due_date && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium border flex items-center gap-0.5 ${getDueDateColor(task.due_date, task.created_at)}`}>
                                      <Calendar className="h-2.5 w-2.5" />
                                      {format(new Date(task.due_date), "dd/MM", { locale: ptBR })}
                                    </span>
                                  )}
                                  {task.labels?.map((l: string) => (
                                    <Badge key={l} variant="outline" className="text-[10px] px-1.5 py-0">{l}</Badge>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </Card>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>

              {addingTaskCol === col.id ? (
                <div className="space-y-2">
                  <Input
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="Título da tarefa"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && handleAddTask(col.id)}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleAddTask(col.id)} disabled={!newTaskTitle.trim()}>Adicionar</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setAddingTaskCol(null); setNewTaskTitle(""); }}>Cancelar</Button>
                  </div>
                </div>
              ) : (
                <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={() => setAddingTaskCol(col.id)}>
                  <Plus className="mr-1 h-3 w-3" /> Adicionar tarefa
                </Button>
              )}
            </div>
          ))}

          {/* Add column */}
          <div className="flex-shrink-0 w-72">
            {addingColumn ? (
              <div className="bg-secondary/50 rounded-lg p-3 space-y-2">
                <Input
                  value={newColumnName}
                  onChange={(e) => setNewColumnName(e.target.value)}
                  placeholder="Nome da coluna"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleAddColumn()}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAddColumn} disabled={!newColumnName.trim()}>Adicionar</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setAddingColumn(false); setNewColumnName(""); }}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" className="w-full border-dashed h-12" onClick={() => setAddingColumn(true)}>
                <Plus className="mr-2 h-4 w-4" /> Nova Coluna
              </Button>
            )}
          </div>
        </div>
      </DragDropContext>

      {/* Task edit dialog */}
      <Dialog open={!!editingTask} onOpenChange={(o) => !o && setEditingTask(null)}>
        <DialogContent>
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
              <div>
                <label className="text-sm font-medium">Prazo</label>
                <Input
                  type="date"
                  value={editingTask.due_date ? format(new Date(editingTask.due_date), "yyyy-MM-dd") : ""}
                  onChange={(e) => setEditingTask({ ...editingTask, due_date: e.target.value ? new Date(e.target.value).toISOString() : null })}
                />
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
    </div>
  );
}
