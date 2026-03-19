import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFleetMaintenances, FleetCheckin } from "@/hooks/useFleet";
import { format } from "date-fns";
import { toast } from "sonner";
import { Hammer, CheckCircle2 } from "lucide-react";

const MAINTENANCE_TYPES = [
  { value: "oil_change", label: "Troca de Óleo" },
  { value: "tires", label: "Pneus" },
  { value: "battery", label: "Bateria" },
  { value: "brakes", label: "Freios" },
  { value: "suspension", label: "Suspensão" },
  { value: "electrical", label: "Elétrica" },
  { value: "alignment", label: "Alinhamento" },
  { value: "revision", label: "Revisão" },
  { value: "corrective", label: "Corretiva" },
  { value: "other", label: "Outros" },
];

interface Props {
  checkin: FleetCheckin;
  vehicleName: string;
  alreadyCreated: boolean;
  onCreated: (checkinId: string) => void;
}

export default function CreateMaintenanceFromCheckin({ checkin, vehicleName, alreadyCreated, onCreated }: Props) {
  const { createMaintenance } = useFleetMaintenances();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    maintenance_type: "corrective",
    supplier: "",
    description: "",
    notes: "",
    cost: "",
  });

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (alreadyCreated) return;

    const parts: string[] = [];
    if (checkin.description) parts.push(checkin.description);
    const toolsDesc = (checkin as any).tools_description;
    if (toolsDesc) parts.push(`Ferramentas: ${toolsDesc}`);

    setForm({
      maintenance_type: "corrective",
      supplier: "",
      description: parts.join("\n") || `Manutenção reportada no check-in de ${format(new Date(checkin.checkin_date), "dd/MM/yyyy")}`,
      notes: "",
      cost: "",
    });
    setOpen(true);
  };

  const handleSubmit = async () => {
    try {
      await createMaintenance.mutateAsync({
        vehicle_id: checkin.vehicle_id,
        maintenance_type: form.maintenance_type,
        maintenance_date: checkin.checkin_date,
        km_at_maintenance: checkin.km_reported || undefined,
        description: form.description || undefined,
        supplier: form.supplier || undefined,
        notes: form.notes || undefined,
        cost: form.cost ? parseFloat(form.cost) : undefined,
        status: "pending",
      } as any);
      toast.success(`Manutenção criada para ${vehicleName}`);
      onCreated(checkin.id);
      setOpen(false);
    } catch {
      toast.error("Erro ao criar manutenção");
    }
  };

  return (
    <>
      {alreadyCreated ? (
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5 text-xs border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 cursor-default"
          disabled
          onClick={(e) => e.stopPropagation()}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Manutenção criada
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
          onClick={handleOpen}
        >
          <Hammer className="h-3.5 w-3.5" />
          Criar Manutenção
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Criar Manutenção — {vehicleName}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Tipo de Manutenção</Label>
              <Select value={form.maintenance_type} onValueChange={v => setForm(f => ({ ...f, maintenance_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MAINTENANCE_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Oficina / Fornecedor</Label>
              <Input
                value={form.supplier}
                onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))}
                placeholder="Nome da oficina"
              />
            </div>
            <div>
              <Label>Descrição do Problema</Label>
              <Textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Custo Estimado (R$)</Label>
                <Input
                  type="number"
                  value={form.cost}
                  onChange={e => setForm(f => ({ ...f, cost: e.target.value }))}
                  placeholder="0,00"
                />
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                placeholder="Informações adicionais..."
              />
            </div>
            <Button onClick={handleSubmit} className="w-full">
              <Hammer className="h-4 w-4 mr-1.5" />
              Criar Manutenção
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
