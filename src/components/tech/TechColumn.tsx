import { Droppable } from "@hello-pangea/dnd";
import { cn } from "@/lib/utils";
import { TechCard } from "./TechCard";
import type { TechAppointment } from "@/hooks/useTechAppointments";

interface Props {
  droppableId: string;
  title: string;
  items: TechAppointment[];
  className?: string;
  onDone?: (a: TechAppointment) => void;
  onDelete?: (a: TechAppointment) => void;
}

export function TechColumn({ droppableId, title, items, className, onDone, onDelete }: Props) {
  return (
    <div className={cn("flex w-[220px] shrink-0 flex-col rounded-xl border bg-muted/30 p-2", className)}>
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </span>
        <span className="rounded-full bg-background px-2 text-[10px] font-medium text-muted-foreground">
          {items.length}
        </span>
      </div>
      <Droppable droppableId={droppableId} type="CARD">
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "flex min-h-[120px] flex-1 flex-col gap-2 rounded-lg p-0.5",
              snapshot.isDraggingOver && "bg-accent"
            )}
          >
            {items.map((a, i) => (
              <TechCard
                key={a.id}
                appointment={a}
                index={i}
                onDone={onDone ? () => onDone(a) : undefined}
                onDelete={onDelete ? () => onDelete(a) : undefined}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}
