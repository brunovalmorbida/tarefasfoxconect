import { Draggable, Droppable } from "@hello-pangea/dnd";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { UNASSIGNED, type CityConfig } from "@/lib/techSchedule";
import { AppointmentCard } from "./AppointmentCard";
import type { TechAppointment } from "@/hooks/useTechAppointments";

interface Props {
  city: CityConfig;
  technicians: string[];
  appointments: TechAppointment[];
  onCardClick: (a: TechAppointment) => void;
  onForward: (a: TechAppointment) => void;
}

export function CityBoard({ city, technicians, appointments, onCardClick, onForward }: Props) {
  const columns = [UNASSIGNED, ...technicians];

  return (
    <Droppable droppableId={`columns::${city.name}`} type="COLUMN" direction="horizontal">
      {(colsProvided) => (
        <div
          ref={colsProvided.innerRef}
          {...colsProvided.droppableProps}
          className="flex gap-4 overflow-x-auto pb-3"
        >
          {columns.map((col, colIndex) => {
            const isUnassigned = col === UNASSIGNED;
            const items = appointments
              .filter((a) => (isUnassigned ? !a.technician : a.technician === col))
              .sort((a, b) => a.position - b.position);

            const inner = (
              <Droppable droppableId={`${city.name}::${col}`} type="CARD">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      "flex min-h-[80px] flex-col gap-2 rounded-lg p-0.5",
                      snapshot.isDraggingOver && "bg-accent"
                    )}
                  >
                    {items.map((a, i) => (
                      <AppointmentCard
                        key={a.id}
                        appointment={a}
                        index={i}
                        onClick={() => onCardClick(a)}
                        onForward={() => onForward(a)}
                      />
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            );

            const header = (dragHandle?: React.HTMLAttributes<HTMLElement>) => (
              <div className="mb-2 flex items-center justify-between gap-1 px-1">
                <div className="flex min-w-0 items-center gap-1">
                  {dragHandle && (
                    <span
                      {...dragHandle}
                      className="cursor-grab text-muted-foreground/60 hover:text-foreground active:cursor-grabbing"
                      title="Arraste para reordenar o técnico"
                    >
                      <GripVertical className="h-3.5 w-3.5" />
                    </span>
                  )}
                  <span className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {col}
                  </span>
                </div>
                <span className="rounded-full bg-background px-2 text-[10px] font-medium text-muted-foreground">
                  {items.length}
                </span>
              </div>
            );

            if (isUnassigned) {
              return (
                <div
                  key={col}
                  className="flex w-[260px] shrink-0 flex-col rounded-xl border border-dashed bg-muted/50 p-2"
                >
                  {header()}
                  {inner}
                </div>
              );
            }

            return (
              <Draggable key={col} draggableId={`col-${city.name}-${col}`} index={colIndex - 1}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className={cn(
                      "flex w-[260px] shrink-0 flex-col rounded-xl border bg-muted/30 p-2",
                      snapshot.isDragging && "shadow-lg"
                    )}
                  >
                    {header(provided.dragHandleProps ?? undefined)}
                    {inner}
                  </div>
                )}
              </Draggable>
            );
          })}
          {colsProvided.placeholder}
        </div>
      )}
    </Droppable>
  );
}
