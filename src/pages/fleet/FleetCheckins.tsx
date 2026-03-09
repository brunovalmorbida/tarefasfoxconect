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
import { Checkbox } from "@/components/ui/checkbox";
import { useFleetCheckins, useFleetVehicles, useFleetDrivers, FleetCheckin } from "@/hooks/useFleet";
import { Plus, Search, ClipboardCheck, Pencil } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "outline" },
  answered: { label: "Respondido", variant: "default" },
  overdue: { label: "Atrasado", variant: "destructive" },
};

export default function FleetCheckins() {
  const { checkins, isLoading, createCheckin, updateCheckin } = useFleetCheckins();
  const { vehicles } = useFleetVehicles();
  const { drivers } = useFleetDrivers();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FleetCheckin | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [form, setForm] = useState({
    vehicle_id: "", driver_id: "", km_reported: "", needs_maintenance: false,
    description: "", status: "pending", checkin_date: new Date().toISOString().split("T")[0],
  });

  const resetForm = () => setForm({
    vehicle_id: "", driver_id: "", km_reported: "", needs_maintenance: false,
    description: "", status: "pending", checkin_date: new Date().toISOString().split("T")[0],
  });

  const openCreate = () => { resetForm(); setEditing(null); setDialogOpen(true); };
  const openEdit = (c: FleetCheckin) => {
    setEditing(c);
    setForm({
      vehicle_id: c.vehicle_id, driver_id: c.driver_id,
      km_reported: c.km_reported?.toString() || "", needs_maintenance: c.needs_maintenance,
      description: c.description || "", status: c.status, checkin_date: c.checkin_date,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.vehicle_id || !form.driver_id) return;
    const payload: any = {
      vehicle_id: form.vehicle_id, driver_id: form.driver_id,
      km_reported: form.km_reported ? parseInt(form.km_reported) : null,
      needs_maintenance: form.needs_maintenance,
      description: form.description || null, status: form.status,
      checkin_date: form.checkin_date,
    };
    if (editing) {
      await updateCheckin.mutateAsync({ id: editing.id, ...payload });
    } else {
      await createCheckin.mutateAsync(payload);
    }
    setDialogOpen(false);
    resetForm();
    setEditing(null);
  };

  const filtered = checkins.filter(c => {
    if (filterStatus !== "all" && c.status !== filterStatus) return false;
    const v = vehicles.find(v => v.id === c.vehicle_id);
    const d = drivers.find(d => d.id === c.driver_id);
    const term = search.toLowerCase();
    return !term || (v?.name || "").toLowerCase().includes(term) || (d?.name || "").toLowerCase().includes(term);
  });

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Check-ins</h2>
          <p className="text-muted-foreground text-sm">{checkins.length} check-in(s) registrado(s)</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto flex-wrap">
          <div className="relative flex-1 sm:w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="answered">Respondidos</SelectItem>
              <SelectItem value="overdue">Atrasados</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Novo</Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ClipboardCheck className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum check-in encontrado</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Motorista</TableHead>
                  <TableHead className="hidden md:table-cell">KM</TableHead>
                  <TableHead>Manutenção</TableHead>
                  <TableHead className="hidden lg:table-cell">Descrição</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(c => {
                  const v = vehicles.find(v => v.id === c.vehicle_id);
                  const d = drivers.find(d => d.id === c.driver_id);
                  return (
                    <TableRow key={c.id}>
                      <TableCell>{format(new Date(c.checkin_date), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                      <TableCell className="font-medium">{v?.name || "—"} <span className="text-xs text-muted-foreground">{v?.plate}</span></TableCell>
                      <TableCell>{d?.name || "—"}</TableCell>
                      <TableCell className="hidden md:table-cell">{c.km_reported?.toLocaleString("pt-BR") || "—"}</TableCell>
                      <TableCell>
                        {c.needs_maintenance ? (
                          <Badge variant="destructive">Sim</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">Não</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell max-w-48 truncate text-sm text-muted-foreground">{c.description || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_MAP[c.status]?.variant || "outline"}>
                          {STATUS_MAP[c.status]?.label || c.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
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
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar Check-in" : "Novo Check-in"}</DialogTitle></DialogHeader>
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
                <Label>Motorista *</Label>
                <Select value={form.driver_id} onValueChange={v => setForm(f => ({ ...f, driver_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Data</Label><Input type="date" value={form.checkin_date} onChange={e => setForm(f => ({ ...f, checkin_date: e.target.value }))} /></div>
              <div><Label>KM Informado</Label><Input type="number" value={form.km_reported} onChange={e => setForm(f => ({ ...f, km_reported: e.target.value }))} /></div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={form.needs_maintenance} onCheckedChange={v => setForm(f => ({ ...f, needs_maintenance: !!v }))} />
              <Label>Precisa de manutenção</Label>
            </div>
            <div><Label>Descrição / Observação</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} /></div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="answered">Respondido</SelectItem>
                  <SelectItem value="overdue">Atrasado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSubmit} disabled={!form.vehicle_id || !form.driver_id}>
              {editing ? "Salvar" : "Registrar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
