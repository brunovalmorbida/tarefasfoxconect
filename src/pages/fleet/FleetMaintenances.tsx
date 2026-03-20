import { useState, useRef } from "react";
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
import { useFleetMaintenances, useFleetVehicles, FleetMaintenance, uploadFleetFile } from "@/hooks/useFleet";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search, Wrench, Pencil, Trash2, ShieldAlert, AlertTriangle, ShieldCheck, Upload, Eye, DollarSign } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const MAINTENANCE_TYPES = [
  { value: "preventive", label: "Preventiva" },
  { value: "corrective", label: "Corretiva" },
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

const PRIORITY_MAP: Record<string, { label: string; className: string; icon: typeof ShieldAlert }> = {
  critical: { label: "Crítico", className: "bg-destructive text-destructive-foreground", icon: ShieldAlert },
  attention: { label: "Atenção", className: "bg-yellow-500 text-white", icon: AlertTriangle },
  low: { label: "Baixo", className: "bg-emerald-500 text-white", icon: ShieldCheck },
};

const PAYMENT_METHODS = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "cartao", label: "Cartão" },
  { value: "boleto", label: "Boleto" },
];

export default function FleetMaintenances() {
  const { maintenances, isLoading, createMaintenance, updateMaintenance, deleteMaintenance } = useFleetMaintenances();
  const { vehicles } = useFleetVehicles();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<FleetMaintenance | null>(null);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    vehicle_id: "", maintenance_type: "other", maintenance_date: new Date().toISOString().split("T")[0],
    km_at_maintenance: "", cost: "", actual_cost: "", supplier: "", description: "", notes: "", status: "pending",
    priority: "attention", scheduled_date: "", assigned_to: "",
    payment_date: "", payment_method: "", financial_status: "pending",
    receipt_url: "", receipt_file_name: "",
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-list"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, name").eq("is_active", true).order("name");
      return (data || []) as { user_id: string; name: string }[];
    },
  });

  const resetForm = () => setForm({
    vehicle_id: "", maintenance_type: "other", maintenance_date: new Date().toISOString().split("T")[0],
    km_at_maintenance: "", cost: "", actual_cost: "", supplier: "", description: "", notes: "", status: "pending",
    priority: "attention", scheduled_date: "", assigned_to: "",
    payment_date: "", payment_method: "", financial_status: "pending",
    receipt_url: "", receipt_file_name: "",
  });

  const openCreate = () => { resetForm(); setEditing(null); setDialogOpen(true); };
  const openEdit = (m: FleetMaintenance) => {
    setEditing(m);
    setForm({
      vehicle_id: m.vehicle_id, maintenance_type: m.maintenance_type,
      maintenance_date: m.maintenance_date, km_at_maintenance: m.km_at_maintenance?.toString() || "",
      cost: m.cost?.toString() || "", actual_cost: m.actual_cost?.toString() || "",
      supplier: m.supplier || "", description: m.description || "", notes: m.notes || "", status: m.status,
      priority: m.priority || "attention", scheduled_date: m.scheduled_date || "", assigned_to: m.assigned_to || "",
      payment_date: m.payment_date || "", payment_method: m.payment_method || "",
      financial_status: m.financial_status || "pending",
      receipt_url: m.receipt_url || "", receipt_file_name: m.receipt_file_name || "",
    });
    setDialogOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !form.vehicle_id) return;
    setUploading(true);
    try {
      const url = await uploadFleetFile(file, form.vehicle_id);
      setForm(f => ({ ...f, receipt_url: url, receipt_file_name: file.name }));
      toast.success("Comprovante enviado");
    } catch {
      toast.error("Erro ao enviar comprovante");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.vehicle_id) return;

    // Validate: if completing, require financial fields
    if (form.status === "completed" && !editing?.actual_cost && !form.actual_cost) {
      toast.error("Preencha o custo real para finalizar a manutenção");
      return;
    }

    const payload: any = {
      vehicle_id: form.vehicle_id, maintenance_type: form.maintenance_type,
      maintenance_date: form.maintenance_date,
      km_at_maintenance: form.km_at_maintenance ? parseInt(form.km_at_maintenance) : null,
      cost: form.cost ? parseFloat(form.cost) : null,
      actual_cost: form.actual_cost ? parseFloat(form.actual_cost) : null,
      supplier: form.supplier || null, description: form.description || null,
      notes: form.notes || null, status: form.status, priority: form.priority,
      scheduled_date: form.scheduled_date || null, assigned_to: form.assigned_to || null,
      payment_date: form.payment_date || null, payment_method: form.payment_method || null,
      financial_status: form.financial_status,
      receipt_url: form.receipt_url || null, receipt_file_name: form.receipt_file_name || null,
    };
    if (editing) {
      await updateMaintenance.mutateAsync({ id: editing.id, ...payload });
    } else {
      await createMaintenance.mutateAsync(payload);
    }
    setDialogOpen(false); resetForm(); setEditing(null);
  };

  const getTypeName = (type: string) => MAINTENANCE_TYPES.find(t => t.value === type)?.label || type;
  const getProfileName = (userId: string | null) => {
    if (!userId) return "—";
    return profiles.find(p => p.user_id === userId)?.name || "—";
  };

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
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead className="hidden md:table-cell">Estimado</TableHead>
                  <TableHead className="hidden md:table-cell">Custo Real</TableHead>
                  <TableHead className="hidden lg:table-cell">Financeiro</TableHead>
                  <TableHead className="hidden lg:table-cell">Pagamento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(m => {
                  const v = vehicles.find(v => v.id === m.vehicle_id);
                  const priority = PRIORITY_MAP[m.priority] || PRIORITY_MAP.attention;
                  const PIcon = priority.icon;
                  const isPaid = m.financial_status === "paid";
                  const hasCost = !!(m.actual_cost || m.cost);
                  return (
                    <TableRow key={m.id} className={cn(!isPaid && hasCost && "bg-red-500/5")}>
                      <TableCell>{format(new Date(m.maintenance_date), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                      <TableCell className="font-medium">{v?.name || "—"}</TableCell>
                      <TableCell>{getTypeName(m.maintenance_type)}</TableCell>
                      <TableCell>
                        <Badge className={`${priority.className} gap-1 text-xs`}>
                          <PIcon className="h-3 w-3" />
                          {priority.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell tabular-nums">{m.cost ? `R$ ${Number(m.cost).toFixed(2)}` : "—"}</TableCell>
                      <TableCell className="hidden md:table-cell tabular-nums font-medium">{m.actual_cost ? `R$ ${Number(m.actual_cost).toFixed(2)}` : "—"}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Badge variant={isPaid ? "default" : "outline"} className={cn("text-xs", !isPaid && hasCost && "text-red-600 border-red-600")}>
                          {isPaid ? "Pago" : "Pendente"}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs">{m.payment_method || "—"}</TableCell>
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Prioridade</Label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">🔴 Crítico</SelectItem>
                    <SelectItem value="attention">🟡 Atenção</SelectItem>
                    <SelectItem value="low">🟢 Baixo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Responsável</Label>
                <Select value={form.assigned_to || "none"} onValueChange={v => setForm(f => ({ ...f, assigned_to: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {profiles.map(p => <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Data</Label><Input type="date" value={form.maintenance_date} onChange={e => setForm(f => ({ ...f, maintenance_date: e.target.value }))} /></div>
              <div><Label>KM</Label><Input type="number" value={form.km_at_maintenance} onChange={e => setForm(f => ({ ...f, km_at_maintenance: e.target.value }))} /></div>
              <div><Label>Agendamento</Label><Input type="date" value={form.scheduled_date} onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))} /></div>
            </div>
            <div><Label>Fornecedor / Oficina</Label><Input value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} /></div>
            <div><Label>Descrição do Serviço</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>

            {/* Financial Section */}
            <div className="border-t pt-4 space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2"><DollarSign className="h-4 w-4" /> Financeiro</h3>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Custo Estimado (R$)</Label><Input type="number" step="0.01" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} placeholder="250,00" /></div>
                <div>
                  <Label>Custo Real (R$) {form.status === "completed" && "*"}</Label>
                  <Input type="number" step="0.01" value={form.actual_cost} onChange={e => setForm(f => ({ ...f, actual_cost: e.target.value }))} placeholder="280,00" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Data Pagamento</Label>
                  <Input type="date" value={form.payment_date} onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))} />
                </div>
                <div>
                  <Label>Forma de Pagamento</Label>
                  <Select value={form.payment_method || "none"} onValueChange={v => setForm(f => ({ ...f, payment_method: v === "none" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {PAYMENT_METHODS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status Financeiro</Label>
                  <Select value={form.financial_status} onValueChange={v => setForm(f => ({ ...f, financial_status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="paid">Pago</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Comprovante</Label>
                <div className="flex items-center gap-2 mt-1">
                  <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileUpload} />
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading || !form.vehicle_id}>
                    <Upload className="h-4 w-4 mr-1" /> {uploading ? "Enviando..." : "Upload"}
                  </Button>
                  {form.receipt_file_name && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="truncate max-w-[150px]">{form.receipt_file_name}</span>
                      {form.receipt_url && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                          <a href={form.receipt_url} target="_blank" rel="noopener"><Eye className="h-3 w-3" /></a>
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div><Label>Observações</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
            <div className="grid grid-cols-2 gap-4">
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
