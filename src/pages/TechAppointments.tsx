import { useMemo, useState } from "react";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import { CalendarClock, History, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ALL_TECHNICIANS, UNASSIGNED, WEEKDAYS } from "@/lib/techSchedule";
import { useTechAppointments, type TechAppointment } from "@/hooks/useTechAppointments";
import { TechColumn } from "@/components/tech/TechColumn";
import { AppointmentDialog } from "@/components/tech/AppointmentDialog";

const DIST = "distribuicao";

export default function TechAppointments() {
  const {
    appointments,
    isLoading,
    createAppointment,
    updateAppointment,
    deleteAppointment,
    forwardAppointment,
    reorder,
  } = useTechAppointments(false);
  const { appointments: forwarded } = useTechAppointments(true);

  const [tab, setTab] = useState<string>(DIST);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return appointments;
    return appointments.filter((a) =>
      `${a.client_name} ${a.city}`.toLowerCase().includes(term)
    );
  }, [appointments, search]);

  const sortByPos = (list: TechAppointment[]) =>
    [...list].sort((a, b) => a.position - b.position);

  const waiting = sortByPos(filtered.filter((a) => !a.technician));
  const byTech = (t: string) => sortByPos(filtered.filter((a) => a.technician === t));
  const byTechDay = (t: string, day: number | null) =>
    sortByPos(
      filtered.filter(
        (a) => a.technician === t && (day === null ? a.weekday == null : a.weekday === day)
      )
    );

  const parseTarget = (droppableId: string): { technician: string | null; weekday: number | null } => {
    if (droppableId === "waiting") return { technician: null, weekday: null };
    const [kind, tech, day] = droppableId.split("::");
    if (kind === "tech") return { technician: tech, weekday: null };
    return { technician: tech, weekday: day === "none" ? null : Number(day) };
  };

  const handleDragEnd = ({ source, destination, draggableId }: DropResult) => {
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const { technician, weekday } = parseTarget(destination.droppableId);

    const inDest = appointments
      .filter((a) => {
        if (a.id === draggableId) return false;
        if (!technician) return !a.technician;
        if (a.technician !== technician) return false;
        if (destination.droppableId.startsWith("tech::")) return true;
        return weekday === null ? a.weekday == null : a.weekday === weekday;
      })
      .sort((a, b) => a.position - b.position)
      .map((a) => a.id);
    inDest.splice(destination.index, 0, draggableId);

    const moved = appointments.find((a) => a.id === draggableId);
    const keepWeekday =
      destination.droppableId.startsWith("tech::") && moved?.technician === technician
        ? moved?.weekday ?? null
        : weekday;

    reorder.mutate(
      inDest.map((id, position) => ({
        id,
        technician,
        weekday: id === draggableId ? keepWeekday : appointments.find((a) => a.id === id)?.weekday ?? null,
        position,
      })),
      { onError: () => toast.error("Não foi possível mover o cliente") }
    );
  };

  const handleDone = (a: TechAppointment) =>
    forwardAppointment.mutate(a.id, {
      onSuccess: () => toast.success("Cliente concluído e enviado ao histórico"),
      onError: () => toast.error("Erro ao concluir"),
    });

  const handleDelete = (a: TechAppointment) =>
    deleteAppointment.mutate(a.id, {
      onSuccess: () => toast.success("Cliente removido"),
    });

  return (
    <div className="space-y-5 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <CalendarClock className="h-6 w-6 text-primary" />
            Agendamentos Técnicos
          </h1>
          <p className="text-sm text-muted-foreground">
            Adicione o cliente e a cidade, depois arraste para o técnico e o dia da semana.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setHistoryOpen(true)}>
            <History className="mr-2 h-4 w-4" /> Histórico
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Novo cliente
          </Button>
        </div>
      </header>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar cliente ou cidade..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex-wrap">
            <TabsTrigger value={DIST}>
              Distribuição
              <span className="ml-2 rounded-full bg-muted px-1.5 text-[10px]">{waiting.length}</span>
            </TabsTrigger>
            {ALL_TECHNICIANS.map((t) => (
              <TabsTrigger key={t} value={t}>
                {t}
                <span className="ml-2 rounded-full bg-muted px-1.5 text-[10px]">
                  {byTech(t).length}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={DIST} className="mt-4">
            <div className="flex gap-4 overflow-x-auto pb-3">
              <TechColumn
                droppableId="waiting"
                title={UNASSIGNED}
                items={waiting}
                className="border-dashed bg-muted/50"
                onDone={handleDone}
                onDelete={handleDelete}
              />
              {ALL_TECHNICIANS.map((t) => (
                <TechColumn
                  key={t}
                  droppableId={`tech::${t}`}
                  title={t}
                  items={byTech(t)}
                  onDone={handleDone}
                />
              ))}
            </div>
          </TabsContent>

          {ALL_TECHNICIANS.map((t) => (
            <TabsContent key={t} value={t} className="mt-4">
              <div className="flex gap-4 overflow-x-auto pb-3">
                <TechColumn
                  droppableId={`day::${t}::none`}
                  title="Sem dia"
                  items={byTechDay(t, null)}
                  className="border-dashed bg-muted/50"
                  onDone={handleDone}
                />
                {WEEKDAYS.map((w) => (
                  <TechColumn
                    key={w.value}
                    droppableId={`day::${t}::${w.value}`}
                    title={w.label}
                    items={byTechDay(t, w.value)}
                    onDone={handleDone}
                  />
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </DragDropContext>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}

      <AppointmentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={(values) =>
          createAppointment.mutate(values as never, {
            onSuccess: () => {
              toast.success("Cliente adicionado");
              setDialogOpen(false);
            },
            onError: () => toast.error("Erro ao adicionar cliente"),
          })
        }
        isSaving={createAppointment.isPending}
      />

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Histórico de atendimentos concluídos</DialogTitle>
          </DialogHeader>
          {forwarded.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nada por aqui ainda.</p>
          ) : (
            <ul className="divide-y">
              {forwarded.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-medium">{a.client_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.city} · {a.technician ?? UNASSIGNED}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      updateAppointment.mutate(
                        { id: a.id, forwarded_at: null, forwarded_by: null },
                        { onSuccess: () => toast.success("Cliente reaberto") }
                      )
                    }
                  >
                    Reabrir
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
