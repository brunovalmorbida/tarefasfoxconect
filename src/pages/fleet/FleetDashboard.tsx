import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useFleetVehicles, useFleetDrivers, useFleetCheckins, useFleetMaintenances, useFleetDocuments } from "@/hooks/useFleet";
import { Car, Users, ClipboardCheck, Wrench, FileText, AlertTriangle, Shield, ShieldAlert } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, addDays, isBefore, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";

function StatCard({ label, value, icon: Icon, color = "text-primary", description }: { label: string; value: number | string; icon: any; color?: string; description?: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className={`rounded-xl p-3 bg-muted ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function FleetDashboard() {
  const { vehicles, isLoading: loadingV } = useFleetVehicles();
  const { drivers, isLoading: loadingD } = useFleetDrivers();
  const { checkins, isLoading: loadingC } = useFleetCheckins();
  const { maintenances, isLoading: loadingM } = useFleetMaintenances();
  const { documents, isLoading: loadingDoc } = useFleetDocuments();

  const isLoading = loadingV || loadingD || loadingC || loadingM || loadingDoc;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  const now = new Date();
  const activeVehicles = vehicles.filter(v => v.status === "active").length;
  const inMaintenance = vehicles.filter(v => v.status === "maintenance").length;

  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const weekCheckins = checkins.filter(c => {
    const d = new Date(c.checkin_date);
    return d >= weekStart && d <= weekEnd;
  });
  const pendingCheckins = weekCheckins.filter(c => c.status === "pending").length;
  const problemCheckins = weekCheckins.filter(c => c.needs_maintenance).length;

  const pendingMaintenances = maintenances.filter(m => m.status !== "completed").length;

  const warrantyDocs = documents.filter(d => d.document_type === "warranty" && d.warranty_expiry);
  const expiringWarranties = warrantyDocs.filter(d => {
    const expiry = new Date(d.warranty_expiry!);
    return isBefore(now, expiry) && isBefore(expiry, addDays(now, 30));
  }).length;
  const expiredWarranties = warrantyDocs.filter(d => isBefore(new Date(d.warranty_expiry!), now)).length;

  const driversNoCheckin = (() => {
    const answeredDriverIds = new Set(weekCheckins.filter(c => c.status === "answered").map(c => c.driver_id));
    return drivers.filter(d => d.status === "active" && d.vehicle_id && !answeredDriverIds.has(d.id));
  })();

  const recentProblems = checkins
    .filter(c => c.needs_maintenance)
    .slice(0, 5);

  const recentMaintenances = maintenances.slice(0, 5);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard da Frota</h2>
        <p className="text-muted-foreground text-sm">Visão geral da frota da empresa</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total de Veículos" value={vehicles.length} icon={Car} />
        <StatCard label="Veículos Ativos" value={activeVehicles} icon={Car} color="text-green-600" />
        <StatCard label="Em Manutenção" value={inMaintenance} icon={Wrench} color="text-orange-600" />
        <StatCard label="Check-ins Pendentes" value={pendingCheckins} icon={ClipboardCheck} color="text-yellow-600" />
        <StatCard label="Problemas Informados" value={problemCheckins} icon={AlertTriangle} color="text-red-600" />
        <StatCard label="Manutenções Abertas" value={pendingMaintenances} icon={Wrench} color="text-blue-600" />
        <StatCard label="Garantias Vencendo" value={expiringWarranties} icon={Shield} color="text-yellow-600" description="Próximos 30 dias" />
        <StatCard label="Garantias Vencidas" value={expiredWarranties} icon={ShieldAlert} color="text-red-600" />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Motoristas sem check-in */}
        <Card>
          <CardHeader><CardTitle className="text-base">Motoristas sem check-in esta semana</CardTitle></CardHeader>
          <CardContent>
            {driversNoCheckin.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todos os motoristas responderam ✓</p>
            ) : (
              <div className="space-y-2">
                {driversNoCheckin.map(d => {
                  const v = vehicles.find(v => v.id === d.vehicle_id);
                  return (
                    <div key={d.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <div>
                        <p className="text-sm font-medium">{d.name}</p>
                        <p className="text-xs text-muted-foreground">{v ? `${v.name} (${v.plate})` : "Sem veículo"}</p>
                      </div>
                      <Badge variant="outline" className="text-yellow-600 border-yellow-600">Pendente</Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Últimos problemas */}
        <Card>
          <CardHeader><CardTitle className="text-base">Últimos problemas informados</CardTitle></CardHeader>
          <CardContent>
            {recentProblems.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum problema recente</p>
            ) : (
              <div className="space-y-2">
                {recentProblems.map(c => {
                  const v = vehicles.find(v => v.id === c.vehicle_id);
                  const d = drivers.find(d => d.id === c.driver_id);
                  return (
                    <div key={c.id} className="p-2 rounded-lg bg-muted/50">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{v?.name || "Veículo"} ({v?.plate})</p>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(c.checkin_date), "dd/MM", { locale: ptBR })}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{c.description || "Sem descrição"}</p>
                      <p className="text-xs text-muted-foreground">Motorista: {d?.name}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Últimas manutenções */}
        <Card>
          <CardHeader><CardTitle className="text-base">Últimas manutenções</CardTitle></CardHeader>
          <CardContent>
            {recentMaintenances.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma manutenção registrada</p>
            ) : (
              <div className="space-y-2">
                {recentMaintenances.map(m => {
                  const v = vehicles.find(v => v.id === m.vehicle_id);
                  return (
                    <div key={m.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <div>
                        <p className="text-sm font-medium">{v?.name} — {m.maintenance_type}</p>
                        <p className="text-xs text-muted-foreground">{m.description || "Sem descrição"}</p>
                      </div>
                      <Badge variant={m.status === "completed" ? "default" : m.status === "in_progress" ? "secondary" : "outline"}>
                        {m.status === "completed" ? "Realizada" : m.status === "in_progress" ? "Em andamento" : "Pendente"}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Garantias próximas de vencer */}
        <Card>
          <CardHeader><CardTitle className="text-base">Garantias próximas de vencer</CardTitle></CardHeader>
          <CardContent>
            {(() => {
              const expiring = warrantyDocs.filter(d => {
                const expiry = new Date(d.warranty_expiry!);
                return isBefore(now, expiry) && isBefore(expiry, addDays(now, 30));
              });
              if (expiring.length === 0) return <p className="text-sm text-muted-foreground">Nenhuma garantia vencendo em 30 dias</p>;
              return (
                <div className="space-y-2">
                  {expiring.map(doc => {
                    const v = vehicles.find(v => v.id === doc.vehicle_id);
                    return (
                      <div key={doc.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                        <div>
                          <p className="text-sm font-medium">{doc.title}</p>
                          <p className="text-xs text-muted-foreground">{v?.name} — {doc.supplier}</p>
                        </div>
                        <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                          {format(new Date(doc.warranty_expiry!), "dd/MM/yyyy")}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
