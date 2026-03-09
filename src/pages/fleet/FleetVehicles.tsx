import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useFleetVehicles, useFleetDrivers, FleetVehicle } from "@/hooks/useFleet";
import { Plus, Pencil, Trash2, Car, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Ativo", variant: "default" },
  maintenance: { label: "Em Manutenção", variant: "destructive" },
  reserve: { label: "Reserva", variant: "secondary" },
  inactive: { label: "Inativo", variant: "outline" },
};

export default function FleetVehicles() {
  const { vehicles, isLoading, createVehicle, updateVehicle, deleteVehicle } = useFleetVehicles();
  const { drivers } = useFleetDrivers();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<FleetVehicle | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    name: "", plate: "", brand: "", model: "", year: "", current_km: "",
    city: "", status: "active", driver_id: "", notes: "",
  });

  const resetForm = () => setForm({
    name: "", plate: "", brand: "", model: "", year: "", current_km: "",
    city: "", status: "active", driver_id: "", notes: "",
  });

  const openCreate = () => { resetForm(); setEditing(null); setDialogOpen(true); };
  const openEdit = (v: FleetVehicle) => {
    setEditing(v);
    setForm({
      name: v.name, plate: v.plate, brand: v.brand || "", model: v.model || "",
      year: v.year?.toString() || "", current_km: v.current_km?.toString() || "",
      city: v.city || "", status: v.status, driver_id: v.driver_id || "", notes: v.notes || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.plate.trim()) return;
    const payload: any = {
      name: form.name, plate: form.plate.toUpperCase(), brand: form.brand || null,
      model: form.model || null, year: form.year ? parseInt(form.year) : null,
      current_km: form.current_km ? parseInt(form.current_km) : 0,
      city: form.city || null, status: form.status,
      driver_id: form.driver_id || null, notes: form.notes || null,
    };
    if (editing) {
      await updateVehicle.mutateAsync({ id: editing.id, ...payload });
    } else {
      await createVehicle.mutateAsync(payload);
    }
    setDialogOpen(false);
    resetForm();
    setEditing(null);
  };

  const filtered = vehicles.filter(v =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.plate.toLowerCase().includes(search.toLowerCase()) ||
    (v.city || "").toLowerCase().includes(search.toLowerCase())
  );

  const getDriverName = (driverId: string | null) => {
    if (!driverId) return "—";
    return drivers.find(d => d.id === driverId)?.name || "—";
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Veículos</h2>
          <p className="text-muted-foreground text-sm">{vehicles.length} veículo(s) cadastrado(s)</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar veículo..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Novo</Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Car className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum veículo encontrado</p>
            <Button className="mt-4" onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Cadastrar veículo</Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Placa</TableHead>
                  <TableHead className="hidden md:table-cell">Marca/Modelo</TableHead>
                  <TableHead className="hidden md:table-cell">KM</TableHead>
                  <TableHead className="hidden lg:table-cell">Cidade</TableHead>
                  <TableHead>Motorista</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(v => (
                  <TableRow key={v.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-medium">{v.name}</TableCell>
                    <TableCell className="font-mono text-sm">{v.plate}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {[v.brand, v.model, v.year].filter(Boolean).join(" ") || "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{v.current_km?.toLocaleString("pt-BR") || "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell">{v.city || "—"}</TableCell>
                    <TableCell>{getDriverName(v.driver_id)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_MAP[v.status]?.variant || "secondary"}>
                        {STATUS_MAP[v.status]?.label || v.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(v)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(v.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Veículo" : "Novo Veículo"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Nome *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Saveiro SJO-01" /></div>
              <div><Label>Placa *</Label><Input value={form.plate} onChange={e => setForm(f => ({ ...f, plate: e.target.value }))} placeholder="ABC-1234" /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Marca</Label><Input value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} placeholder="VW" /></div>
              <div><Label>Modelo</Label><Input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} placeholder="Saveiro" /></div>
              <div><Label>Ano</Label><Input type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} placeholder="2024" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>KM Atual</Label><Input type="number" value={form.current_km} onChange={e => setForm(f => ({ ...f, current_km: e.target.value }))} placeholder="0" /></div>
              <div><Label>Cidade / Base</Label><Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="São José" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="maintenance">Em Manutenção</SelectItem>
                    <SelectItem value="reserve">Reserva</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Motorista</Label>
                <Select value={form.driver_id} onValueChange={v => setForm(f => ({ ...f, driver_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {drivers.filter(d => d.status === "active").map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Observações</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
            <Button onClick={handleSubmit} disabled={!form.name.trim() || !form.plate.trim()}>
              {editing ? "Salvar" : "Cadastrar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir veículo?</AlertDialogTitle>
            <AlertDialogDescription>Essa ação não pode ser desfeita. Todos os dados relacionados serão removidos.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteId) deleteVehicle.mutate(deleteId); setDeleteId(null); }}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
