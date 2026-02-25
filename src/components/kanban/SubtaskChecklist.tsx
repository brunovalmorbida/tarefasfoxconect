import { useState } from "react";
import { useSubtasks } from "@/hooks/useSubtasks";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  taskId: string;
}

export function SubtaskChecklist({ taskId }: Props) {
  const { subtasks, addSubtask, toggleSubtask, deleteSubtask, completedCount, totalCount, progressPct } = useSubtasks(taskId);
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    await addSubtask.mutateAsync(newTitle.trim());
    setNewTitle("");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Subtarefas</span>
          {totalCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {completedCount}/{totalCount}
            </span>
          )}
        </div>
        {!adding && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setAdding(true)}>
            <Plus className="h-3 w-3 mr-1" /> Adicionar
          </Button>
        )}
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-300",
              progressPct >= 100 ? "bg-emerald-500" : progressPct >= 50 ? "bg-primary" : "bg-primary/60"
            )}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      {/* Subtask list */}
      <div className="space-y-1">
        {subtasks.map((sub) => (
          <div key={sub.id} className="flex items-center gap-2 group py-1 px-1 rounded hover:bg-muted/50">
            <Checkbox
              checked={sub.is_completed}
              onCheckedChange={(checked) =>
                toggleSubtask.mutate({ id: sub.id, is_completed: !!checked })
              }
            />
            <span
              className={cn(
                "text-sm flex-1",
                sub.is_completed && "line-through text-muted-foreground"
              )}
            >
              {sub.title}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => deleteSubtask.mutate(sub.id)}
            >
              <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          </div>
        ))}
      </div>

      {/* Add input */}
      {adding && (
        <div className="flex gap-2">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Nova subtarefa..."
            className="h-8 text-sm"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
              if (e.key === "Escape") { setAdding(false); setNewTitle(""); }
            }}
          />
          <Button size="sm" className="h-8" onClick={handleAdd} disabled={!newTitle.trim()}>
            Adicionar
          </Button>
          <Button size="sm" variant="ghost" className="h-8" onClick={() => { setAdding(false); setNewTitle(""); }}>
            Cancelar
          </Button>
        </div>
      )}
    </div>
  );
}

/** Compact progress indicator for task cards */
export function SubtaskProgress({ taskId }: { taskId: string }) {
  const { completedCount, totalCount, progressPct } = useSubtasks(taskId);
  if (totalCount === 0) return null;

  return (
    <div className="flex items-center gap-1.5 w-full">
      <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            progressPct >= 100 ? "bg-emerald-500" : "bg-primary/70"
          )}
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
        {completedCount}/{totalCount}
      </span>
    </div>
  );
}
