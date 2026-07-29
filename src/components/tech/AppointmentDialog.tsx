import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CITIES, getCity } from "@/lib/techSchedule";
import type { TechAppointment } from "@/hooks/useTechAppointments";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment?: TechAppointment | null;
  defaultCity?: string;
  onSave: (values: Record<string, unknown>) => void;
  onDelete?: (id: string) => void;
  isSaving?: boolean;
}

const emptyForm = {
  city: CITIES[0].name,
  client_name: "",
  phone: "",
  scheduled_date: "",
  scheduled_time: "",
  neighborhood: "",
  os_number: "",
  service_type: "",
  technician: "none",
  notes: "",
};

export function AppointmentDialog({
  open,
  onOpenChange,
  appointment,
  defaultCity,
  onSave,
  onDelete,
  isSaving,
}: Props) {
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (!open) return;
    if (appointment) {
      setForm({
        city: appointment.city,
        client_name: appointment.client_name,
        phone: appointment.phone ?? "",
        scheduled_date: appointment.scheduled_date ?? "",
        scheduled_time: appointment.scheduled_time?.slice(0, 5) ?? "",
        neighborhood: appointment.neighborhood ?? "",
        os_number: appointment.os_number ?? "",
        service_type: appointment.service_type ?? "",
        technician: appointment.technician ?? "none",
        notes: appointment.notes ?? "",
      });
    } else {
      setForm({ ...emptyForm, city: defaultCity ?? CITIES[0].name });
    }
  }, [open, appointment, defaultCity]);

  const set = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const technicians = getCity(form.city).technicians;

  const submit = () => {
    if (!form.client_name.trim() || !form.scheduled_date) return;
    onSave({
      city: form.city,
      client_name: form.client_name.trim(),
      phone: form.phone || null,
      scheduled_date: form.scheduled_date,
      scheduled_time: form.scheduled_time || null,
      neighborhood: form.neighborhood || null,
      os_number: form.os_number || null,
      service_type: form.service_type || null,
      technician: form.technician === "none" ? null : form.technician,
      notes: form.notes || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {appointment ? "Editar agendamento" : "Novo agendamento"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Cidade</Label>
            <Select
              value={form.city}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, city: v, technician: "none" }))
              }
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CITIES.map((c) => (
                  <SelectItem key={c.key} value={c.name}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Nome do cliente *</Label>
            <Input value={form.client_name} onChange={(e) => set("client_name", e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Telefone</Label>
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Nº da OS (IXC)</Label>
            <Input value={form.os_number} onChange={(e) => set("os_number", e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Data *</Label>
            <Input type="date" value={form.scheduled_date} onChange={(e) => set("scheduled_date", e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Horário</Label>
            <Input type="time" value={form.scheduled_time} onChange={(e) => set("scheduled_time", e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Bairro / localidade</Label>
            <Input value={form.neighborhood} onChange={(e) => set("neighborhood", e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Tipo de serviço</Label>
            <Input value={form.service_type} onChange={(e) => set("service_type", e.target.value)} />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Técnico responsável</Label>
            <Select value={form.technician} onValueChange={(v) => set("technician", v)}>
              <SelectTrigger><SelectValue placeholder="Aguardando distribuição" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aguardando distribuição</SelectItem>
                {technicians.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Observações</Label>
            <Textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {appointment && onDelete ? (
            <Button variant="destructive" onClick={() => onDelete(appointment.id)}>
              Excluir
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={isSaving}>Salvar</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
