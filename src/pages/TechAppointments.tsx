import { useMemo, useState } from "react";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import { CalendarClock, History, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { CITIES, UNASSIGNED } from "@/lib/techSchedule";
import { useTechAppointments, type TechAppointment } from "@/hooks/useTechAppointments";
import { useTechColumnOrder } from "@/hooks/useTechColumnOrder";
import { CityBoard } from "@/components/tech/CityBoard";

import { AppointmentDialog } from "@/components/tech/AppointmentDialog";
import { formatDate } from "@/components/tech/AppointmentCard";

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
  const { getTechnicians, saveOrder } = useTechColumnOrder();


  const [tab, setTab] = useState<string>(CITIES[0].name);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [techFilter, setTechFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TechAppointment | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const activeCity = CITIES.find((c) => c.name === tab) ?? CITIES[0];

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return appointments.filter((a) => {
      if (dateFilter && a.scheduled_date !== dateFilter) return false;
      if (techFilter !== "all") {
        if (techFilter === UNASSIGNED ? !!a.technician : a.technician !== techFilter) return false;
      }
      if (!term) return true;
      return [a.client_name, a.os_number, a.neighborhood, a.phone, a.service_type]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
  }, [appointments, search, dateFilter, techFilter]);

  const cityItems = (cityName: string) => filtered.filter((a) => a.city === cityName);

  const handleDragEnd = (result: DropResult) => {
    const { source, destination, draggableId, type } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    if (type === "COLUMN") {
      const cityName = destination.droppableId.replace("columns::", "");
      const current = [...getTechnicians(cityName)];
      const [moved] = current.splice(source.index, 1);
      current.splice(destination.index, 0, moved);
      saveOrder.mutate(
        { city: cityName, technicians: current },
        { onError: () => toast.error("Não foi possível reordenar os técnicos") }
      );
      return;
    }

    const [city, col] = destination.droppableId.split("::");
    const technician = col === UNASSIGNED ? null : col;


    const destItems = appointments
      .filter((a) => a.city === city && (technician ? a.technician === technician : !a.technician))
      .filter((a) => a.id !== draggableId)
      .sort((a, b) => a.position - b.position)
      .map((a) => a.id);
    destItems.splice(destination.index, 0, draggableId);

    reorder.mutate(
      destItems.map((id, position) => ({ id, technician, city, position })),
      { onError: () => toast.error("Não foi possível mover o agendamento") }
    );
  };

  const handleSave = (values: Record<string, unknown>) => {
    if (editing) {
      updateAppointment.mutate(
        { id: editing.id, ...values },
        {
          onSuccess: () => {
            toast.success("Agendamento atualizado");
            setDialogOpen(false);
          },
          onError: () => toast.error("Erro ao atualizar agendamento"),
        }
      );
    } else {
      createAppointment.mutate(values as never, {
        onSuccess: () => {
          toast.success("Agendamento criado");
          setDialogOpen(false);
        },
        onError: () => toast.error("Erro ao criar agendamento"),
      });
    }
  };

  const handleForward = (a: TechAppointment) => {
    forwardAppointment.mutate(a.id, {
      onSuccess: () => toast.success("OS encaminhada e movida para o histórico"),
      onError: () => toast.error("Erro ao encaminhar OS"),
    });
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <CalendarClock className="h-6 w-6 text-primary" />
            Agendamentos Técnicos
          </h1>
          <p className="text-sm text-muted-foreground">
            Distribua as ordens de serviço entre os técnicos de cada cidade.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setHistoryOpen(true)}>
            <History className="mr-2 h-4 w-4" /> Histórico
          </Button>
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Novo agendamento
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar cliente, OS, bairro..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Input
          type="date"
          className="w-[170px]"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
        />
        <Select value={techFilter} onValueChange={setTechFilter}>
          <SelectTrigger className="w-[210px]">
            <SelectValue placeholder="Todos os técnicos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os técnicos</SelectItem>
            <SelectItem value={UNASSIGNED}>{UNASSIGNED}</SelectItem>
            {getTechnicians(activeCity.name).map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}

          </SelectContent>
        </Select>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          {CITIES.map((c) => (
            <TabsTrigger key={c.key} value={c.name}>
              {c.name}
              <span className="ml-2 rounded-full bg-muted px-1.5 text-[10px]">
                {cityItems(c.name).length}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        <DragDropContext onDragEnd={handleDragEnd}>
          {CITIES.map((c) => (
            <TabsContent key={c.key} value={c.name} className="mt-4">
              {c.technicians.length === 0 && (
                <p className="mb-3 text-sm text-muted-foreground">
                  Nenhum técnico cadastrado para esta cidade — os agendamentos ficam na coluna de espera.
                </p>
              )}
              <CityBoard
                city={c}
                technicians={getTechnicians(c.name)}
                appointments={cityItems(c.name)}

                onCardClick={(a) => {
                  setEditing(a);
                  setDialogOpen(true);
                }}
                onForward={handleForward}
              />
            </TabsContent>
          ))}
        </DragDropContext>
      </Tabs>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando agendamentos...</p>}

      <AppointmentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        appointment={editing}
        defaultCity={tab}
        onSave={handleSave}
        onDelete={(id) =>
          deleteAppointment.mutate(id, {
            onSuccess: () => {
              toast.success("Agendamento excluído");
              setDialogOpen(false);
            },
          })
        }
        isSaving={createAppointment.isPending || updateAppointment.isPending}
      />

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Histórico de OS encaminhadas</DialogTitle>
          </DialogHeader>
          {forwarded.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma OS encaminhada ainda.</p>
          ) : (
            <ul className="divide-y">
              {forwarded.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-medium">{a.client_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.city} · {formatDate(a.scheduled_date)} ·{" "}
                      {a.technician ?? UNASSIGNED}
                      {a.os_number ? ` · OS ${a.os_number}` : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      updateAppointment.mutate(
                        { id: a.id, forwarded_at: null, forwarded_by: null },
                        { onSuccess: () => toast.success("Agendamento reaberto") }
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
