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
import { useFleetDrivers, useFleetVehicles, FleetDriver } from "@/hooks/useFleet";
import { Plus, Pencil, Trash2, Users, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function FleetDrivers() {
  const { drivers, isLoading, createDriver, updateDriver, deleteDriver } = useFleetDrivers();
  const { vehicles } = useFleetVehicles();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<FleetDriver | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    name: "", phone: "", job_title: "", city: "", vehicle_id: "", status: "active", notes: "",
  });

  const resetForm = () => setForm({ name: "", phone: "", job_title: "", city: "", vehicle_id: "", status: "active", notes: "" });

  const openCreate = () => { resetForm(); setEditing(null); setDialogOpen(true); };
  const openEdit = (d: FleetDriver) => {
    setEditing(d);
    setForm({
      name: d.name, phone: d.phone || "", job_title: d.job_title || "",
      city: d.city || "", vehicle_id: d.vehicle_id || "", status: d.status, notes: d.notes || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    const payload: any = {
      name: form.name, phone: form.phone || null, job_title: form.job_title || null,
      city: form.city || null, vehicle_id: form.vehicle_id && form.vehicle_id !== "none" ? form.vehicle_id : null,
      status: form.status, notes: form.notes || null,
    };
    if (editing) {
      await updateDriver.mutateAsync({ id: editing.id, ...payload });
    } else {
      await createDriver.mutateAsync(payload);
    }
    setDialogOpen(false);
    resetForm();
    setEditing(null);
  };

  const filtered = drivers.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    (d.phone || "").includes(search) ||
    (d.city || "").toLowerCase().includes(search.toLowerCase())
  );

  const getVehicleName = (vehicleId: string | null) => {
    if (!vehicleId) return "—";
    const v = vehicles.find(v => v.id === vehicleId);
    return v ? `${v.name} (${v.plate})` : "—";
  };

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Motoristas</h2>
          <p className="text-muted-foreground text-sm">{drivers.length} motorista(s) cadastrado(s)</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar motorista..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Novo</Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum motorista encontrado</p>
            <Button className="mt-4" onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Cadastrar motorista</Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead className="hidden md:table-cell">Cargo</TableHead>
                  <TableHead className="hidden lg:table-cell">Cidade</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(d => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell>{d.phone || "—"}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">{d.job_title || "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell">{d.city || "—"}</TableCell>
                    <TableCell className="text-sm">{getVehicleName(d.vehicle_id)}</TableCell>
                    <TableCell>
                      <Badge variant={d.status === "active" ? "default" : "outline"}>
                        {d.status === "active" ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(d)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(d.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar Motorista" : "Novo Motorista"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Nome *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><Label>Telefone / WhatsApp</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(48) 99999-9999" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Cargo</Label><Input value={form.job_title} onChange={e => setForm(f => ({ ...f, job_title: e.target.value }))} /></div>
              <div><Label>Cidade / Base</Label><Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Veículo Vinculado</Label>
                <Select value={form.vehicle_id} onValueChange={v => setForm(f => ({ ...f, vehicle_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {vehicles.filter(v => v.status === "active").map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.name} ({v.plate})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Observações</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
            <Button onClick={handleSubmit} disabled={!form.name.trim()}>{editing ? "Salvar" : "Cadastrar"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir motorista?</AlertDialogTitle>
            <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteId) deleteDriver.mutate(deleteId); setDeleteId(null); }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
