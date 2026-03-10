import { useState, useMemo, useRef } from "react";
import { format, startOfWeek, addWeeks, subWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ChevronLeft, ChevronRight, Plus, Target, CheckCircle2, ImagePlus, Trash2, Eye, Upload } from "lucide-react";
import { toast } from "sonner";
import { useCategories, useWeekGoals, useWeekTasks, useSocialMutations, SocialTask } from "@/hooks/useSocialMedia";
import { useIsAppAdmin, useCanManage } from "@/hooks/useUserRole";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function SocialMedia() {
  const { data: isAdmin } = useIsAppAdmin();
  const canManage = useCanManage("can_manage_social");
  const isManager = isAdmin || canManage;

  const [currentWeek, setCurrentWeek] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const weekStart = format(currentWeek, "yyyy-MM-dd");

  const { data: categories, isLoading: loadingCats } = useCategories();
  const { data: goals, isLoading: loadingGoals } = useWeekGoals(weekStart);
  const { data: tasks, isLoading: loadingTasks } = useWeekTasks(weekStart);
  const { saveGoal, createTask, completeTask, uncompleteTask, deleteTask, uploadProof, deleteProof } = useSocialMutations();

  const [showNewTask, setShowNewTask] = useState(false);
  const [showGoalEditor, setShowGoalEditor] = useState(false);
  const [selectedTask, setSelectedTask] = useState<SocialTask | null>(null);
  const [newTask, setNewTask] = useState({ title: "", description: "", category_id: "", due_date: "", assigned_to: "" });
  const [goalValues, setGoalValues] = useState<Record<string, number>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: profiles } = useQuery({
    queryKey: ["social-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const weekLabel = useMemo(() => {
    const end = addWeeks(currentWeek, 1);
    end.setDate(end.getDate() - 1);
    return `${format(currentWeek, "dd MMM", { locale: ptBR })} — ${format(end, "dd MMM yyyy", { locale: ptBR })}`;
  }, [currentWeek]);

  // Stats per category
  const categoryStats = useMemo(() => {
    if (!categories) return {};
    const stats: Record<string, { completed: number; total: number; target: number }> = {};
    categories.forEach((cat) => {
      const catTasks = tasks?.filter((t) => t.category_id === cat.id) ?? [];
      const goal = goals?.find((g) => g.category_id === cat.id);
      stats[cat.id] = {
        completed: catTasks.filter((t) => t.status === "completed").length,
        total: catTasks.length,
        target: goal?.target_count ?? 0,
      };
    });
    return stats;
  }, [categories, tasks, goals]);

  const handleSaveGoals = async () => {
    if (!categories) return;
    try {
      for (const cat of categories) {
        const val = goalValues[cat.id];
        if (val !== undefined && val >= 0) {
          await saveGoal.mutateAsync({ category_id: cat.id, week_start: weekStart, target_count: val });
        }
      }
      toast.success("Metas salvas!");
      setShowGoalEditor(false);
    } catch {
      toast.error("Erro ao salvar metas");
    }
  };

  const handleCreateTask = async () => {
    if (!newTask.title || !newTask.category_id) {
      toast.error("Preencha título e categoria");
      return;
    }
    try {
      const goal = goals?.find((g) => g.category_id === newTask.category_id);
      await createTask.mutateAsync({
        ...newTask,
        goal_id: goal?.id,
        due_date: newTask.due_date || format(currentWeek, "yyyy-MM-dd"),
        assigned_to: newTask.assigned_to || undefined,
      });
      toast.success("Tarefa criada!");
      setShowNewTask(false);
      setNewTask({ title: "", description: "", category_id: "", due_date: "", assigned_to: "" });
    } catch {
      toast.error("Erro ao criar tarefa");
    }
  };

  const handleUploadProof = async (taskId: string, file: File) => {
    try {
      await uploadProof.mutateAsync({ taskId, file });
      toast.success("Prova enviada!");
    } catch {
      toast.error("Erro ao enviar prova");
    }
  };

  const isLoading = loadingCats || loadingGoals || loadingTasks;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Social Media</h1>
          <p className="text-muted-foreground text-sm">Controle de produtividade de conteúdo</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[200px] text-center">{weekLabel}</span>
          <Button variant="outline" size="icon" onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Goals Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {categories?.map((cat) => {
          const stat = categoryStats[cat.id] || { completed: 0, total: 0, target: 0 };
          const pct = stat.target > 0 ? Math.min((stat.completed / stat.target) * 100, 100) : 0;
          return (
            <Card key={cat.id} className="relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: cat.color }} />
              <CardHeader className="pb-2 pl-5">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <span style={{ color: cat.color }}>{cat.name}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pl-5">
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-2xl font-bold">{stat.completed}</span>
                  <span className="text-muted-foreground text-sm">/ {stat.target || "—"}</span>
                </div>
                {stat.target > 0 && <Progress value={pct} className="h-1.5" />}
                <p className="text-xs text-muted-foreground mt-1">{stat.total} tarefa(s) criada(s)</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        {isManager && (
          <>
            <Button onClick={() => {
              const vals: Record<string, number> = {};
              categories?.forEach((c) => {
                const g = goals?.find((g) => g.category_id === c.id);
                vals[c.id] = g?.target_count ?? 0;
              });
              setGoalValues(vals);
              setShowGoalEditor(true);
            }}>
              <Target className="h-4 w-4 mr-2" />
              Definir Metas
            </Button>
            <Button onClick={() => setShowNewTask(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Tarefa
            </Button>
          </>
        )}
      </div>

      {/* Tasks List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tarefas da Semana</CardTitle>
          <CardDescription>{tasks?.length ?? 0} tarefa(s)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(!tasks || tasks.length === 0) && (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma tarefa para esta semana.</p>
          )}
          {tasks?.map((task) => {
            const cat = categories?.find((c) => c.id === task.category_id);
            const assignee = profiles?.find((p) => p.user_id === task.assigned_to);
            return (
              <div
                key={task.id}
                className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer hover:bg-accent/50 ${
                  task.status === "completed" ? "opacity-60 bg-muted/30" : ""
                }`}
                onClick={() => setSelectedTask(task)}
              >
                <Checkbox
                  checked={task.status === "completed"}
                  onCheckedChange={(checked) => {
                    if (checked) completeTask.mutate(task.id);
                    else uncompleteTask.mutate(task.id);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-medium text-sm ${task.status === "completed" ? "line-through" : ""}`}>
                      {task.title}
                    </span>
                    {cat && (
                      <Badge variant="outline" className="text-xs" style={{ borderColor: cat.color, color: cat.color }}>
                        {cat.name}
                      </Badge>
                    )}
                  </div>
                  {task.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{task.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    {task.due_date && <span>{format(new Date(task.due_date), "dd/MM")}</span>}
                    {assignee && <span>→ {assignee.name}</span>}
                    {task.proofs && task.proofs.length > 0 && (
                      <span className="flex items-center gap-1">
                        <ImagePlus className="h-3 w-3" />
                        {task.proofs.length} prova(s)
                      </span>
                    )}
                  </div>
                </div>
                {task.status === "completed" && <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Goal Editor Dialog */}
      <Dialog open={showGoalEditor} onOpenChange={setShowGoalEditor}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Metas da Semana</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {categories?.map((cat) => (
              <div key={cat.id} className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                <span className="text-sm font-medium flex-1">{cat.name}</span>
                <Input
                  type="number"
                  min={0}
                  className="w-20"
                  value={goalValues[cat.id] ?? 0}
                  onChange={(e) => setGoalValues({ ...goalValues, [cat.id]: parseInt(e.target.value) || 0 })}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={handleSaveGoals} disabled={saveGoal.isPending}>
              {saveGoal.isPending ? "Salvando..." : "Salvar Metas"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Task Dialog */}
      <Dialog open={showNewTask} onOpenChange={setShowNewTask}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Tarefa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Título da tarefa"
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
            />
            <Textarea
              placeholder="Descrição (opcional)"
              value={newTask.description}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
            />
            <Select value={newTask.category_id} onValueChange={(v) => setNewTask({ ...newTask, category_id: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                {categories?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={newTask.due_date}
              onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
            />
            <Select value={newTask.assigned_to} onValueChange={(v) => setNewTask({ ...newTask, assigned_to: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Responsável (opcional)" />
              </SelectTrigger>
              <SelectContent>
                {profiles?.map((p) => (
                  <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button onClick={handleCreateTask} disabled={createTask.isPending}>
              {createTask.isPending ? "Criando..." : "Criar Tarefa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Detail Dialog */}
      <Dialog open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTask(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedTask?.title}
              {selectedTask?.status === "completed" && <CheckCircle2 className="h-5 w-5 text-green-500" />}
            </DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4">
              {selectedTask.description && (
                <p className="text-sm text-muted-foreground">{selectedTask.description}</p>
              )}
              <div className="flex gap-2 flex-wrap text-xs text-muted-foreground">
                {selectedTask.due_date && <Badge variant="outline">{format(new Date(selectedTask.due_date), "dd/MM/yyyy")}</Badge>}
                {(() => { const cat = categories?.find(c => c.id === selectedTask.category_id); return cat ? <Badge variant="outline" style={{ borderColor: cat.color, color: cat.color }}>{cat.name}</Badge> : null; })()}
              </div>

              {/* Proofs */}
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <ImagePlus className="h-4 w-4" />
                  Provas ({selectedTask.proofs?.length ?? 0})
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  {selectedTask.proofs?.map((proof) => (
                    <div key={proof.id} className="relative group rounded-md overflow-hidden border">
                      <img src={proof.file_url} alt={proof.file_name || "Prova"} className="w-full h-24 object-cover" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-white" onClick={() => window.open(proof.file_url, "_blank")}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {isManager && (
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-white" onClick={() => { deleteProof.mutate(proof.id); setSelectedTask({ ...selectedTask, proofs: selectedTask.proofs?.filter(p => p.id !== proof.id) }); }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-1 py-0.5 truncate">
                        {proof.source === "whatsapp" ? "📱 WhatsApp" : "📤 Upload"}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file && selectedTask) handleUploadProof(selectedTask.id, file);
                      e.target.value = "";
                    }}
                  />
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-2" />
                    Enviar Prova
                  </Button>
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                {selectedTask.status !== "completed" ? (
                  <Button onClick={() => { completeTask.mutate(selectedTask.id); setSelectedTask({ ...selectedTask, status: "completed" }); }}>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Marcar Concluída
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => { uncompleteTask.mutate(selectedTask.id); setSelectedTask({ ...selectedTask, status: "pending" }); }}>
                    Reabrir
                  </Button>
                )}
                {isManager && (
                  <Button variant="destructive" size="sm" onClick={() => { deleteTask.mutate(selectedTask.id); setSelectedTask(null); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
