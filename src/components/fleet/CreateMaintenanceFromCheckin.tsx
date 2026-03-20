import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useFleetMaintenances, useFleetVehicles, FleetCheckin } from "@/hooks/useFleet";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Hammer, CheckCircle2, Wrench, AlertTriangle, ShieldAlert, ShieldCheck,
  Building2, FileText, WrenchIcon, Calendar, Clock, User, StickyNote, Loader2, Package
} from "lucide-react";

// --- Constants ---
const STANDARD_TOOLS = [
  "Notebook", "Alicate", "Conector", "Máquina de fusão", "Chave de fenda", "Outros"
];

const CRITICAL_KEYWORDS = ["barulho", "falha", "quebra", "motor", "freio", "suspensão", "vazamento", "trinca"];
const ATTENTION_KEYWORDS = ["balanceamento", "alinhamento", "folga", "desgaste", "vibração"];
const PREVENTIVE_KEYWORDS = ["revisão", "troca de óleo", "km", "preventiva", "filtro", "correia"];

type Priority = "critical" | "attention" | "low";
type MaintenanceType = "preventive" | "corrective";

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; icon: typeof ShieldAlert }> = {
  critical: { label: "Crítico", color: "bg-destructive text-destructive-foreground", icon: ShieldAlert },
  attention: { label: "Atenção", color: "bg-yellow-500 text-white", icon: AlertTriangle },
  low: { label: "Baixo", color: "bg-emerald-500 text-white", icon: ShieldCheck },
};

// --- Auto-detection helpers ---
function detectType(text: string): MaintenanceType {
  const lower = text.toLowerCase();
  if (PREVENTIVE_KEYWORDS.some(k => lower.includes(k))) return "preventive";
  return "corrective";
}

function detectPriority(text: string): Priority {
  const lower = text.toLowerCase();
  if (CRITICAL_KEYWORDS.some(k => lower.includes(k))) return "critical";
  if (ATTENTION_KEYWORDS.some(k => lower.includes(k))) return "attention";
  return "attention";
}

function parseToolsFromDescription(desc: string): string[] {
  const lower = desc.toLowerCase();
  return STANDARD_TOOLS.filter(t => lower.includes(t.toLowerCase()));
}

// --- Component ---
interface Props {
  checkin: FleetCheckin;
  vehicleName: string;
  alreadyCreated: boolean;
  onCreated: (checkinId: string) => void;
}

export default function CreateMaintenanceFromCheckin({ checkin, vehicleName, alreadyCreated, onCreated }: Props) {
  const { createMaintenance } = useFleetMaintenances();
  const { updateVehicle } = useFleetVehicles();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    maintenance_type: "corrective" as MaintenanceType,
    priority: "attention" as Priority,
    supplier: "",
    description: "",
    missing_tools: [] as string[],
    cost: "",
    scheduled_date: "",
    scheduled_time: "",
    assigned_to: "",
    notes: "",
  });

  // Fetch previous suppliers for suggestions
  const { data: previousSuppliers = [] } = useQuery({
    queryKey: ["fleet-suppliers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("fleet_maintenances" as any)
        .select("supplier")
        .not("supplier", "is", null);
      const unique = [...new Set((data || []).map((d: any) => d.supplier).filter(Boolean))];
      return unique as string[];
    },
    enabled: open,
  });

  // Fetch profiles for responsible select
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-list"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, name").eq("is_active", true).order("name");
      return (data || []) as { user_id: string; name: string }[];
    },
    enabled: open,
  });

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (alreadyCreated) return;

    const descParts: string[] = [];
    if (checkin.description) descParts.push(checkin.description);
    const toolsDesc = (checkin as any).tools_description;
    if (toolsDesc) descParts.push(`Ferramentas: ${toolsDesc}`);
    const fullDesc = descParts.join("\n") || `Manutenção reportada no check-in de ${format(new Date(checkin.checkin_date), "dd/MM/yyyy")}`;

    const detectedType = detectType(fullDesc);
    const detectedPriority = detectPriority(fullDesc);
    const detectedTools = toolsDesc ? parseToolsFromDescription(toolsDesc) : [];

    setForm({
      maintenance_type: detectedType,
      priority: detectedPriority,
      supplier: "",
      description: fullDesc,
      missing_tools: detectedTools,
      cost: "",
      scheduled_date: new Date().toISOString().split("T")[0],
      scheduled_time: "",
      assigned_to: "",
      notes: "",
    });
    setOpen(true);
  };

  const toggleTool = (tool: string) => {
    setForm(f => ({
      ...f,
      missing_tools: f.missing_tools.includes(tool)
        ? f.missing_tools.filter(t => t !== tool)
        : [...f.missing_tools, tool],
    }));
  };

  const handleSubmit = async () => {
    if (!form.scheduled_date || !form.priority) {
      toast.error("Prioridade e data de agendamento são obrigatórios");
      return;
    }

    setLoading(true);
    try {
      // 1. Create maintenance record
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
        priority: form.priority,
        scheduled_date: form.scheduled_date || undefined,
        scheduled_time: form.scheduled_time || undefined,
        assigned_to: form.assigned_to || undefined,
        missing_tools: form.missing_tools.length > 0 ? form.missing_tools : undefined,
      } as any);

      // 2. Update vehicle status based on priority
      if (form.priority === "critical") {
        await updateVehicle.mutateAsync({ id: checkin.vehicle_id, status: "maintenance" } as any);
      }

      // 3. Update checkin resolution_status
      await supabase
        .from("fleet_checkins" as any)
        .update({ resolution_status: "scheduled" } as any)
        .eq("id", checkin.id);

      // 4. Create Kanban task if board configured
      try {
        const { data: settings } = await supabase
          .from("fleet_settings" as any)
          .select("default_board_id, default_assignee_id")
          .limit(1)
          .single();

        const boardId = (settings as any)?.default_board_id;
        if (boardId) {
          const { data: columns } = await supabase
            .from("board_columns" as any)
            .select("id")
            .eq("board_id", boardId)
            .order("position", { ascending: true })
            .limit(1);

          const firstColId = (columns as any)?.[0]?.id;
          if (firstColId) {
            const taskTitle = `Manutenção - ${vehicleName}`;
            const taskDesc = [
              form.description,
              form.missing_tools.length > 0 ? `\nFerramentas faltantes: ${form.missing_tools.join(", ")}` : "",
              `Prioridade: ${PRIORITY_CONFIG[form.priority].label}`,
            ].filter(Boolean).join("\n");

            await supabase
              .from("tasks" as any)
              .insert({
                title: taskTitle,
                description: taskDesc,
                column_id: firstColId,
                assignee_id: form.assigned_to || (settings as any)?.default_assignee_id || user?.id,
                due_date: form.scheduled_date ? new Date(form.scheduled_date).toISOString() : null,
                created_by: user?.id,
                priority: form.priority === "critical" ? "urgent" : form.priority === "attention" ? "high" : "medium",
              } as any);

            // 5. Notify assigned user
            if (form.assigned_to) {
              const assigneeName = profiles.find(p => p.user_id === form.assigned_to)?.name || "";
              try {
                await supabase.functions.invoke("notify-task-assigned", {
                  body: {
                    taskTitle: taskTitle,
                    assigneeId: form.assigned_to,
                    assigneeName,
                    assignedBy: user?.id,
                  },
                });
              } catch { /* notification is best-effort */ }
            }
          }
        }
      } catch { /* kanban integration is best-effort */ }

      queryClient.invalidateQueries({ queryKey: ["fleet-checkins"] });
      queryClient.invalidateQueries({ queryKey: ["fleet-vehicles"] });

      toast.success(`Manutenção criada para ${vehicleName}`, {
        description: `Prioridade: ${PRIORITY_CONFIG[form.priority].label} • Agendada: ${format(new Date(form.scheduled_date), "dd/MM/yyyy")}`,
      });
      onCreated(checkin.id);
      setOpen(false);
    } catch {
      toast.error("Erro ao criar manutenção");
    } finally {
      setLoading(false);
    }
  };

  const PriorityIcon = PRIORITY_CONFIG[form.priority].icon;

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
        <DialogContent
          className="max-w-xl max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-primary" />
              Criar Manutenção — {vehicleName}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-5 py-2">
            {/* Type + Priority row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-sm font-medium">
                  <WrenchIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  Tipo de Manutenção
                </Label>
                <Select value={form.maintenance_type} onValueChange={v => setForm(f => ({ ...f, maintenance_type: v as MaintenanceType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preventive">Preventiva</SelectItem>
                    <SelectItem value="corrective">Corretiva</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-sm font-medium">
                  <PriorityIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  Prioridade *
                </Label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v as Priority }))}>
                  <SelectTrigger>
                    <div className="flex items-center gap-2">
                      <Badge className={`${PRIORITY_CONFIG[form.priority].color} text-xs px-1.5 py-0`}>
                        {PRIORITY_CONFIG[form.priority].label}
                      </Badge>
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
                        <span>Crítico</span>
                        <span className="text-xs text-muted-foreground">— veículo não deve rodar</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="attention">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
                        <span>Atenção</span>
                        <span className="text-xs text-muted-foreground">— pode rodar, mas precisa manutenção</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="low">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                        <span>Baixo</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Supplier */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-sm font-medium">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                Oficina / Fornecedor
              </Label>
              <Input
                value={form.supplier}
                onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))}
                placeholder="Nome da oficina"
                list="supplier-suggestions"
              />
              <datalist id="supplier-suggestions">
                {previousSuppliers.map(s => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-sm font-medium">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                Problema do Veículo
              </Label>
              <Textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>

            {/* Missing Tools */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-sm font-medium">
                <Package className="h-3.5 w-3.5 text-muted-foreground" />
                Ferramentas Faltantes
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {STANDARD_TOOLS.map(tool => (
                  <label
                    key={tool}
                    className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-accent/50 transition-colors"
                  >
                    <Checkbox
                      checked={form.missing_tools.includes(tool)}
                      onCheckedChange={() => toggleTool(tool)}
                    />
                    {tool}
                  </label>
                ))}
              </div>
            </div>

            {/* Cost + Schedule row */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-sm font-medium">
                  R$ Custo Estimado
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.cost}
                  onChange={e => setForm(f => ({ ...f, cost: e.target.value }))}
                  placeholder="250,00"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-sm font-medium">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  Data Agendamento *
                </Label>
                <Input
                  type="date"
                  value={form.scheduled_date}
                  onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-sm font-medium">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  Horário
                </Label>
                <Input
                  type="time"
                  value={form.scheduled_time}
                  onChange={e => setForm(f => ({ ...f, scheduled_time: e.target.value }))}
                />
              </div>
            </div>

            {/* Responsible */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-sm font-medium">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                Responsável
              </Label>
              <Select value={form.assigned_to || "none"} onValueChange={v => setForm(f => ({ ...f, assigned_to: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione um responsável" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {profiles.map(p => (
                    <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-sm font-medium">
                <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />
                Observações
              </Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                placeholder="Informações adicionais..."
              />
            </div>

            {/* Priority warning */}
            {form.priority === "critical" && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive flex items-start gap-2">
                <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
                <span>O veículo será marcado como <strong>Indisponível</strong> ao criar esta manutenção.</span>
              </div>
            )}

            {/* Submit */}
            <Button
              onClick={handleSubmit}
              disabled={loading || !form.scheduled_date || !form.priority}
              className="w-full gap-2 h-11"
              size="lg"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Hammer className="h-4 w-4" />
              )}
              {loading ? "Criando..." : "Criar Manutenção"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
