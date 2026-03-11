import { useState, useMemo, useRef } from "react";
import { format, startOfWeek, addWeeks, subWeeks, parseISO, isSameDay, isAfter, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Loader2, ChevronLeft, ChevronRight, Plus, Target, CheckCircle2,
  ImagePlus, Trash2, Eye, Upload, LayoutDashboard, List, Columns3,
  AlertCircle, Link as LinkIcon, Sparkles, Settings2
} from "lucide-react";
import { toast } from "sonner";
import {
  useCategories, useWeekGoals, useWeekTasks, useAllTasks, useMonthTasks, useAutoGoals,
  useSocialMutations, SocialTask, PIPELINE_STATUSES, CONTENT_STRATEGY_TYPES, PipelineStatus,
} from "@/hooks/useSocialMedia";
import { useIsAppAdmin, useCanManage } from "@/hooks/useUserRole";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import SocialPipeline from "@/components/social/SocialPipeline";
import SocialTaskDialog from "@/components/social/SocialTaskDialog";

function getDeadlineInfo(dueDate: string | null) {
  if (!dueDate) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = parseISO(dueDate); due.setHours(0, 0, 0, 0);
  if (isSameDay(due, today)) return { color: "hsl(var(--warning))", label: "Hoje", variant: "warning" as const };
  if (isAfter(today, due)) return { color: "hsl(var(--destructive))", label: "Atrasado", variant: "destructive" as const };
  return { color: "hsl(var(--success))", label: "No prazo", variant: "success" as const };
}

export default function SocialMedia() {
  const { data: isAdmin } = useIsAppAdmin();
  const canManage = useCanManage("can_manage_social");
  const isManager = isAdmin || canManage;

  const [currentWeek, setCurrentWeek] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const weekStart = format(currentWeek, "yyyy-MM-dd");

  const { data: categories, isLoading: loadingCats } = useCategories();
  const { data: goals, isLoading: loadingGoals } = useWeekGoals(weekStart);
  const { data: tasks, isLoading: loadingTasks } = useWeekTasks(weekStart);
  const { data: allTasks } = useAllTasks();
  const { data: monthTasks } = useMonthTasks(new Date());
  const { data: autoGoals } = useAutoGoals();
  const mutations = useSocialMutations();

  const [activeTab, setActiveTab] = useState("dashboard");
  const [showNewTask, setShowNewTask] = useState(false);
  const [showGoalEditor, setShowGoalEditor] = useState(false);
  const [showAutoGoals, setShowAutoGoals] = useState(false);
  const [selectedTask, setSelectedTask] = useState<SocialTask | null>(null);
  const [newTask, setNewTask] = useState({
    title: "", description: "", category_id: "", due_date: "",
    assigned_to: "", pipeline_status: "idea" as PipelineStatus,
    content_strategy_type: "",
  });
  const [goalValues, setGoalValues] = useState<Record<string, number>>({});
  const [autoGoalValues, setAutoGoalValues] = useState<Record<string, { target: number; auto: boolean; assignee: string }>>({});

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

  // Stats
  const categoryStats = useMemo(() => {
    if (!categories) return {};
    const stats: Record<string, { completed: number; total: number; target: number }> = {};
    categories.forEach(cat => {
      const catTasks = tasks?.filter(t => t.category_id === cat.id) ?? [];
      const goal = goals?.find(g => g.category_id === cat.id);
      stats[cat.id] = {
        completed: catTasks.filter(t => t.status === "completed" || t.pipeline_status === "published").length,
        total: catTasks.length,
        target: goal?.target_count ?? 0,
      };
    });
    return stats;
  }, [categories, tasks, goals]);

  const weekPublished = useMemo(() => tasks?.filter(t => t.pipeline_status === "published").length ?? 0, [tasks]);
  const monthPublished = useMemo(() => monthTasks?.filter(t => t.pipeline_status === "published").length ?? 0, [monthTasks]);

  // Pipeline tasks (all non-completed for the pipeline view)
  const pipelineTasks = useMemo(() => {
    return allTasks?.filter(t => t.pipeline_status !== "published" || t.status !== "completed") ?? [];
  }, [allTasks]);

  const handleSaveGoals = async () => {
    if (!categories) return;
    try {
      for (const cat of categories) {
        const val = goalValues[cat.id];
        if (val !== undefined && val >= 0) {
          await mutations.saveGoal.mutateAsync({ category_id: cat.id, week_start: weekStart, target_count: val });
        }
      }
      toast.success("Metas salvas!");
      setShowGoalEditor(false);
    } catch { toast.error("Erro ao salvar metas"); }
  };

  const handleCreateTask = async () => {
    if (!newTask.title || !newTask.category_id) {
      toast.error("Preencha título e tipo de conteúdo");
      return;
    }
    try {
      const goal = goals?.find(g => g.category_id === newTask.category_id);
      await mutations.createTask.mutateAsync({
        ...newTask,
        goal_id: goal?.id,
        due_date: newTask.due_date || format(currentWeek, "yyyy-MM-dd"),
        assigned_to: newTask.assigned_to || undefined,
        content_strategy_type: newTask.content_strategy_type || undefined,
      });
      toast.success("Conteúdo criado!");
      setShowNewTask(false);
      setNewTask({ title: "", description: "", category_id: "", due_date: "", assigned_to: "", pipeline_status: "idea", content_strategy_type: "" });
    } catch { toast.error("Erro ao criar conteúdo"); }
  };

  const handleSaveAutoGoals = async () => {
    try {
      for (const [catId, val] of Object.entries(autoGoalValues)) {
        await mutations.saveAutoGoal.mutateAsync({
          category_id: catId,
          target_count: val.target,
          auto_create: val.auto,
          default_assigned_to: val.assignee || undefined,
        });
      }
      toast.success("Configuração salva!");
      setShowAutoGoals(false);
    } catch { toast.error("Erro ao salvar configuração"); }
  };

  const handleGenerateWeekTasks = async () => {
    if (!autoGoals || !categories) return;
    try {
      const count = await mutations.generateWeekTasks.mutateAsync({ weekStart, autoGoals, categories });
      if (count > 0) toast.success(`${count} tarefa(s) criada(s) automaticamente!`);
      else toast.info("Nenhuma meta automática configurada.");
    } catch { toast.error("Erro ao gerar tarefas"); }
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
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Social Media</h1>
          <p className="text-muted-foreground text-sm">Produção e controle de conteúdo orgânico</p>
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="dashboard" className="gap-1.5"><LayoutDashboard className="h-4 w-4" /> Dashboard</TabsTrigger>
          <TabsTrigger value="tasks" className="gap-1.5"><List className="h-4 w-4" /> Tarefas</TabsTrigger>
          <TabsTrigger value="pipeline" className="gap-1.5"><Columns3 className="h-4 w-4" /> Pipeline</TabsTrigger>
        </TabsList>

        {/* ===== DASHBOARD ===== */}
        <TabsContent value="dashboard" className="space-y-6">
          {/* Weekly stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {categories?.map(cat => {
              const stat = categoryStats[cat.id] || { completed: 0, total: 0, target: 0 };
              const pct = stat.target > 0 ? Math.min((stat.completed / stat.target) * 100, 100) : 0;
              return (
                <Card key={cat.id} className="relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: cat.color }} />
                  <CardHeader className="pb-2 pl-5 py-3">
                    <CardTitle className="text-xs font-medium" style={{ color: cat.color }}>{cat.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="pl-5 pb-3">
                    <div className="flex items-baseline gap-1 mb-1">
                      <span className="text-xl font-bold">{stat.completed}</span>
                      <span className="text-muted-foreground text-xs">/ {stat.target || "—"}</span>
                    </div>
                    {stat.target > 0 && <Progress value={pct} className="h-1" />}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Published stats */}
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="py-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Publicados na semana</p>
                  <p className="text-2xl font-bold">{weekPublished}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Publicados no mês</p>
                  <p className="text-2xl font-bold">{monthPublished}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Actions */}
          {isManager && (
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => {
                const vals: Record<string, number> = {};
                categories?.forEach(c => { vals[c.id] = goals?.find(g => g.category_id === c.id)?.target_count ?? 0; });
                setGoalValues(vals);
                setShowGoalEditor(true);
              }}>
                <Target className="h-4 w-4 mr-2" /> Definir Metas
              </Button>
              <Button variant="outline" onClick={() => {
                const vals: Record<string, { target: number; auto: boolean; assignee: string }> = {};
                categories?.forEach(c => {
                  const ag = autoGoals?.find(a => a.category_id === c.id);
                  vals[c.id] = { target: ag?.target_count ?? 0, auto: ag?.auto_create ?? false, assignee: ag?.default_assigned_to ?? "" };
                });
                setAutoGoalValues(vals);
                setShowAutoGoals(true);
              }}>
                <Settings2 className="h-4 w-4 mr-2" /> Metas Automáticas
              </Button>
              <Button variant="outline" onClick={handleGenerateWeekTasks} disabled={mutations.generateWeekTasks.isPending}>
                <Sparkles className="h-4 w-4 mr-2" /> Gerar Tarefas da Semana
              </Button>
              <Button onClick={() => setShowNewTask(true)}>
                <Plus className="h-4 w-4 mr-2" /> Novo Conteúdo
              </Button>
            </div>
          )}
        </TabsContent>

        {/* ===== TASKS LIST ===== */}
        <TabsContent value="tasks" className="space-y-4">
          {isManager && (
            <div className="flex gap-2">
              <Button onClick={() => setShowNewTask(true)} size="sm">
                <Plus className="h-4 w-4 mr-2" /> Novo Conteúdo
              </Button>
            </div>
          )}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Conteúdos da Semana</CardTitle>
              <CardDescription>{tasks?.length ?? 0} conteúdo(s)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {(!tasks || tasks.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum conteúdo para esta semana.</p>
              )}
              {tasks?.map(task => {
                const cat = categories?.find(c => c.id === task.category_id);
                const assignee = profiles?.find(p => p.user_id === task.assigned_to);
                const deadline = getDeadlineInfo(task.due_date);
                const hasLink = !!task.post_link;
                const pipelineInfo = PIPELINE_STATUSES.find(p => p.value === task.pipeline_status);
                const strategyLabel = CONTENT_STRATEGY_TYPES.find(s => s.value === task.content_strategy_type)?.label;

                return (
                  <div
                    key={task.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer hover:bg-accent/50 ${
                      task.status === "completed" ? "opacity-60 bg-muted/30" : ""
                    }`}
                    onClick={() => setSelectedTask(task)}
                  >
                    {/* Deadline indicator */}
                    {deadline && task.status !== "completed" && (
                      <div className="w-1.5 h-full min-h-[40px] rounded-full shrink-0 self-stretch" style={{ backgroundColor: deadline.color }} />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-medium text-sm ${task.status === "completed" ? "line-through" : ""}`}>
                          {task.title}
                        </span>
                        {cat && (
                          <Badge variant="outline" className="text-[10px]" style={{ borderColor: cat.color, color: cat.color }}>
                            {cat.name}
                          </Badge>
                        )}
                        {pipelineInfo && (
                          <Badge className="text-[10px]" style={{ backgroundColor: pipelineInfo.color, color: "white" }}>
                            {pipelineInfo.label}
                          </Badge>
                        )}
                        {strategyLabel && <Badge variant="secondary" className="text-[10px]">{strategyLabel}</Badge>}
                      </div>
                      {task.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{task.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {task.due_date && (
                          <span style={{ color: deadline?.color }}>
                            {format(parseISO(task.due_date), "dd/MM")}
                          </span>
                        )}
                        {assignee && <span>→ {assignee.name}</span>}
                        {hasLink ? (
                          <span className="flex items-center gap-1 text-green-500">
                            <LinkIcon className="h-3 w-3" /> Link
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-amber-500">
                            <AlertCircle className="h-3 w-3" /> Sem link
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
        </TabsContent>

        {/* ===== PIPELINE ===== */}
        <TabsContent value="pipeline">
          {isManager && (
            <div className="flex gap-2 mb-4">
              <Button onClick={() => setShowNewTask(true)} size="sm">
                <Plus className="h-4 w-4 mr-2" /> Novo Conteúdo
              </Button>
            </div>
          )}
          <SocialPipeline
            tasks={allTasks ?? []}
            categories={categories ?? []}
            profiles={profiles ?? []}
            onUpdatePipeline={(id, status) => {
              mutations.updatePipelineStatus.mutate({ id, pipeline_status: status });
            }}
            onSelectTask={setSelectedTask}
          />
        </TabsContent>
      </Tabs>

      {/* Task Detail Dialog */}
      <SocialTaskDialog
        task={selectedTask}
        open={!!selectedTask}
        onOpenChange={open => { if (!open) setSelectedTask(null); }}
        categories={categories ?? []}
        profiles={profiles ?? []}
        isManager={isManager}
      />

      {/* Goal Editor Dialog */}
      <Dialog open={showGoalEditor} onOpenChange={setShowGoalEditor}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Metas da Semana</DialogTitle>
            <DialogDescription>Defina quantos conteúdos devem ser produzidos nesta semana.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {categories?.map(cat => (
              <div key={cat.id} className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                <span className="text-sm font-medium flex-1">{cat.name}</span>
                <Input
                  type="number" min={0} className="w-20"
                  value={goalValues[cat.id] ?? 0}
                  onChange={e => setGoalValues({ ...goalValues, [cat.id]: parseInt(e.target.value) || 0 })}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={handleSaveGoals} disabled={mutations.saveGoal.isPending}>
              {mutations.saveGoal.isPending ? "Salvando..." : "Salvar Metas"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Auto Goals Config Dialog */}
      <Dialog open={showAutoGoals} onOpenChange={setShowAutoGoals}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Metas Automáticas Semanais</DialogTitle>
            <DialogDescription>Configure metas fixas e geração automática de tarefas.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {categories?.map(cat => {
              const val = autoGoalValues[cat.id] || { target: 0, auto: false, assignee: "" };
              return (
                <div key={cat.id} className="space-y-2 p-3 rounded-lg border">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                    <span className="text-sm font-medium flex-1">{cat.name}</span>
                    <Input
                      type="number" min={0} className="w-16"
                      value={val.target}
                      onChange={e => setAutoGoalValues({ ...autoGoalValues, [cat.id]: { ...val, target: parseInt(e.target.value) || 0 } })}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={val.auto}
                      onCheckedChange={checked => setAutoGoalValues({ ...autoGoalValues, [cat.id]: { ...val, auto: checked } })}
                    />
                    <span className="text-xs text-muted-foreground">Criar tarefas automaticamente</span>
                  </div>
                  {val.auto && (
                    <Select value={val.assignee || "none"} onValueChange={v => setAutoGoalValues({ ...autoGoalValues, [cat.id]: { ...val, assignee: v === "none" ? "" : v } })}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Responsável padrão" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {profiles?.map(p => <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button onClick={handleSaveAutoGoals} disabled={mutations.saveAutoGoal.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Content Dialog */}
      <Dialog open={showNewTask} onOpenChange={setShowNewTask}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Conteúdo</DialogTitle>
            <DialogDescription>Adicione um novo conteúdo ao pipeline de produção.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Título do conteúdo"
              value={newTask.title}
              onChange={e => setNewTask({ ...newTask, title: e.target.value })}
            />
            <Textarea
              placeholder="Descrição (opcional)"
              value={newTask.description}
              onChange={e => setNewTask({ ...newTask, description: e.target.value })}
            />
            <Select value={newTask.category_id} onValueChange={v => setNewTask({ ...newTask, category_id: v })}>
              <SelectTrigger><SelectValue placeholder="Tipo de conteúdo" /></SelectTrigger>
              <SelectContent>
                {categories?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={newTask.content_strategy_type} onValueChange={v => setNewTask({ ...newTask, content_strategy_type: v })}>
              <SelectTrigger><SelectValue placeholder="Tipo estratégico (opcional)" /></SelectTrigger>
              <SelectContent>
                {CONTENT_STRATEGY_TYPES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={newTask.pipeline_status} onValueChange={v => setNewTask({ ...newTask, pipeline_status: v as PipelineStatus })}>
              <SelectTrigger><SelectValue placeholder="Etapa do pipeline" /></SelectTrigger>
              <SelectContent>
                {PIPELINE_STATUSES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={newTask.due_date}
              onChange={e => setNewTask({ ...newTask, due_date: e.target.value })}
            />
            <Select value={newTask.assigned_to} onValueChange={v => setNewTask({ ...newTask, assigned_to: v })}>
              <SelectTrigger><SelectValue placeholder="Responsável (opcional)" /></SelectTrigger>
              <SelectContent>
                {profiles?.map(p => <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button onClick={handleCreateTask} disabled={mutations.createTask.isPending}>
              {mutations.createTask.isPending ? "Criando..." : "Criar Conteúdo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
