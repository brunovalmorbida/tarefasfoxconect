import { useMemo } from "react";
import { FleetVehicle, FleetMaintenance, FleetCheckin } from "@/hooks/useFleet";
import { startOfWeek, endOfWeek, subDays, isAfter } from "date-fns";

export interface ScoreConfig {
  maintenanceCritical: number;
  maintenanceAttention: number;
  maintenanceLow: number;
  toolsIncomplete: number;
  toolsMissingEach: number;
  noCheckin: number;
  freqOver2: number;
  freqOver4: number;
  bonusNoMaint30: number;
  bonusCheckinOk: number;
  highCostRecurrent: number;
}

const DEFAULT_CONFIG: ScoreConfig = {
  maintenanceCritical: -30,
  maintenanceAttention: -15,
  maintenanceLow: -5,
  toolsIncomplete: -10,
  toolsMissingEach: -3,
  noCheckin: -20,
  freqOver2: -15,
  freqOver4: -30,
  bonusNoMaint30: 10,
  bonusCheckinOk: 5,
};

export type ScoreClassification = "healthy" | "attention" | "critical";

export interface VehicleScore {
  score: number;
  classification: ScoreClassification;
}

function classify(score: number): ScoreClassification {
  if (score >= 80) return "healthy";
  if (score >= 50) return "attention";
  return "critical";
}

export function calculateVehicleScore(
  vehicleId: string,
  maintenances: FleetMaintenance[],
  checkins: FleetCheckin[],
  config: ScoreConfig = DEFAULT_CONFIG
): VehicleScore {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const thirtyDaysAgo = subDays(now, 30);

  const vMaintenances = maintenances.filter((m) => m.vehicle_id === vehicleId);
  const vCheckins = checkins.filter((c) => c.vehicle_id === vehicleId);

  let score = 100;

  // Deductions: open maintenances by priority
  const openMaints = vMaintenances.filter((m) => m.status !== "completed");
  for (const m of openMaints) {
    if (m.priority === "critical") score += config.maintenanceCritical;
    else if (m.priority === "attention") score += config.maintenanceAttention;
    else score += config.maintenanceLow;
  }

  // Deductions: missing tools from open maintenances
  for (const m of openMaints) {
    if (m.missing_tools && m.missing_tools.length > 0) {
      score += config.toolsIncomplete;
      score += m.missing_tools.length * config.toolsMissingEach;
    }
  }

  // Deductions: tools_ok=false in week checkins
  const weekCheckins = vCheckins.filter((c) => {
    const d = new Date(c.checkin_date);
    return d >= weekStart && d <= weekEnd;
  });

  const hasToolsProblem = weekCheckins.some((c) => c.tools_ok === false);
  if (hasToolsProblem) {
    score += config.toolsIncomplete;
  }

  // Deductions: no answered check-in this week
  const hasAnswered = weekCheckins.some((c) => c.status === "answered");
  if (!hasAnswered) {
    score += config.noCheckin;
  }

  // Deductions: maintenance frequency in last 30 days
  const recentMaints = vMaintenances.filter((m) =>
    isAfter(new Date(m.maintenance_date), thirtyDaysAgo)
  );
  if (recentMaints.length > 4) {
    score += config.freqOver4;
  } else if (recentMaints.length > 2) {
    score += config.freqOver2;
  }

  // Bonus: 30 days without any maintenance created
  const hasRecentMaint = vMaintenances.some((m) =>
    isAfter(new Date(m.created_at), thirtyDaysAgo)
  );
  if (!hasRecentMaint && vMaintenances.length > 0) {
    score += config.bonusNoMaint30;
  }

  // Bonus: check-in answered this week
  if (hasAnswered) {
    score += config.bonusCheckinOk;
  }

  score = Math.max(0, Math.min(100, score));

  return { score, classification: classify(score) };
}

export function useVehicleScores(
  vehicles: FleetVehicle[],
  maintenances: FleetMaintenance[],
  checkins: FleetCheckin[]
): Map<string, VehicleScore> {
  return useMemo(() => {
    const map = new Map<string, VehicleScore>();
    for (const v of vehicles) {
      map.set(v.id, calculateVehicleScore(v.id, maintenances, checkins));
    }
    return map;
  }, [vehicles, maintenances, checkins]);
}
