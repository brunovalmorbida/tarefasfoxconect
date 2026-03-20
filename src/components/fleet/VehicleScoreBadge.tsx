import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import type { ScoreClassification } from "@/hooks/useVehicleScore";

const CLASSIFICATION_CONFIG: Record<ScoreClassification, { label: string; color: string; bg: string; progressColor: string }> = {
  healthy: { label: "Saudável", color: "text-green-600", bg: "bg-green-500/10", progressColor: "[&>div]:bg-green-500" },
  attention: { label: "Atenção", color: "text-yellow-600", bg: "bg-yellow-500/10", progressColor: "[&>div]:bg-yellow-500" },
  critical: { label: "Crítico", color: "text-red-600", bg: "bg-red-500/10", progressColor: "[&>div]:bg-red-500" },
};

interface VehicleScoreBadgeProps {
  score: number;
  classification: ScoreClassification;
  compact?: boolean;
  showBar?: boolean;
}

export function VehicleScoreBadge({ score, classification, compact = false, showBar = false }: VehicleScoreBadgeProps) {
  const config = CLASSIFICATION_CONFIG[classification];

  if (compact) {
    return (
      <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold", config.bg, config.color)}>
        {score}
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className={cn("text-2xl font-bold tabular-nums", config.color)}>{score}</span>
        <span className={cn("text-xs font-medium", config.color)}>{config.label}</span>
      </div>
      {showBar && (
        <Progress value={score} className={cn("h-2", config.progressColor)} />
      )}
    </div>
  );
}
