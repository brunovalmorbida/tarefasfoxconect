import { Draggable } from "@hello-pangea/dnd";
import { CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getCity } from "@/lib/techSchedule";
import type { TechAppointment } from "@/hooks/useTechAppointments";

interface Props {
  appointment: TechAppointment;
  index: number;
  onClick: () => void;
  onForward: () => void;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

export function isToday(a: TechAppointment) {
  return a.scheduled_date === todayISO();
}

export function isPast(a: TechAppointment) {
  if (!a.scheduled_date) return false;
  const time = a.scheduled_time?.slice(0, 5) ?? "23:59";
  return new Date(`${a.scheduled_date}T${time}:00`) < new Date();
}

export function formatDate(date: string | null) {
  if (!date) return "—";
  const [, m, d] = date.split("-");
  return `${d}/${m}`;
}

export function AppointmentCard({ appointment, index, onClick, onForward }: Props) {
  const city = getCity(appointment.city);
  const past = isPast(appointment);
  const today = isToday(appointment);
  const waiting = !appointment.technician;

  return (
    <Draggable draggableId={appointment.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onClick}
          className={cn(
            "group cursor-pointer rounded-xl border border-l-4 bg-card p-3 shadow-sm transition-shadow hover:shadow-md",
            city.accentClass,
            today && "ring-1 ring-primary/40",
            past && "opacity-80 border-dashed",
            waiting && "bg-muted/40",
            snapshot.isDragging && "shadow-lg"
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <span
              className={cn(
                "inline-block rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                city.badgeClass
              )}
            >
              {city.name}
            </span>
            {today && (
              <span className="flex items-center gap-1 text-[10px] font-medium text-primary">
                <Clock className="h-3 w-3" /> Hoje
              </span>
            )}
          </div>

          <p className="mt-2 text-sm font-semibold leading-tight">{appointment.client_name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatDate(appointment.scheduled_date)}
            {appointment.scheduled_time ? ` — ${appointment.scheduled_time.slice(0, 5)}` : ""}
          </p>
          {appointment.os_number && (
            <p className="mt-0.5 text-xs font-medium text-muted-foreground">
              OS {appointment.os_number}
            </p>
          )}

          <Button
            size="sm"
            variant="ghost"
            className="mt-2 h-7 w-full justify-start px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onForward();
            }}
          >
            <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> OS encaminhada
          </Button>
        </div>
      )}
    </Draggable>
  );
}
