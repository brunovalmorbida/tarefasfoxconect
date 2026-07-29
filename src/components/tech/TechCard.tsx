import { Draggable } from "@hello-pangea/dnd";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCity } from "@/lib/techSchedule";
import type { TechAppointment } from "@/hooks/useTechAppointments";

interface Props {
  appointment: TechAppointment;
  index: number;
  onDone?: () => void;
  onDelete?: () => void;
}

export function TechCard({ appointment, index, onDone, onDelete }: Props) {
  const city = getCity(appointment.city);

  return (
    <Draggable draggableId={appointment.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={cn(
            "group rounded-xl border border-l-4 bg-card p-2.5 shadow-sm transition-shadow hover:shadow-md",
            city.accentClass,
            snapshot.isDragging && "shadow-lg"
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold leading-tight">{appointment.client_name}</p>
            <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              {onDone && (
                <button
                  onClick={onDone}
                  title="Concluir / arquivar"
                  className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={onDelete}
                  title="Excluir"
                  className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
          <span
            className={cn(
              "mt-1.5 inline-block rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              city.badgeClass
            )}
          >
            {city.name}
          </span>
        </div>
      )}
    </Draggable>
  );
}
