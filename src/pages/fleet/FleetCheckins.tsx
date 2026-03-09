import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useFleetCheckins, useFleetVehicles, FleetCheckin } from "@/hooks/useFleet";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search, ClipboardCheck, AlertTriangle, CheckCircle2, Clock, Car } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  pending: { label: "Pendente", variant: "outline", icon: Clock },
  answered: { label: "Respondido", variant: "default", icon: CheckCircle2 },
  overdue: { label: "Atrasado", variant: "destructive", icon: AlertTriangle },
};

interface DriverProfile {
  user_id: string;
  name: string;
}

export default function FleetCheckins() {
  const { checkins, isLoading, createCheckin, updateCheckin } = useFleetCheckins();
  const { vehicles } = useFleetVehicles();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FleetCheckin | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const { data: driverProfiles = [] } = useQuery({
    queryKey: ["driver-profiles"],
    queryFn: async () => {
      const { data: perms } = await supabase
        .from("user_permissions" as any)
        .select("user_id")
        .eq("is_driver", true);
      if (!perms || perms.length === 0) return [];
      const driverIds = (perms as any[]).map((p: any) => p.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name")
        .in("user_id", driverIds);
      return (profiles || []) as DriverProfile[];
    },
  });

  const { data: legacyDrivers = [] } = useQuery({
    queryKey: ["fleet-drivers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fleet_drivers" as any)
        .select("id, name")
        .order("name");
      if (error) throw error;
      return (data || []) as { id: string; name: string }[];
    },
  });

  const [form, setForm] = useState({
    vehicle_id: "", driver_user_id: "", checkin_date: new Date().toISOString().split("T")[0],
    km_reported: "", needs_maintenance: false, description: "", status: "answered",
  });

  const resetForm = () => setForm({
    vehicle_id: "", driver_user_id: "", checkin_date: new Date().toISOString().split("T")[0],
    km_reported: "", needs_maintenance: false, description: "", status: "answered",
  });

  const openCreate = () => { resetForm(); setEditing(null); setDialogOpen(true); };
  const openEdit = (c: FleetCheckin) => {
    setEditing(c);
    setForm({
      vehicle_id: c.vehicle_id,
      driver_user_id: (c as any).driver_user_id || "",
      checkin_date: c.checkin_date,
      km_reported: c.km_reported?.toString() || "",
      needs_maintenance: c.needs_maintenance ?? false,
      description: c.description || "",
      status: c.status,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.vehicle_id || !form.driver_user_id) return;
    const payload: any = {
      vehicle_id: form.vehicle_id,
      driver_user_id: form.driver_user_id,
      driver_id: form.driver_user_id,
      checkin_date: form.checkin_date,
      km_reported: form.km_reported ? parseInt(form.km_reported) : null,
      needs_maintenance: form.needs_maintenance,
      description: form.description || null,
      status: form.status,
    };
    if (editing) {
      await updateCheckin.mutateAsync({ id: editing.id, ...payload });
    } else {
      await createCheckin.mutateAsync(payload);
    }
    setDialogOpen(false); resetForm(); setEditing(null);
  };

  const getDriverName = (checkin: FleetCheckin) => {
    const duid = (checkin as any).driver_user_id;
    if (duid) {
      const profile = driverProfiles.find(p => p.user_id === duid);
      if (profile) return profile.name;
    }
    const legacy = legacyDrivers.find(d => d.id === checkin.driver_id);
    return legacy?.name || "—";
  };

  const getVehicleShort = (vehicleId: string) => {
    return vehicles.find(v => v.id === vehicleId)?.name || "—";
  };

  const filtered = checkins.filter(c => {
    if (filterStatus !== "all" && c.status !== filterStatus) return false;
    const v = vehicles.find(v => v.id === c.vehicle_id);
    const driverName = getDriverName(c);
    const term = search.toLowerCase();
    return !term || (v?.name || "").toLowerCase().includes(term) || driverName.toLowerCase().includes(term);
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
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="answered">Respondido</SelectItem>
              <SelectItem value="overdue">Atrasado</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={openCreate} size="sm"><Plus className="h-4 w-4 mr-1" /> Novo</Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ClipboardCheck className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum check-in encontrado</p>
            <Button className="mt-4" size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Registrar check-in</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(c => {
            const statusInfo = STATUS_MAP[c.status] || STATUS_MAP.pending;
            const StatusIcon = statusInfo.icon;
            return (
              <Card key={c.id} className="hover:shadow-md transition-shadow cursor-pointer group" onClick={() => openEdit(c)}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Car className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold text-sm">{getVehicleShort(c.vehicle_id)}</span>
                    </div>
                    <Badge variant={statusInfo.variant} className="gap-1">
                      <StatusIcon className="h-3 w-3" />
                      {statusInfo.label}
                    </Badge>
                  </div>

                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Motorista</span>
                      <span className="font-medium">{getDriverName(c)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Data</span>
                      <span>{format(new Date(c.checkin_date), "dd/MM/yyyy", { locale: ptBR })}</span>
                    </div>
                    {c.km_reported && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">KM</span>
                        <span>{c.km_reported.toLocaleString("pt-BR")}</span>
                      </div>
                    )}
                  </div>

                  {c.needs_maintenance && (
                    <div className="flex items-center gap-1.5 text-destructive bg-destructive/10 rounded-md px-2.5 py-1.5 text-xs font-medium">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Manutenção necessária
                    </div>
                  )}

                  {c.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 border-t pt-2">{c.description}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
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
                <Select value={form.driver_user_id} onValueChange={v => setForm(f => ({ ...f, driver_user_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {driverProfiles.map(p => <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Data</Label><Input type="date" value={form.checkin_date} onChange={e => setForm(f => ({ ...f, checkin_date: e.target.value }))} /></div>
              <div><Label>KM Reportado</Label><Input type="number" value={form.km_reported} onChange={e => setForm(f => ({ ...f, km_reported: e.target.value }))} /></div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.needs_maintenance} onCheckedChange={v => setForm(f => ({ ...f, needs_maintenance: v }))} />
              <Label>Precisa de manutenção</Label>
            </div>
            <div><Label>Descrição / Observações</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} /></div>
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
            <Button onClick={handleSubmit} disabled={!form.vehicle_id || !form.driver_user_id}>
              {editing ? "Salvar" : "Registrar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
