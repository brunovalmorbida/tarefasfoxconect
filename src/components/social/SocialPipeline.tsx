import { useMemo } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Badge } from "@/components/ui/badge";
import { PIPELINE_STATUSES, CONTENT_STRATEGY_TYPES, SocialTask, SocialCategory, PipelineStatus } from "@/hooks/useSocialMedia";
import { format, isAfter, isSameDay, parseISO } from "date-fns";
import { ImagePlus, Link as LinkIcon, AlertCircle, CheckCircle2 } from "lucide-react";

interface Props {
  tasks: SocialTask[];
  categories: SocialCategory[];
  profiles: { user_id: string; name: string }[];
  onUpdatePipeline: (id: string, status: PipelineStatus) => void;
  onSelectTask: (task: SocialTask) => void;
}

function getDeadlineColor(dueDate: string | null): { color: string; label: string } | null {
  if (!dueDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = parseISO(dueDate);
  due.setHours(0, 0, 0, 0);

  if (isSameDay(due, today)) return { color: "hsl(var(--warning))", label: "Hoje" };
  if (isAfter(today, due)) return { color: "hsl(var(--destructive))", label: "Atrasado" };
  return { color: "hsl(var(--success))", label: "No prazo" };
}

export default function SocialPipeline({ tasks, categories, profiles, onUpdatePipeline, onSelectTask }: Props) {
  const columns = useMemo(() => {
    const map: Record<string, SocialTask[]> = {};
    PIPELINE_STATUSES.forEach(s => { map[s.value] = []; });
    tasks.forEach(t => {
      const status = t.pipeline_status || "idea";
      if (map[status]) map[status].push(t);
      else map["idea"].push(t);
    });
    return map;
  }, [tasks]);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const taskId = result.draggableId;
    const newStatus = result.destination.droppableId as PipelineStatus;
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.pipeline_status === newStatus) return;

    // If moving to published, require proof
    if (newStatus === "published" && (!task.proofs || task.proofs.length === 0) && !task.post_link) {
      return; // silently prevent - the card will snap back
    }
    onUpdatePipeline(taskId, newStatus);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: 400 }}>
        {PIPELINE_STATUSES.map(ps => (
          <div key={ps.value} className="flex-shrink-0 w-[260px]">
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ps.color }} />
              <span className="text-sm font-semibold">{ps.label}</span>
              <Badge variant="secondary" className="text-xs ml-auto">{columns[ps.value]?.length ?? 0}</Badge>
            </div>
            <Droppable droppableId={ps.value}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`space-y-2 min-h-[300px] rounded-lg p-2 transition-colors ${
                    snapshot.isDraggingOver ? "bg-accent/60" : "bg-muted/30"
                  }`}
                >
                  {columns[ps.value]?.map((task, idx) => {
                    const cat = categories.find(c => c.id === task.category_id);
                    const assignee = profiles.find(p => p.user_id === task.assigned_to);
                    const deadline = getDeadlineColor(task.due_date);
                    const hasLink = !!task.post_link;
                    const strategyLabel = CONTENT_STRATEGY_TYPES.find(s => s.value === task.content_strategy_type)?.label;

                    return (
                      <Draggable key={task.id} draggableId={task.id} index={idx}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`rounded-lg border bg-card p-3 cursor-pointer transition-shadow ${
                              snapshot.isDragging ? "shadow-lg ring-2 ring-primary/30" : "hover:shadow-md"
                            }`}
                            onClick={() => onSelectTask(task)}
                          >
                            <p className="text-sm font-medium leading-tight mb-1.5">{task.title}</p>
                            <div className="flex items-center gap-1.5 flex-wrap mb-2">
                              {cat && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0" style={{ borderColor: cat.color, color: cat.color }}>
                                  {cat.name}
                                </Badge>
                              )}
                              {strategyLabel && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                  {strategyLabel}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                              <div className="flex items-center gap-2">
                                {task.due_date && (
                                  <span className="flex items-center gap-1" style={{ color: deadline?.color }}>
                                    {format(parseISO(task.due_date), "dd/MM")}
                                  </span>
                                )}
                                {assignee && <span className="truncate max-w-[80px]">{assignee.name.split(" ")[0]}</span>}
                              </div>
                              <div className="flex items-center gap-1.5">
                                {task.post_link && <LinkIcon className="h-3 w-3 text-primary" />}
                                {hasProof ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                                ) : (
                                  <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                                )}
                              </div>
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
        ))}
      </div>
    </DragDropContext>
  );
}
