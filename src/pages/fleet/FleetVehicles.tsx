import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useFleetVehicles, useFleetDrivers, useFleetMaintenances, useFleetCheckins, FleetVehicle } from "@/hooks/useFleet";
import { useVehicleScores } from "@/hooks/useVehicleScore";
import { VehicleScoreBadge } from "@/components/fleet/VehicleScoreBadge";
import { Plus, Pencil, Trash2, Car, Search, Gauge, Wrench, MoreHorizontal, Eye, ParkingSquare } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_MAP: Record<string, { label: string; color: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Ativo", color: "bg-green-500", variant: "default" },
  maintenance: { label: "Manutenção", color: "bg-orange-500", variant: "destructive" },
  reserve: { label: "Reserva", color: "bg-blue-500", variant: "secondary" },
  inactive: { label: "Inativo", color: "bg-muted-foreground", variant: "outline" },
};

export default function FleetVehicles() {
  const navigate = useNavigate();
  const { vehicles, isLoading, createVehicle, updateVehicle, deleteVehicle } = useFleetVehicles();
  const { drivers } = useFleetDrivers();
  const { maintenances } = useFleetMaintenances();
  const { checkins } = useFleetCheckins();
  const scores = useVehicleScores(vehicles, maintenances, checkins);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<FleetVehicle | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
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
      driver_id: form.driver_id && form.driver_id !== "none" ? form.driver_id : null, notes: form.notes || null,
    };
    if (editing) {
      await updateVehicle.mutateAsync({ id: editing.id, ...payload });
    } else {
      await createVehicle.mutateAsync(payload);
    }
    setDialogOpen(false); resetForm(); setEditing(null);
  };

  const getDriverName = (driverId: string | null) => {
    if (!driverId) return null;
    return drivers.find((d) => d.id === driverId)?.name || null;
  };

  const getLastMaintenance = (vehicleId: string) => {
    const m = maintenances.find((m) => m.vehicle_id === vehicleId);
    return m ? format(new Date(m.maintenance_date), "dd/MM/yyyy", { locale: ptBR }) : null;
  };

  // Metrics
  const metrics = useMemo(() => {
    const total = vehicles.length;
    const active = vehicles.filter((v) => v.status === "active").length;
    const inMaint = vehicles.filter((v) => v.status === "maintenance").length;
    const stopped = vehicles.filter((v) => v.status === "inactive" || v.status === "reserve").length;
    return { total, active, inMaint, stopped };
  }, [vehicles]);

  const filtered = useMemo(() => {
    return vehicles.filter((v) => {
      if (statusFilter !== "all" && v.status !== statusFilter) return false;
      if (!search) return true;
      const term = search.toLowerCase();
      const driverName = getDriverName(v.driver_id)?.toLowerCase() || "";
      return v.name.toLowerCase().includes(term) || v.plate.toLowerCase().includes(term) ||
        (v.model || "").toLowerCase().includes(term) || (v.brand || "").toLowerCase().includes(term) ||
        driverName.includes(term);
    });
  }, [vehicles, search, statusFilter, drivers]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total", value: metrics.total, icon: Car, color: "text-primary" },
          { label: "Em Uso", value: metrics.active, icon: Car, color: "text-green-600" },
          { label: "Manutenção", value: metrics.inMaint, icon: Wrench, color: "text-orange-600" },
          { label: "Parados", value: metrics.stopped, icon: ParkingSquare, color: "text-muted-foreground" },
        ].map((m) => (
          <Card key={m.label} className="p-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted ${m.color}`}>
                <m.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{m.value}</p>
                <p className="text-xs text-muted-foreground">{m.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, placa, modelo ou motorista..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {[
            { value: "all", label: "Todos" },
            { value: "active", label: "Ativos" },
            { value: "maintenance", label: "Manutenção" },
            { value: "reserve", label: "Reserva" },
            { value: "inactive", label: "Inativos" },
          ].map((f) => (
            <Button
              key={f.value}
              variant={statusFilter === f.value ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <Button onClick={openCreate} className="gap-1.5 shrink-0">
          <Plus className="h-4 w-4" /> Novo Veículo
        </Button>
      </div>

      {/* Vehicle Cards */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Car className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum veículo encontrado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((v) => {
            const status = STATUS_MAP[v.status] || STATUS_MAP.inactive;
            const driverName = getDriverName(v.driver_id);
            const lastMaint = getLastMaintenance(v.id);
            return (
              <Card
                key={v.id}
                className="p-4 transition-colors hover:bg-muted/30 cursor-pointer"
                onClick={() => navigate(`/fleet/vehicle/${v.id}`)}
              >
                <div className="flex items-center gap-4">
                  {/* Icon with status dot */}
                  <div className="relative shrink-0">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Car className="h-5 w-5" />
                    </div>
                    <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${status.color}`} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{v.name}</span>
                      <span className="text-xs font-mono text-muted-foreground">{v.plate}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap text-xs text-muted-foreground">
                      {v.brand || v.model ? (
                        <span>{[v.brand, v.model, v.year].filter(Boolean).join(" ")}</span>
                      ) : null}
                      {driverName && <span>👤 {driverName}</span>}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="hidden md:flex items-center gap-6 shrink-0 text-center">
                    <div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Gauge className="h-3 w-3" />
                        KM
                      </div>
                      <p className="text-sm font-semibold">{v.current_km?.toLocaleString("pt-BR") || "0"}</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Wrench className="h-3 w-3" />
                        Última Man.
                      </div>
                      <p className="text-sm font-medium">{lastMaint || "—"}</p>
                    </div>
                    {(() => {
                      const s = scores.get(v.id);
                      return s ? (
                        <div>
                          <div className="text-xs text-muted-foreground mb-0.5">Score</div>
                          <VehicleScoreBadge score={s.score} classification={s.classification} compact />
                        </div>
                      ) : null;
                    })()}
                  </div>

                  {/* Badge */}
                  <Badge variant={status.variant} className="hidden sm:flex shrink-0">
                    {status.label}
                  </Badge>

                  {/* Actions */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="shrink-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/fleet/vehicle/${v.id}`); }}>
                        <Eye className="mr-2 h-4 w-4" /> Ver detalhes
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEdit(v); }}>
                        <Pencil className="mr-2 h-4 w-4" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setDeleteId(v.id); }} className="text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Veículo" : "Novo Veículo"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Saveiro SJO-01" /></div>
              <div><Label>Placa *</Label><Input value={form.plate} onChange={(e) => setForm((f) => ({ ...f, plate: e.target.value }))} placeholder="ABC-1234" /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Marca</Label><Input value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} placeholder="VW" /></div>
              <div><Label>Modelo</Label><Input value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} placeholder="Saveiro" /></div>
              <div><Label>Ano</Label><Input type="number" value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))} placeholder="2024" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>KM Atual</Label><Input type="number" value={form.current_km} onChange={(e) => setForm((f) => ({ ...f, current_km: e.target.value }))} placeholder="0" /></div>
              <div><Label>Cidade / Base</Label><Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} placeholder="São José" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
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
                <Select value={form.driver_id} onValueChange={(v) => setForm((f) => ({ ...f, driver_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {drivers.filter((d) => d.status === "active").map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} /></div>
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
