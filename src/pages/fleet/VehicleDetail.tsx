import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFleetVehicles, useFleetDrivers, useFleetMaintenances, useFleetDocuments, useFleetCheckins } from "@/hooks/useFleet";
import {
  ArrowLeft, Car, User, Gauge, MapPin, Calendar, Wrench, FileText,
  ClipboardCheck, AlertTriangle, Shield, ShieldAlert, ShieldCheck, Eye, Download,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, isBefore, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active: { label: "Ativo", color: "bg-green-500" },
  maintenance: { label: "Em Manutenção", color: "bg-orange-500" },
  reserve: { label: "Reserva", color: "bg-blue-500" },
  inactive: { label: "Inativo", color: "bg-muted-foreground" },
};

const MAINTENANCE_TYPES: Record<string, string> = {
  oil_change: "Troca de Óleo", tires: "Pneus", battery: "Bateria",
  brakes: "Freios", suspension: "Suspensão", electrical: "Elétrica",
  alignment: "Alinhamento", revision: "Revisão", other: "Outros",
};

const DOC_TYPES: Record<string, string> = {
  invoice: "Nota Fiscal", warranty: "Garantia", quote: "Orçamento",
  receipt: "Comprovante", photo: "Foto", ipva: "IPVA",
  insurance: "Seguro", licensing: "Licenciamento", other: "Outro",
};

const MAINT_STATUS: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  pending: { label: "Pendente", variant: "outline" },
  in_progress: { label: "Em Andamento", variant: "secondary" },
  completed: { label: "Realizada", variant: "default" },
};

export default function VehicleDetail() {
  const { vehicleId } = useParams<{ vehicleId: string }>();
  const navigate = useNavigate();
  const { vehicles, isLoading: loadingV } = useFleetVehicles();
  const { drivers } = useFleetDrivers();
  const { maintenances, isLoading: loadingM } = useFleetMaintenances();
  const { documents, isLoading: loadingD } = useFleetDocuments(vehicleId);
  const { checkins, isLoading: loadingC } = useFleetCheckins();

  const vehicle = vehicles.find((v) => v.id === vehicleId);
  const driver = vehicle?.driver_id ? drivers.find((d) => d.id === vehicle.driver_id) : null;

  const vehicleMaintenances = useMemo(
    () => maintenances.filter((m) => m.vehicle_id === vehicleId).sort((a, b) => b.maintenance_date.localeCompare(a.maintenance_date)),
    [maintenances, vehicleId]
  );

  const vehicleCheckins = useMemo(
    () => checkins.filter((c) => c.vehicle_id === vehicleId).slice(0, 20),
    [checkins, vehicleId]
  );

  const isLoading = loadingV || loadingM || loadingD || loadingC;

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid md:grid-cols-3 gap-4">
          <Skeleton className="h-48 col-span-2" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <Button variant="ghost" onClick={() => navigate("/fleet")} className="gap-1.5 mb-4">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <p className="text-muted-foreground">Veículo não encontrado.</p>
      </div>
    );
  }

  const status = STATUS_MAP[vehicle.status] || STATUS_MAP.inactive;
  const now = new Date();
  const lastMaint = vehicleMaintenances[0];

  // Alerts
  const alerts: { type: "warning" | "danger"; message: string }[] = [];

  // Oil change alert: check if last oil_change > 5000km ago or > 6 months
  const lastOilChange = vehicleMaintenances.find((m) => m.maintenance_type === "oil_change" && m.status === "completed");
  if (lastOilChange) {
    const kmSince = (vehicle.current_km || 0) - (lastOilChange.km_at_maintenance || 0);
    if (kmSince >= 5000) alerts.push({ type: "danger", message: `Troca de óleo atrasada — ${kmSince.toLocaleString("pt-BR")} km desde a última` });
    else if (kmSince >= 4000) alerts.push({ type: "warning", message: `Troca de óleo próxima — ${kmSince.toLocaleString("pt-BR")} km desde a última` });
  }

  // Pending maintenances
  const pendingMaint = vehicleMaintenances.filter((m) => m.status !== "completed").length;
  if (pendingMaint > 0) alerts.push({ type: "warning", message: `${pendingMaint} manutenção(ões) pendente(s)` });

  // Warranty/insurance/licensing alerts
  const expiringDocs = documents.filter((d) => {
    if (!d.warranty_expiry) return false;
    const exp = new Date(d.warranty_expiry);
    return isBefore(now, exp) && isBefore(exp, addDays(now, 30));
  });
  const expiredDocs = documents.filter((d) => {
    if (!d.warranty_expiry) return false;
    return isBefore(new Date(d.warranty_expiry), now);
  });
  if (expiredDocs.length > 0) alerts.push({ type: "danger", message: `${expiredDocs.length} documento(s) vencido(s)` });
  if (expiringDocs.length > 0) alerts.push({ type: "warning", message: `${expiringDocs.length} documento(s) vencendo em 30 dias` });

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/fleet")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{vehicle.name}</h1>
            <div className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${status.color}`} />
              <span className="text-sm text-muted-foreground">{status.label}</span>
            </div>
          </div>
          <p className="text-muted-foreground text-sm font-mono">{vehicle.plate}</p>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${
                alert.type === "danger"
                  ? "border-destructive/30 bg-destructive/5 text-destructive"
                  : "border-yellow-500/30 bg-yellow-500/5 text-yellow-700 dark:text-yellow-400"
              }`}
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {alert.message}
            </div>
          ))}
        </div>
      )}

      {/* Info cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Car className="h-4 w-4" />
              Informações Gerais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { icon: Car, label: "Marca/Modelo", value: [vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(" ") || "—" },
                { icon: Gauge, label: "KM Atual", value: vehicle.current_km?.toLocaleString("pt-BR") || "0" },
                { icon: MapPin, label: "Cidade", value: vehicle.city || "—" },
                { icon: Calendar, label: "Cadastrado em", value: format(new Date(vehicle.created_at), "dd/MM/yyyy", { locale: ptBR }) },
                { icon: Wrench, label: "Última Manutenção", value: lastMaint ? format(new Date(lastMaint.maintenance_date), "dd/MM/yyyy", { locale: ptBR }) : "Nenhuma" },
                { icon: FileText, label: "Documentos", value: `${documents.length} anexado(s)` },
              ].map((item) => (
                <div key={item.label} className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <item.icon className="h-3.5 w-3.5" />
                    {item.label}
                  </div>
                  <p className="text-sm font-medium">{item.value}</p>
                </div>
              ))}
            </div>
            {vehicle.notes && (
              <>
                <Separator className="my-4" />
                <p className="text-sm text-muted-foreground">{vehicle.notes}</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4" />
              Motorista Atual
            </CardTitle>
          </CardHeader>
          <CardContent>
            {driver ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                    {driver.name.split(" ").slice(0, 2).map((w) => w[0].toUpperCase()).join("")}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{driver.name}</p>
                    <p className="text-xs text-muted-foreground">{driver.job_title || "Motorista"}</p>
                  </div>
                </div>
                {driver.phone && (
                  <p className="text-xs text-muted-foreground">📱 {driver.phone}</p>
                )}
                {driver.city && (
                  <p className="text-xs text-muted-foreground">📍 {driver.city}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum motorista atribuído</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="maintenances" className="space-y-4">
        <TabsList>
          <TabsTrigger value="maintenances" className="gap-1.5">
            <Wrench className="h-4 w-4" />
            Manutenções
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-1.5">
            <FileText className="h-4 w-4" />
            Documentos
          </TabsTrigger>
          <TabsTrigger value="checkins" className="gap-1.5">
            <ClipboardCheck className="h-4 w-4" />
            Histórico de Uso
          </TabsTrigger>
        </TabsList>

        {/* Maintenances Tab */}
        <TabsContent value="maintenances">
          {vehicleMaintenances.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Wrench className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Nenhuma manutenção registrada</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {vehicleMaintenances.map((m) => {
                const mStatus = MAINT_STATUS[m.status] || MAINT_STATUS.pending;
                return (
                  <Card key={m.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                          m.status === "completed" ? "bg-green-500/10 text-green-600" :
                          m.status === "in_progress" ? "bg-blue-500/10 text-blue-600" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          <Wrench className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {MAINTENANCE_TYPES[m.maintenance_type] || m.maintenance_type}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(m.maintenance_date), "dd/MM/yyyy", { locale: ptBR })}
                            {m.km_at_maintenance ? ` · ${m.km_at_maintenance.toLocaleString("pt-BR")} km` : ""}
                            {m.cost ? ` · R$ ${Number(m.cost).toFixed(2)}` : ""}
                          </p>
                          {m.description && <p className="text-xs text-muted-foreground mt-1">{m.description}</p>}
                          {m.supplier && <p className="text-xs text-muted-foreground">Fornecedor: {m.supplier}</p>}
                        </div>
                      </div>
                      <Badge variant={mStatus.variant}>{mStatus.label}</Badge>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents">
          {documents.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Nenhum documento anexado</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {documents.map((d) => {
                const getWarrantyBadge = () => {
                  if (!d.warranty_expiry) return null;
                  const exp = new Date(d.warranty_expiry);
                  if (isBefore(exp, now)) return <Badge variant="destructive" className="gap-1 text-xs"><ShieldAlert className="h-3 w-3" />Vencido</Badge>;
                  if (isBefore(exp, addDays(now, 30))) return <Badge variant="outline" className="gap-1 text-xs text-yellow-600 border-yellow-600"><Shield className="h-3 w-3" />Vencendo</Badge>;
                  return <Badge variant="default" className="gap-1 text-xs"><ShieldCheck className="h-3 w-3" />Válido</Badge>;
                };
                return (
                  <Card key={d.id} className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{d.title}</p>
                            <Badge variant="secondary" className="text-[10px]">{DOC_TYPES[d.document_type] || d.document_type}</Badge>
                            {getWarrantyBadge()}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {d.supplier && `${d.supplier} · `}
                            {d.document_date ? format(new Date(d.document_date), "dd/MM/yyyy") : ""}
                            {d.warranty_expiry ? ` · Vence: ${format(new Date(d.warranty_expiry), "dd/MM/yyyy")}` : ""}
                          </p>
                        </div>
                      </div>
                      {d.file_url && (
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="icon" asChild>
                            <a href={d.file_url} target="_blank" rel="noopener"><Eye className="h-4 w-4" /></a>
                          </Button>
                          <Button variant="ghost" size="icon" asChild>
                            <a href={d.file_url} download={d.file_name}><Download className="h-4 w-4" /></a>
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Checkins / Usage History Tab */}
        <TabsContent value="checkins">
          {vehicleCheckins.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <ClipboardCheck className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Nenhum check-in registrado</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {vehicleCheckins.map((c) => {
                const d = drivers.find((dr) => dr.id === c.driver_id);
                return (
                  <Card key={c.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                          c.needs_maintenance ? "bg-red-500/10 text-red-600" :
                          c.status === "answered" ? "bg-green-500/10 text-green-600" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          <ClipboardCheck className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">
                              {format(new Date(c.checkin_date), "dd/MM/yyyy", { locale: ptBR })}
                            </p>
                            {c.needs_maintenance && (
                              <Badge variant="destructive" className="text-xs">Problema</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Motorista: {d?.name || "—"}
                            {c.km_reported ? ` · ${c.km_reported.toLocaleString("pt-BR")} km` : ""}
                          </p>
                          {c.description && <p className="text-xs text-muted-foreground mt-1">{c.description}</p>}
                        </div>
                      </div>
                      <Badge
                        variant={c.status === "answered" ? "default" : c.status === "pending" ? "outline" : "destructive"}
                        className="text-xs"
                      >
                        {c.status === "answered" ? "Respondido" : c.status === "pending" ? "Pendente" : "Atrasado"}
                      </Badge>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
