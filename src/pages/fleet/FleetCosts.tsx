import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFleetMaintenances, useFleetVehicles, useFleetDrivers } from "@/hooks/useFleet";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, TrendingUp, Car, User, Wrench, AlertTriangle, CircleDollarSign } from "lucide-react";
import { subDays, isAfter, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const MAINTENANCE_TYPES: Record<string, string> = {
  preventive: "Preventiva", corrective: "Corretiva", oil_change: "Troca de Óleo",
  tires: "Pneus", battery: "Bateria", brakes: "Freios", suspension: "Suspensão",
  electrical: "Elétrica", alignment: "Alinhamento", revision: "Revisão", other: "Outros",
};

const PERIOD_OPTIONS = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "all", label: "Todo período" },
];

export default function FleetCosts() {
  const { maintenances, isLoading: loadingM } = useFleetMaintenances();
  const { vehicles, isLoading: loadingV } = useFleetVehicles();
  const { drivers } = useFleetDrivers();
  const [period, setPeriod] = useState("30");
  const [vehicleFilter, setVehicleFilter] = useState("all");

  const isLoading = loadingM || loadingV;

  const filteredMaints = useMemo(() => {
    const now = new Date();
    return maintenances.filter(m => {
      if (vehicleFilter !== "all" && m.vehicle_id !== vehicleFilter) return false;
      if (period !== "all") {
        const daysAgo = subDays(now, parseInt(period));
        if (!isAfter(new Date(m.maintenance_date), daysAgo)) return false;
      }
      return true;
    });
  }, [maintenances, period, vehicleFilter]);

  const stats = useMemo(() => {
    const withCost = filteredMaints.filter(m => (m.actual_cost || m.cost));
    const totalSpent = withCost.reduce((sum, m) => sum + (m.actual_cost || m.cost || 0), 0);
    const avgPerVehicle = vehicles.length > 0 ? totalSpent / vehicles.length : 0;
    const mostExpensive = withCost.sort((a, b) => (b.actual_cost || b.cost || 0) - (a.actual_cost || a.cost || 0))[0];
    const unpaidCount = filteredMaints.filter(m => m.financial_status !== "paid" && (m.actual_cost || m.cost)).length;

    // Cost by vehicle
    const byVehicle = new Map<string, number>();
    filteredMaints.forEach(m => {
      const cost = m.actual_cost || m.cost || 0;
      byVehicle.set(m.vehicle_id, (byVehicle.get(m.vehicle_id) || 0) + cost);
    });
    const vehicleRanking = [...byVehicle.entries()]
      .map(([id, total]) => ({ id, total, vehicle: vehicles.find(v => v.id === id) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // Cost by maintenance type
    const byType = new Map<string, number>();
    filteredMaints.forEach(m => {
      const cost = m.actual_cost || m.cost || 0;
      byType.set(m.maintenance_type, (byType.get(m.maintenance_type) || 0) + cost);
    });
    const typeRanking = [...byType.entries()]
      .map(([type, total]) => ({ type, total }))
      .sort((a, b) => b.total - a.total);

    // Cost by driver (via vehicle's driver_id)
    const byDriver = new Map<string, number>();
    filteredMaints.forEach(m => {
      const v = vehicles.find(v => v.id === m.vehicle_id);
      if (v?.driver_id) {
        const cost = m.actual_cost || m.cost || 0;
        byDriver.set(v.driver_id, (byDriver.get(v.driver_id) || 0) + cost);
      }
    });
    const driverRanking = [...byDriver.entries()]
      .map(([id, total]) => ({ id, total, driver: drivers.find(d => d.id === id) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // Insights
    const insights: string[] = [];
    const avgCost = vehicles.length > 0 ? totalSpent / vehicles.length : 0;
    vehicleRanking.forEach(vr => {
      if (vr.total > avgCost * 1.5 && vr.vehicle) {
        insights.push(`${vr.vehicle.name} (${vr.vehicle.plate}) teve custo ${Math.round((vr.total / avgCost - 1) * 100)}% acima da média`);
      }
    });
    if (unpaidCount > 0) {
      insights.push(`${unpaidCount} manutenção(ões) com pagamento pendente`);
    }

    return { totalSpent, avgPerVehicle, mostExpensive, unpaidCount, vehicleRanking, typeRanking, driverRanking, insights };
  }, [filteredMaints, vehicles, drivers]);

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;
  }

  const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Controle de Custos</h2>
          <p className="text-muted-foreground text-sm">Análise financeira da frota</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Veículo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os veículos</SelectItem>
              {vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.name} ({v.plate})</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-xl p-3 bg-muted text-green-600"><DollarSign className="h-5 w-5" /></div>
            <div>
              <p className="text-xl font-bold">{fmt(stats.totalSpent)}</p>
              <p className="text-xs text-muted-foreground">Total no período</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-xl p-3 bg-muted text-blue-600"><Car className="h-5 w-5" /></div>
            <div>
              <p className="text-xl font-bold">{fmt(stats.avgPerVehicle)}</p>
              <p className="text-xs text-muted-foreground">Média por veículo</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-xl p-3 bg-muted text-orange-600"><TrendingUp className="h-5 w-5" /></div>
            <div>
              <p className="text-xl font-bold">
                {stats.mostExpensive ? fmt(stats.mostExpensive.actual_cost || stats.mostExpensive.cost || 0) : "—"}
              </p>
              <p className="text-xs text-muted-foreground">Mais cara do período</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-xl p-3 bg-muted text-red-600"><AlertTriangle className="h-5 w-5" /></div>
            <div>
              <p className="text-xl font-bold">{stats.unpaidCount}</p>
              <p className="text-xs text-muted-foreground">Pagamentos pendentes</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Insights */}
      {stats.insights.length > 0 && (
        <div className="space-y-2">
          {stats.insights.map((insight, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {insight}
            </div>
          ))}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {/* By Vehicle */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Car className="h-4 w-4" /> Top Veículos por Custo</CardTitle></CardHeader>
          <CardContent>
            {stats.vehicleRanking.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados</p>
            ) : (
              <div className="space-y-3">
                {stats.vehicleRanking.map((vr, i) => (
                  <div key={vr.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={cn("text-xs font-bold w-5 text-center", i === 0 && "text-red-600")}>{i + 1}º</span>
                      <span className="text-sm truncate">{vr.vehicle?.name} <span className="text-muted-foreground font-mono text-xs">({vr.vehicle?.plate})</span></span>
                    </div>
                    <span className={cn("text-sm font-semibold tabular-nums shrink-0", i === 0 ? "text-red-600" : "text-foreground")}>
                      {fmt(vr.total)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* By Type */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Wrench className="h-4 w-4" /> Custo por Tipo</CardTitle></CardHeader>
          <CardContent>
            {stats.typeRanking.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados</p>
            ) : (
              <div className="space-y-3">
                {stats.typeRanking.map(tr => (
                  <div key={tr.type} className="flex items-center justify-between">
                    <span className="text-sm">{MAINTENANCE_TYPES[tr.type] || tr.type}</span>
                    <span className="text-sm font-semibold tabular-nums">{fmt(tr.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* By Driver */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4" /> Custo por Motorista</CardTitle></CardHeader>
          <CardContent>
            {stats.driverRanking.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados</p>
            ) : (
              <div className="space-y-3">
                {stats.driverRanking.map(dr => (
                  <div key={dr.id} className="flex items-center justify-between">
                    <span className="text-sm truncate">{dr.driver?.name || "—"}</span>
                    <span className="text-sm font-semibold tabular-nums">{fmt(dr.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent maintenances with financial info */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><CircleDollarSign className="h-4 w-4" /> Manutenções do Período</CardTitle></CardHeader>
        <CardContent>
          {filteredMaints.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma manutenção no período</p>
          ) : (
            <div className="space-y-2">
              {filteredMaints.slice(0, 15).map(m => {
                const v = vehicles.find(v => v.id === m.vehicle_id);
                const isPaid = m.financial_status === "paid";
                return (
                  <div key={m.id} className={cn("flex items-center justify-between p-3 rounded-lg", !isPaid && (m.actual_cost || m.cost) ? "bg-red-500/5 border border-red-500/20" : "bg-muted/50")}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{v?.name}</span>
                        <span className="text-xs text-muted-foreground font-mono">({v?.plate})</span>
                        <Badge variant={isPaid ? "default" : "outline"} className={cn("text-xs", !isPaid && "text-red-600 border-red-600")}>
                          {isPaid ? "Pago" : "Pendente"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(m.maintenance_date), "dd/MM/yyyy", { locale: ptBR })} — {MAINTENANCE_TYPES[m.maintenance_type] || m.maintenance_type}
                        {m.payment_method && ` • ${m.payment_method}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      {m.actual_cost ? (
                        <p className="text-sm font-bold tabular-nums">{fmt(m.actual_cost)}</p>
                      ) : m.cost ? (
                        <p className="text-sm font-medium tabular-nums text-muted-foreground">{fmt(m.cost)} <span className="text-xs">(est.)</span></p>
                      ) : (
                        <p className="text-xs text-muted-foreground">—</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
