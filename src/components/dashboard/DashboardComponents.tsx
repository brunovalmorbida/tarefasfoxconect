import { cn } from "@/lib/utils";
import { Flame } from "lucide-react";

export function StatCard({ label, value, desc, icon: Icon, color, delay = 0 }: {
  label: string; value: number | string; desc?: string; icon: any; color: string; delay?: number;
}) {
  return (
    <div className="card-premium p-5 animate-fade-in group" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">{label}</p>
          <p className={cn("text-3xl font-extrabold tracking-tight", color)}>{value}</p>
          {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
        </div>
        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center transition-transform duration-200 group-hover:scale-110",
          color === "text-primary" ? "bg-primary/10" :
          color === "text-blue-600" ? "bg-blue-100 dark:bg-blue-900/30" :
          color === "text-success" ? "bg-green-100 dark:bg-green-900/30" :
          color === "text-destructive" ? "bg-red-100 dark:bg-red-900/30" :
          color === "text-warning" ? "bg-amber-100 dark:bg-amber-900/30" :
          "bg-muted"
        )}>
          <Icon className={cn("h-5 w-5", color)} />
        </div>
      </div>
    </div>
  );
}

export function GradientProgressBar({ pct, label, sublabel, icon: Icon }: {
  pct: number; label: string; sublabel: string; icon: any;
}) {
  const barColor = pct >= 70 ? "from-emerald-500 to-cyan-500" :
    pct >= 40 ? "from-amber-400 to-yellow-500" : "from-red-400 to-rose-500";
  const textColor = pct >= 70 ? "text-success" : pct >= 40 ? "text-warning" : "text-destructive";

  return (
    <div className="card-premium p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm">{label}</p>
            <p className="text-xs text-muted-foreground">{sublabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pct === 100 && <Flame className="h-5 w-5 text-amber-500 animate-pulse" />}
          <span className={cn("text-3xl font-extrabold tracking-tight", textColor)}>
            {pct}%
          </span>
        </div>
      </div>
      <div className="w-full h-3 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-1000 ease-out", barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-2">
        <div className="h-8 w-64 rounded-lg skeleton-loading" />
        <div className="h-4 w-48 rounded-lg skeleton-loading" />
      </div>
      <div className="h-28 rounded-xl skeleton-loading" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-28 rounded-xl skeleton-loading" />)}
      </div>
      <div className="h-40 rounded-xl skeleton-loading" />
    </div>
  );
}
