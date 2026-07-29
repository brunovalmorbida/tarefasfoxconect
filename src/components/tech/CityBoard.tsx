import { Droppable } from "@hello-pangea/dnd";
import { cn } from "@/lib/utils";
import { UNASSIGNED, type CityConfig } from "@/lib/techSchedule";
import { AppointmentCard } from "./AppointmentCard";
import type { TechAppointment } from "@/hooks/useTechAppointments";

interface Props {
  city: CityConfig;
  appointments: TechAppointment[];
  onCardClick: (a: TechAppointment) => void;
  onForward: (a: TechAppointment) => void;
}

export function CityBoard({ city, appointments, onCardClick, onForward }: Props) {
  const columns = [UNASSIGNED, ...city.technicians];

  return (
    <div className="flex gap-4 overflow-x-auto pb-3">
      {columns.map((col) => {
        const isUnassigned = col === UNASSIGNED;
        const items = appointments
          .filter((a) => (isUnassigned ? !a.technician : a.technician === col))
          .sort((a, b) => a.position - b.position);

        return (
          <Droppable key={col} droppableId={`${city.name}::${col}`}>
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={cn(
                  "flex w-[260px] shrink-0 flex-col rounded-xl border bg-muted/30 p-2",
                  isUnassigned && "border-dashed bg-muted/50",
                  snapshot.isDraggingOver && "bg-accent"
                )}
              >
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {col}
                  </span>
                  <span className="rounded-full bg-background px-2 text-[10px] font-medium text-muted-foreground">
                    {items.length}
                  </span>
                </div>
                <div className="flex min-h-[80px] flex-col gap-2">
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
              </div>
            )}
          </Droppable>
        );
      })}
    </div>
  );
}
