import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useFleetMaintenances, useFleetVehicles, FleetMaintenance } from "@/hooks/useFleet";
import { Plus, Search, Wrench, Pencil, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const MAINTENANCE_TYPES = [
  { value: "oil_change", label: "Troca de Óleo" },
  { value: "tires", label: "Pneus" },
  { value: "battery", label: "Bateria" },
  { value: "brakes", label: "Freios" },
  { value: "suspension", label: "Suspensão" },
  { value: "electrical", label: "Elétrica" },
  { value: "alignment", label: "Alinhamento" },
  { value: "revision", label: "Revisão" },
  { value: "other", label: "Outros" },
];

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  pending: { label: "Pendente", variant: "outline" },
  in_progress: { label: "Em Andamento", variant: "secondary" },
  completed: { label: "Realizada", variant: "default" },
};

export default function FleetMaintenances() {
  const { maintenances, isLoading, createMaintenance, updateMaintenance, deleteMaintenance } = useFleetMaintenances();
  const { vehicles } = useFleetVehicles();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<FleetMaintenance | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    vehicle_id: "", maintenance_type: "other", maintenance_date: new Date().toISOString().split("T")[0],
    km_at_maintenance: "", cost: "", supplier: "", description: "", notes: "", status: "pending",
  });

  const resetForm = () => setForm({
    vehicle_id: "", maintenance_type: "other", maintenance_date: new Date().toISOString().split("T")[0],
    km_at_maintenance: "", cost: "", supplier: "", description: "", notes: "", status: "pending",
  });

  const openCreate = () => { resetForm(); setEditing(null); setDialogOpen(true); };
  const openEdit = (m: FleetMaintenance) => {
    setEditing(m);
    setForm({
      vehicle_id: m.vehicle_id, maintenance_type: m.maintenance_type,
      maintenance_date: m.maintenance_date, km_at_maintenance: m.km_at_maintenance?.toString() || "",
      cost: m.cost?.toString() || "", supplier: m.supplier || "",
      description: m.description || "", notes: m.notes || "", status: m.status,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.vehicle_id) return;
    const payload: any = {
      vehicle_id: form.vehicle_id, maintenance_type: form.maintenance_type,
      maintenance_date: form.maintenance_date,
      km_at_maintenance: form.km_at_maintenance ? parseInt(form.km_at_maintenance) : null,
      cost: form.cost ? parseFloat(form.cost) : null, supplier: form.supplier || null,
      description: form.description || null, notes: form.notes || null, status: form.status,
    };
    if (editing) {
      await updateMaintenance.mutateAsync({ id: editing.id, ...payload });
    } else {
      await createMaintenance.mutateAsync(payload);
    }
    setDialogOpen(false); resetForm(); setEditing(null);
  };

  const getTypeName = (type: string) => MAINTENANCE_TYPES.find(t => t.value === type)?.label || type;

  const filtered = maintenances.filter(m => {
    const v = vehicles.find(v => v.id === m.vehicle_id);
    const term = search.toLowerCase();
    return !term || (v?.name || "").toLowerCase().includes(term) || m.maintenance_type.toLowerCase().includes(term) || (m.supplier || "").toLowerCase().includes(term);
  });

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Manutenções</h2>
          <p className="text-muted-foreground text-sm">{maintenances.length} manutenção(ões) registrada(s)</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Nova</Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-12"><Wrench className="h-12 w-12 text-muted-foreground mb-4" /><p className="text-muted-foreground">Nenhuma manutenção encontrada</p></CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="hidden md:table-cell">KM</TableHead>
                  <TableHead className="hidden md:table-cell">Valor</TableHead>
                  <TableHead className="hidden lg:table-cell">Fornecedor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(m => {
                  const v = vehicles.find(v => v.id === m.vehicle_id);
                  return (
                    <TableRow key={m.id}>
                      <TableCell>{format(new Date(m.maintenance_date), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                      <TableCell className="font-medium">{v?.name || "—"}</TableCell>
                      <TableCell>{getTypeName(m.maintenance_type)}</TableCell>
                      <TableCell className="hidden md:table-cell">{m.km_at_maintenance?.toLocaleString("pt-BR") || "—"}</TableCell>
                      <TableCell className="hidden md:table-cell">{m.cost ? `R$ ${Number(m.cost).toFixed(2)}` : "—"}</TableCell>
                      <TableCell className="hidden lg:table-cell">{m.supplier || "—"}</TableCell>
                      <TableCell><Badge variant={STATUS_MAP[m.status]?.variant || "outline"}>{STATUS_MAP[m.status]?.label || m.status}</Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(m)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar Manutenção" : "Nova Manutenção"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Veículo *</Label>
                <Select value={form.vehicle_id} onValueChange={v => setForm(f => ({ ...f, vehicle_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.name} ({v.plate})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.maintenance_type} onValueChange={v => setForm(f => ({ ...f, maintenance_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MAINTENANCE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Data</Label><Input type="date" value={form.maintenance_date} onChange={e => setForm(f => ({ ...f, maintenance_date: e.target.value }))} /></div>
              <div><Label>KM</Label><Input type="number" value={form.km_at_maintenance} onChange={e => setForm(f => ({ ...f, km_at_maintenance: e.target.value }))} /></div>
              <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} /></div>
            </div>
            <div><Label>Fornecedor / Oficina</Label><Input value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} /></div>
            <div><Label>Descrição do Serviço</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
            <div><Label>Observações</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="in_progress">Em Andamento</SelectItem>
                  <SelectItem value="completed">Realizada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSubmit} disabled={!form.vehicle_id}>{editing ? "Salvar" : "Registrar"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir manutenção?</AlertDialogTitle><AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteId) deleteMaintenance.mutate(deleteId); setDeleteId(null); }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
