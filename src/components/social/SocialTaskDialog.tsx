import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Trash2, AlertCircle, Link as LinkIcon } from "lucide-react";
import { format, parseISO, isSameDay, isAfter } from "date-fns";
import { toast } from "sonner";
import {
  SocialTask, SocialCategory,
  PIPELINE_STATUSES, CONTENT_STRATEGY_TYPES, PipelineStatus,
  useSocialMutations
} from "@/hooks/useSocialMedia";
import { useGoogleDriveStatus } from "@/hooks/useGoogleDrive";
import DriveFileBrowser from "./DriveFileBrowser";

interface Props {
  task: SocialTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: SocialCategory[];
  profiles: { user_id: string; name: string }[];
  isManager: boolean;
}

export default function SocialTaskDialog({ task, open, onOpenChange, categories, profiles, isManager }: Props) {
  const { updateTask, completeTask, uncompleteTask, deleteTask } = useSocialMutations();
  const { data: driveStatus } = useGoogleDriveStatus();
  const [editing, setEditing] = useState(false);
  const [editValues, setEditValues] = useState<Partial<SocialTask>>({});
  const [postLink, setPostLink] = useState("");

  useEffect(() => {
    if (task) {
      setEditValues({
        title: task.title,
        description: task.description,
        category_id: task.category_id,
        due_date: task.due_date,
        assigned_to: task.assigned_to,
        pipeline_status: task.pipeline_status,
        content_strategy_type: task.content_strategy_type,
      });
      setPostLink(task.post_link || "");
      setEditing(false);
    }
  }, [task]);

  if (!task) return null;

  const cat = categories.find(c => c.id === task.category_id);
  const hasLink = !!task.post_link;
  const pipelineInfo = PIPELINE_STATUSES.find(p => p.value === task.pipeline_status);
  const strategyLabel = CONTENT_STRATEGY_TYPES.find(s => s.value === task.content_strategy_type)?.label;

  const getDeadline = () => {
    if (!task.due_date) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const due = parseISO(task.due_date); due.setHours(0, 0, 0, 0);
    if (isSameDay(due, today)) return { color: "hsl(var(--warning))", label: "Vence hoje" };
    if (isAfter(today, due)) return { color: "hsl(var(--destructive))", label: "Atrasado" };
    return { color: "hsl(var(--success))", label: "No prazo" };
  };
  const deadline = getDeadline();

  const handleComplete = () => {
    if (!hasLink) {
      toast.error("Adicione o link da publicação antes de concluir");
      return;
    }
    completeTask.mutate(task.id);
    onOpenChange(false);
  };

  const handleSaveEdit = async () => {
    try {
      await updateTask.mutateAsync({
        id: task.id,
        ...editValues,
        post_link: postLink || null,
      } as any);
      toast.success("Conteúdo atualizado!");
      setEditing(false);
      onOpenChange(false);
    } catch {
      toast.error("Erro ao atualizar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6">
            {editing ? (
              <Input value={editValues.title || ""} onChange={e => setEditValues({ ...editValues, title: e.target.value })} className="text-lg font-semibold" />
            ) : (
              <>
                {task.title}
                {task.status === "completed" && <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />}
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status badges */}
          <div className="flex gap-2 flex-wrap">
            {pipelineInfo && (
              <Badge style={{ backgroundColor: pipelineInfo.color, color: "white" }} className="text-xs">
                {pipelineInfo.label}
              </Badge>
            )}
            {cat && (
              <Badge variant="outline" style={{ borderColor: cat.color, color: cat.color }}>{cat.name}</Badge>
            )}
            {strategyLabel && <Badge variant="secondary">{strategyLabel}</Badge>}
            {deadline && task.status !== "completed" && (
              <Badge variant="outline" style={{ borderColor: deadline.color, color: deadline.color }}>
                {deadline.label}
              </Badge>
            )}
            {hasLink ? (
              <Badge variant="outline" className="text-green-500 border-green-500/30">
                <LinkIcon className="h-3 w-3 mr-1" /> Link adicionado
              </Badge>
            ) : (
              <Badge variant="outline" className="text-amber-500 border-amber-500/30">
                <AlertCircle className="h-3 w-3 mr-1" /> Link pendente
              </Badge>
            )}
          </div>

          {editing ? (
            <div className="space-y-3">
              <Textarea
                placeholder="Descrição"
                value={editValues.description || ""}
                onChange={e => setEditValues({ ...editValues, description: e.target.value })}
              />
              <Select value={editValues.category_id} onValueChange={v => setEditValues({ ...editValues, category_id: v })}>
                <SelectTrigger><SelectValue placeholder="Tipo de conteúdo" /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={editValues.pipeline_status} onValueChange={v => setEditValues({ ...editValues, pipeline_status: v as PipelineStatus })}>
                <SelectTrigger><SelectValue placeholder="Pipeline" /></SelectTrigger>
                <SelectContent>
                  {PIPELINE_STATUSES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={editValues.content_strategy_type || "none"} onValueChange={v => setEditValues({ ...editValues, content_strategy_type: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Tipo estratégico" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {CONTENT_STRATEGY_TYPES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input type="date" value={editValues.due_date || ""} onChange={e => setEditValues({ ...editValues, due_date: e.target.value })} />
              <Select value={editValues.assigned_to || "none"} onValueChange={v => setEditValues({ ...editValues, assigned_to: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Responsável" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {profiles.map(p => <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Link da publicação</label>
                <Input
                  placeholder="https://instagram.com/..."
                  value={postLink}
                  onChange={e => setPostLink(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <>
              {task.description && <p className="text-sm text-muted-foreground">{task.description}</p>}
              <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
                {task.due_date && <span>📅 {format(parseISO(task.due_date), "dd/MM/yyyy")}</span>}
                {(() => { const a = profiles.find(p => p.user_id === task.assigned_to); return a ? <span>👤 {a.name}</span> : null; })()}
              </div>
              {task.post_link && (
                <a href={task.post_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                  <LinkIcon className="h-3 w-3" /> {task.post_link}
                </a>
              )}
            </>
          )}


          <DialogFooter className="flex-col sm:flex-row gap-2">
            {editing ? (
              <>
                <Button variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
                <Button onClick={handleSaveEdit} disabled={updateTask.isPending}>Salvar</Button>
              </>
            ) : (
              <>
                {isManager && <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Editar</Button>}
                {task.status !== "completed" ? (
                  <Button onClick={handleComplete} disabled={completeTask.isPending}>
                    <CheckCircle2 className="h-4 w-4 mr-2" /> Concluir
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => { uncompleteTask.mutate(task.id); onOpenChange(false); }}>Reabrir</Button>
                )}
                {isManager && (
                  <Button variant="destructive" size="sm" onClick={() => { deleteTask.mutate(task.id); onOpenChange(false); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
