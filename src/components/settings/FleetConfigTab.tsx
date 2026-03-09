import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useFleetVehicles, FleetVehicle } from "@/hooks/useFleet";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, Car, Search, Users, Settings, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

const VEHICLE_STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Ativo", variant: "default" },
  maintenance: { label: "Em Manutenção", variant: "destructive" },
  reserve: { label: "Reserva", variant: "secondary" },
  inactive: { label: "Inativo", variant: "outline" },
};

interface Profile {
  user_id: string;
  name: string;
  whatsapp_number: string | null;
  job_title: string | null;
}

// ========== VEHICLES SUB-TAB ==========
function VehiclesSection() {
  const { vehicles, isLoading, createVehicle, updateVehicle, deleteVehicle } = useFleetVehicles();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<FleetVehicle | null>(null);
  const [search, setSearch] = useState("");

  // Fetch driver users (profiles with is_driver = true)
  const { data: driverProfiles = [] } = useQuery({
    queryKey: ["driver-profiles"],
    queryFn: async () => {
      const { data: perms } = await supabase
        .from("user_permissions")
        .select("user_id")
        .eq("is_driver" as any, true);
      if (!perms || perms.length === 0) return [];
      const driverIds = perms.map(p => p.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name")
        .in("user_id", driverIds);
      return (profiles || []) as Profile[];
    },
  });

  const [form, setForm] = useState({
    name: "", plate: "", brand: "", model: "", year: "", current_km: "",
    city: "", status: "active", driver_user_id: "", notes: "",
  });

  const resetForm = () => setForm({
    name: "", plate: "", brand: "", model: "", year: "", current_km: "",
    city: "", status: "active", driver_user_id: "", notes: "",
  });

  const openCreate = () => { resetForm(); setEditing(null); setDialogOpen(true); };
  const openEdit = (v: FleetVehicle) => {
    setEditing(v);
    setForm({
      name: v.name, plate: v.plate, brand: v.brand || "", model: v.model || "",
      year: v.year?.toString() || "", current_km: v.current_km?.toString() || "",
      city: v.city || "", status: v.status, driver_user_id: (v as any).driver_user_id || "", notes: v.notes || "",
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
      driver_user_id: form.driver_user_id && form.driver_user_id !== "none" ? form.driver_user_id : null,
      driver_id: null, // legacy field
      notes: form.notes || null,
    };
    if (editing) {
      await updateVehicle.mutateAsync({ id: editing.id, ...payload });
    } else {
      await createVehicle.mutateAsync(payload);
    }
    setDialogOpen(false); resetForm(); setEditing(null);
  };

  const filtered = vehicles.filter(v =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.plate.toLowerCase().includes(search.toLowerCase()) ||
    (v.city || "").toLowerCase().includes(search.toLowerCase())
  );

  const getDriverName = (v: FleetVehicle) => {
    const duid = (v as any).driver_user_id;
    if (duid) return driverProfiles.find(p => p.user_id === duid)?.name || "—";
    return "—";
  };

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{vehicles.length} veículo(s) cadastrado(s)</p>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar veículo..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Button onClick={openCreate} size="sm"><Plus className="h-4 w-4 mr-1" /> Novo</Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Car className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground text-sm">Nenhum veículo encontrado</p>
          <Button className="mt-3" size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Cadastrar</Button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Veículo</TableHead>
                <TableHead>Placa</TableHead>
                <TableHead className="hidden md:table-cell">Marca/Modelo</TableHead>
                <TableHead className="hidden md:table-cell">KM</TableHead>
                <TableHead>Motorista</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(v => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{v.name}</TableCell>
                  <TableCell className="font-mono text-sm">{v.plate}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {[v.brand, v.model, v.year].filter(Boolean).join(" ") || "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{v.current_km?.toLocaleString("pt-BR") || "—"}</TableCell>
                  <TableCell>{getDriverName(v)}</TableCell>
                  <TableCell>
                    <Badge variant={VEHICLE_STATUS_MAP[v.status]?.variant || "secondary"}>
                      {VEHICLE_STATUS_MAP[v.status]?.label || v.status}
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
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar Veículo" : "Novo Veículo"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Nome *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Saveiro SJO-01" /></div>
              <div><Label>Placa *</Label><Input value={form.plate} onChange={e => setForm(f => ({ ...f, plate: e.target.value }))} placeholder="ABC-1234" /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Marca</Label><Input value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} /></div>
              <div><Label>Modelo</Label><Input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} /></div>
              <div><Label>Ano</Label><Input type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>KM Atual</Label><Input type="number" value={form.current_km} onChange={e => setForm(f => ({ ...f, current_km: e.target.value }))} /></div>
              <div><Label>Cidade / Base</Label><Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
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
                <Select value={form.driver_user_id} onValueChange={v => setForm(f => ({ ...f, driver_user_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {driverProfiles.map(p => (
                      <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>
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

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir veículo?</AlertDialogTitle>
            <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteId) deleteVehicle.mutate(deleteId); setDeleteId(null); }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ========== DRIVERS SUB-TAB ==========
function DriversSection() {
  const queryClient = useQueryClient();

  const { data: profiles, isLoading: loadingProfiles } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, name, whatsapp_number, job_title")
        .order("name");
      if (error) throw error;
      return data as Profile[];
    },
  });

  const { data: allPermissions, isLoading: loadingPerms } = useQuery({
    queryKey: ["all-user-permissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_permissions")
        .select("*");
      if (error) throw error;
      return data;
    },
  });

  const { vehicles } = useFleetVehicles();

  const isDriver = (userId: string) => {
    const perms = allPermissions?.find((p: any) => p.user_id === userId);
    return (perms as any)?.is_driver ?? false;
  };

  const getVehicle = (userId: string) => {
    return vehicles.find((v: any) => v.driver_user_id === userId);
  };

  const toggleDriver = async (userId: string, currentValue: boolean) => {
    try {
      const existing = allPermissions?.find((p: any) => p.user_id === userId);
      if (existing) {
        const { error } = await supabase
          .from("user_permissions")
          .update({ is_driver: !currentValue } as any)
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_permissions")
          .insert({ user_id: userId, is_driver: true } as any);
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: ["all-user-permissions"] });
      queryClient.invalidateQueries({ queryKey: ["driver-profiles"] });
      toast.success(currentValue ? "Motorista desmarcado" : "Motorista marcado");
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar");
    }
  };

  if (loadingProfiles || loadingPerms) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const driverCount = profiles?.filter(p => isDriver(p.user_id)).length || 0;

  return (
    <div className="space-y-4">
      <CardDescription>
        Marque quais usuários do sistema são motoristas. Motoristas podem receber check-ins e ter veículos vinculados.
        <span className="ml-2 font-medium">{driverCount} motorista(s) ativo(s)</span>
      </CardDescription>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead className="hidden sm:table-cell">Cargo</TableHead>
              <TableHead className="hidden md:table-cell">WhatsApp</TableHead>
              <TableHead>Veículo Vinculado</TableHead>
              <TableHead className="text-center w-24">Motorista</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles?.map(profile => {
              const driver = isDriver(profile.user_id);
              const vehicle = getVehicle(profile.user_id);
              return (
                <TableRow key={profile.user_id}>
                  <TableCell className="font-medium">{profile.name}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">{profile.job_title || "—"}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{profile.whatsapp_number || "—"}</TableCell>
                  <TableCell>
                    {vehicle ? (
                      <Badge variant="secondary">{vehicle.name} ({vehicle.plate})</Badge>
                    ) : driver ? (
                      <span className="text-muted-foreground text-sm">Sem veículo</span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center">
                      <Switch checked={driver} onCheckedChange={() => toggleDriver(profile.user_id, driver)} />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ========== SETTINGS SUB-TAB ==========
function FleetSettingsSection() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ["fleet-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fleet_settings" as any)
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: boards } = useQuery({
    queryKey: ["all-boards-for-fleet"],
    queryFn: async () => {
      const { data, error } = await supabase.from("boards").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>(null);

  const currentForm = form || settings || {
    checkin_day: 1,
    checkin_time: "08:00",
    default_task_deadline_days: 3,
    auto_checkin_enabled: true,
    warranty_alerts_enabled: true,
    default_board_id: null,
    checkin_message_template: "Bom dia, {nome}.\n\nCheck-in semanal do veículo {veiculo}.\n\nResponda neste formato:\n\nKM:\nManutenção: sim ou não\nDescrição:",
  };

  const DAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        checkin_day: currentForm.checkin_day,
        checkin_time: currentForm.checkin_time,
        default_task_deadline_days: currentForm.default_task_deadline_days,
        auto_checkin_enabled: currentForm.auto_checkin_enabled,
        warranty_alerts_enabled: currentForm.warranty_alerts_enabled,
        default_board_id: currentForm.default_board_id && currentForm.default_board_id !== "none" ? currentForm.default_board_id : null,
        checkin_message_template: currentForm.checkin_message_template,
      };
      if (settings?.id) {
        const { error } = await supabase
          .from("fleet_settings" as any)
          .update(payload as any)
          .eq("id", settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("fleet_settings" as any)
          .insert(payload as any);
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: ["fleet-settings"] });
      toast.success("Configurações salvas");
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  const updateField = (key: string, value: any) => {
    setForm((prev: any) => ({ ...(prev || settings || currentForm), [key]: value }));
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 max-w-2xl">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Dia do Check-in</Label>
            <Select value={String(currentForm.checkin_day)} onValueChange={v => updateField("checkin_day", parseInt(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Horário do Check-in</Label>
            <Input type="time" value={currentForm.checkin_time?.slice(0, 5) || "08:00"} onChange={e => updateField("checkin_time", e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Prazo de tarefa (dias)</Label>
            <Input type="number" min={1} value={currentForm.default_task_deadline_days || 3} onChange={e => updateField("default_task_deadline_days", parseInt(e.target.value))} />
          </div>
          <div>
            <Label>Quadro para tarefas</Label>
            <Select value={currentForm.default_board_id || "none"} onValueChange={v => updateField("default_board_id", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {boards?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Switch checked={currentForm.auto_checkin_enabled} onCheckedChange={v => updateField("auto_checkin_enabled", v)} />
            <Label>Check-in automático</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={currentForm.warranty_alerts_enabled} onCheckedChange={v => updateField("warranty_alerts_enabled", v)} />
            <Label>Alertas de garantia</Label>
          </div>
        </div>
        <div>
          <Label>Modelo da mensagem de check-in</Label>
          <Textarea
            value={currentForm.checkin_message_template || ""}
            onChange={e => updateField("checkin_message_template", e.target.value)}
            rows={5}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground mt-1">Variáveis: {"{nome}"}, {"{veiculo}"}, {"{placa}"}</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="w-fit">
          {saving ? "Salvando..." : "Salvar Configurações"}
        </Button>
      </div>
    </div>
  );
}

// ========== MAIN COMPONENT ==========
export function FleetConfigTab() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="vehicles">
        <TabsList>
          <TabsTrigger value="vehicles" className="gap-1.5">
            <Car className="h-4 w-4" />
            Veículos
          </TabsTrigger>
          <TabsTrigger value="drivers" className="gap-1.5">
            <Users className="h-4 w-4" />
            Motoristas
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5">
            <Settings className="h-4 w-4" />
            Configurações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="vehicles" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Car className="h-5 w-5" />
                Veículos da Frota
              </CardTitle>
              <CardDescription>Cadastre e gerencie os veículos da empresa</CardDescription>
            </CardHeader>
            <CardContent>
              <VehiclesSection />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="drivers" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Motoristas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DriversSection />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Configurações da Frota
              </CardTitle>
              <CardDescription>Check-in automático, prazos e modelo de mensagem</CardDescription>
            </CardHeader>
            <CardContent>
              <FleetSettingsSection />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
