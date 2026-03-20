import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useFleetVehicles, useFleetDrivers, useFleetCheckins, useFleetMaintenances, useFleetDocuments } from "@/hooks/useFleet";
import { useVehicleScores } from "@/hooks/useVehicleScore";
import { VehicleScoreBadge } from "@/components/fleet/VehicleScoreBadge";
import { Car, Users, ClipboardCheck, Wrench, FileText, AlertTriangle, Shield, ShieldAlert, Activity, TrendingUp, TrendingDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, addDays, isBefore, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

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

  const scores = useVehicleScores(vehicles, maintenances, checkins);

  const scoreStats = useMemo(() => {
    if (vehicles.length === 0) return { avg: 0, healthy: 0, attention: 0, critical: 0, best: [], worst: [] };

    let total = 0;
    let healthy = 0, attention = 0, critical = 0;
    const entries: { id: string; name: string; plate: string; score: number; classification: string }[] = [];

    for (const v of vehicles) {
      const s = scores.get(v.id);
      if (!s) continue;
      total += s.score;
      if (s.classification === "healthy") healthy++;
      else if (s.classification === "attention") attention++;
      else critical++;
      entries.push({ id: v.id, name: v.name, plate: v.plate, score: s.score, classification: s.classification });
    }

    entries.sort((a, b) => a.score - b.score);
    const worst = entries.slice(0, 5);
    const best = [...entries].sort((a, b) => b.score - a.score).slice(0, 5);
    const avg = Math.round(total / vehicles.length);

    return { avg, healthy, attention, critical, best, worst };
  }, [vehicles, scores]);

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

  const recentProblems = checkins.filter(c => c.needs_maintenance).slice(0, 5);
  const recentMaintenances = maintenances.slice(0, 5);

  const avgClassification = scoreStats.avg >= 80 ? "healthy" : scoreStats.avg >= 50 ? "attention" : "critical";
  const avgColor = avgClassification === "healthy" ? "text-green-600" : avgClassification === "attention" ? "text-yellow-600" : "text-red-600";
  const avgBg = avgClassification === "healthy" ? "bg-green-500/10" : avgClassification === "attention" ? "bg-yellow-500/10" : "bg-red-500/10";
  const avgProgressColor = avgClassification === "healthy" ? "[&>div]:bg-green-500" : avgClassification === "attention" ? "[&>div]:bg-yellow-500" : "[&>div]:bg-red-500";

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard da Frota</h2>
        <p className="text-muted-foreground text-sm">Visão geral da frota da empresa</p>
      </div>

      {/* Score Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className={cn("md:col-span-1", avgBg, "border-0")}>
          <CardContent className="flex flex-col items-center justify-center p-6 text-center">
            <Activity className={cn("h-6 w-6 mb-2", avgColor)} />
            <p className={cn("text-4xl font-bold tabular-nums", avgColor)}>{scoreStats.avg}</p>
            <p className="text-sm font-medium text-muted-foreground mt-1">Score Médio</p>
            <Progress value={scoreStats.avg} className={cn("h-2 mt-3 w-full", avgProgressColor)} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Distribuição</p>
            <div className="space-y-2">
              {[
                { label: "Saudável", count: scoreStats.healthy, color: "bg-green-500", textColor: "text-green-600" },
                { label: "Atenção", count: scoreStats.attention, color: "bg-yellow-500", textColor: "text-yellow-600" },
                { label: "Crítico", count: scoreStats.critical, color: "bg-red-500", textColor: "text-red-600" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn("h-2.5 w-2.5 rounded-full", item.color)} />
                    <span className="text-sm">{item.label}</span>
                  </div>
                  <span className={cn("text-sm font-bold tabular-nums", item.textColor)}>{item.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground mb-1">
              <TrendingDown className="h-4 w-4 text-red-500" />
              Piores Scores
            </div>
            {scoreStats.worst.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem dados</p>
            ) : (
              scoreStats.worst.map((v) => {
                const s = scores.get(v.id)!;
                return (
                  <div key={v.id} className="flex items-center justify-between">
                    <span className="text-xs truncate max-w-[160px]">{v.name} <span className="text-muted-foreground font-mono">({v.plate})</span></span>
                    <VehicleScoreBadge score={s.score} classification={s.classification} compact />
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Melhores Scores
            </div>
            {scoreStats.best.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem dados</p>
            ) : (
              scoreStats.best.map((v) => {
                const s = scores.get(v.id)!;
                return (
                  <div key={v.id} className="flex items-center justify-between">
                    <span className="text-xs truncate max-w-[120px]">{v.name}</span>
                    <VehicleScoreBadge score={s.score} classification={s.classification} compact />
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Operational Stats */}
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
