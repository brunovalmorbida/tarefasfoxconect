import { useAuth } from "@/hooks/useAuth";

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Bem-vindo ao TaskFlow</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total de tarefas", value: "0", color: "text-primary" },
          { label: "Em andamento", value: "0", color: "text-blue-600" },
          { label: "Concluídas", value: "0", color: "text-green-600" },
          { label: "Atrasadas", value: "0", color: "text-destructive" },
        ].map((card) => (
          <div key={card.label} className="rounded-lg border bg-card p-6">
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
