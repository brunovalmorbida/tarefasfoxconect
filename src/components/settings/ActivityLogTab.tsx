import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function ActivityLogTab() {
  const [userFilter, setUserFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: profiles } = useQuery({
    queryKey: ["all-profiles-log"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id, name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: logs, isLoading } = useQuery({
    queryKey: ["activity-log", userFilter],
    queryFn: async () => {
      let query = supabase
        .from("activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (userFilter !== "all") {
        query = query.eq("user_id", userFilter);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const getProfileName = (userId: string) => {
    return profiles?.find((p) => p.user_id === userId)?.name ?? "Desconhecido";
  };

  const filtered = logs?.filter((log) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      log.action.toLowerCase().includes(term) ||
      getProfileName(log.user_id).toLowerCase().includes(term) ||
      JSON.stringify(log.details ?? {}).toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por ação ou detalhes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={userFilter} onValueChange={setUserFilter}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="Filtrar por usuário" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os usuários</SelectItem>
            {profiles?.map((p) => (
              <SelectItem key={p.user_id} value={p.user_id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Registro de Atividades</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !filtered?.length ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma atividade registrada.</p>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {filtered.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 rounded-lg border p-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{getProfileName(log.user_id)}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <p className="text-sm mt-1">{log.action}</p>
                    {log.details && typeof log.details === "object" && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {Object.entries(log.details as Record<string, any>)
                          .filter(([_, v]) => v != null)
                          .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
                          .join(" • ")}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
