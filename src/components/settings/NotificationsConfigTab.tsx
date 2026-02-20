import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Bell, Loader2, Send, Clock, AlertTriangle, CalendarClock, CheckCircle2, ShoppingCart } from "lucide-react";
import { PurchaseNotificationsConfig } from "./PurchaseNotificationsConfig";

export function NotificationsConfigTab() {
  const { toast } = useToast();
  const [sendingOverdue, setSendingOverdue] = useState(false);
  const [sendingDue, setSendingDue] = useState(false);
  const [sendingRecurring, setSendingRecurring] = useState(false);
  const [sendingPurchaseReminders, setSendingPurchaseReminders] = useState(false);
  const [overdueResult, setOverdueResult] = useState<any>(null);
  const [dueResult, setDueResult] = useState<any>(null);
  const [recurringResult, setRecurringResult] = useState<any>(null);
  const [purchaseReminderResult, setPurchaseReminderResult] = useState<any>(null);

  const { data: zapiConfig, isLoading } = useQuery({
    queryKey: ["zapi-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("zapi_config")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const isZapiActive = zapiConfig?.is_active === true;

  const handleSendOverdue = async () => {
    setSendingOverdue(true);
    setOverdueResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("notify-overdue-tasks", { body: {} });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setOverdueResult(data);
      toast({
        title: data.sent > 0
          ? `${data.sent} notificação(ões) enviada(s)!`
          : data.message || "Nenhuma tarefa atrasada encontrada.",
      });
    } catch (e: any) {
      toast({ title: "Erro ao enviar", description: e.message, variant: "destructive" });
    } finally {
      setSendingOverdue(false);
    }
  };

  const handleSendDue = async () => {
    setSendingDue(true);
    setDueResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("notify-due-tasks", { body: {} });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setDueResult(data);
      toast({
        title: data.sent > 0
          ? `${data.sent} notificação(ões) enviada(s)!`
          : data.message || "Nenhuma tarefa com prazo próximo.",
      });
    } catch (e: any) {
      toast({ title: "Erro ao enviar", description: e.message, variant: "destructive" });
    } finally {
      setSendingDue(false);
    }
  };

  const handleSendRecurring = async () => {
    setSendingRecurring(true);
    setRecurringResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("notify-recurring-tasks", { body: {} });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setRecurringResult(data);
      toast({
        title: data.sent > 0
          ? `${data.sent} notificação(ões) enviada(s)!`
          : data.message || "Nenhuma tarefa fixa pendente.",
      });
    } catch (e: any) {
      toast({ title: "Erro ao enviar", description: e.message, variant: "destructive" });
    } finally {
      setSendingRecurring(false);
    }
  };

  const handleSendPurchaseReminders = async () => {
    setSendingPurchaseReminders(true);
    setPurchaseReminderResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("notify-purchase-reminders", { body: {} });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPurchaseReminderResult(data);
      toast({
        title: data.sent > 0
          ? `${data.sent} notificação(ões) enviada(s)!`
          : "Nenhum lembrete de compra pendente.",
      });
    } catch (e: any) {
      toast({ title: "Erro ao enviar", description: e.message, variant: "destructive" });
    } finally {
      setSendingPurchaseReminders(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status da Z-API */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">Notificações via WhatsApp</CardTitle>
                <Badge variant={isZapiActive ? "default" : "destructive"} className="text-xs">
                  {isZapiActive ? "Ativa" : "Inativa"}
                </Badge>
              </div>
              <CardDescription>
                Configuração e disparo manual das notificações enviadas via Z-API.
                {!isZapiActive && " Configure a Z-API na aba Integrações para ativar."}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Agendamentos automáticos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            Agendamentos Automáticos
          </CardTitle>
          <CardDescription>
            Notificações são enviadas automaticamente nos horários configurados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">Tarefas Atrasadas</p>
                <p className="text-xs text-muted-foreground">
                  Notifica tarefas com prazo vencido para o responsável e o administrador.
                </p>
              </div>
              <Badge variant="outline" className="shrink-0">09:00 BRT</Badge>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <CalendarClock className="h-5 w-5 text-amber-500 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">Prazo Próximo (Hoje / 3 dias)</p>
                <p className="text-xs text-muted-foreground">
                  Notifica tarefas com prazo hoje ou em 3 dias para o responsável e o administrador.
                </p>
              </div>
              <Badge variant="outline" className="shrink-0">09:00 BRT</Badge>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <CheckCircle2 className="h-5 w-5 text-blue-500 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">Tarefas Fixas Pendentes</p>
                <p className="text-xs text-muted-foreground">
                  Notifica tarefas fixas (recorrentes) que ainda não foram concluídas no período.
                </p>
              </div>
              <Badge variant="outline" className="shrink-0">08:30 BRT</Badge>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <ShoppingCart className="h-5 w-5 text-amber-500 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">Lembretes de Compras Pendentes</p>
                <p className="text-xs text-muted-foreground">
                  Notifica compras pendentes ou recebimentos atrasados conforme dias configurados abaixo.
                </p>
              </div>
              <Badge variant="outline" className="shrink-0">09:00 BRT</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notificações em tempo real */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Send className="h-4 w-4" />
            Notificações em Tempo Real
          </CardTitle>
          <CardDescription>
            Essas notificações são enviadas automaticamente quando o evento ocorre.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
              <div>
                <p className="text-sm font-medium">Tarefa Criada / Atribuída</p>
                <p className="text-xs text-muted-foreground">
                  Ao criar uma tarefa ou alterar o responsável, o responsável e o administrador são notificados via WhatsApp.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <ShoppingCart className="h-4 w-4 text-blue-500 shrink-0" />
              <div>
                <p className="text-sm font-medium">Lista de Compras (Criada / Comprada / Recebida)</p>
                <p className="text-xs text-muted-foreground">
                  Notifica os usuários configurados quando uma lista é criada, comprada ou recebida.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Disparo Manual */}
      {isZapiActive && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Send className="h-4 w-4" />
              Disparo Manual
            </CardTitle>
            <CardDescription>
              Envie notificações manualmente agora, independente do agendamento automático.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Tarefas Atrasadas */}
            <div className="space-y-2">
              <Button
                variant="outline"
                onClick={handleSendOverdue}
                disabled={sendingOverdue}
                className="w-full justify-start"
              >
                {sendingOverdue ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <AlertTriangle className="h-4 w-4 mr-2 text-red-500" />
                )}
                {sendingOverdue ? "Enviando..." : "Notificar Tarefas Atrasadas"}
              </Button>
              {overdueResult && (
                <div className="text-xs text-muted-foreground rounded-md border p-3 space-y-1">
                  <p>📊 Tarefas atrasadas: <strong>{overdueResult.total_overdue}</strong></p>
                  <p>✅ Enviadas: <strong>{overdueResult.sent}</strong></p>
                  {overdueResult.errors > 0 && <p>❌ Erros: <strong>{overdueResult.errors}</strong></p>}
                </div>
              )}
            </div>

            <Separator />

            {/* Prazo Próximo */}
            <div className="space-y-2">
              <Button
                variant="outline"
                onClick={handleSendDue}
                disabled={sendingDue}
                className="w-full justify-start"
              >
                {sendingDue ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CalendarClock className="h-4 w-4 mr-2 text-amber-500" />
                )}
                {sendingDue ? "Enviando..." : "Notificar Prazo Próximo (Hoje / 3 dias)"}
              </Button>
              {dueResult && (
                <div className="text-xs text-muted-foreground rounded-md border p-3 space-y-1">
                  <p>📊 Tarefas relevantes: <strong>{dueResult.total_relevant}</strong></p>
                  <p>✅ Enviadas: <strong>{dueResult.sent}</strong></p>
                  {dueResult.errors > 0 && <p>❌ Erros: <strong>{dueResult.errors}</strong></p>}
                </div>
              )}
            </div>

            <Separator />

            {/* Tarefas Fixas */}
            <div className="space-y-2">
              <Button
                variant="outline"
                onClick={handleSendRecurring}
                disabled={sendingRecurring}
                className="w-full justify-start"
              >
                {sendingRecurring ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2 text-blue-500" />
                )}
                {sendingRecurring ? "Enviando..." : "Notificar Tarefas Fixas Pendentes"}
              </Button>
              {recurringResult && (
                <div className="text-xs text-muted-foreground rounded-md border p-3 space-y-1">
                  <p>✅ Enviadas: <strong>{recurringResult.sent}</strong></p>
                  {recurringResult.errors > 0 && <p>❌ Erros: <strong>{recurringResult.errors}</strong></p>}
                </div>
              )}
            </div>
            <Separator />

            {/* Lembretes de Compras */}
            <div className="space-y-2">
              <Button
                variant="outline"
                onClick={handleSendPurchaseReminders}
                disabled={sendingPurchaseReminders}
                className="w-full justify-start"
              >
                {sendingPurchaseReminders ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ShoppingCart className="h-4 w-4 mr-2 text-amber-500" />
                )}
                {sendingPurchaseReminders ? "Enviando..." : "Notificar Lembretes de Compras Pendentes"}
              </Button>
              {purchaseReminderResult && (
                <div className="text-xs text-muted-foreground rounded-md border p-3 space-y-1">
                  <p>✅ WhatsApp enviados: <strong>{purchaseReminderResult.sent}</strong></p>
                  <p>🔔 Notificações in-app: <strong>{purchaseReminderResult.in_app}</strong></p>
                  {purchaseReminderResult.errors > 0 && <p>❌ Erros: <strong>{purchaseReminderResult.errors}</strong></p>}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Configurações de Notificações de Compras */}
      <PurchaseNotificationsConfig />

      <div className="rounded-lg bg-muted/50 p-3">
        <p className="text-xs text-muted-foreground">
          💡 As notificações são enviadas via WhatsApp (Z-API) e também ficam registradas como notificações internas no sistema. Quando há usuários configurados, apenas eles recebem; caso contrário, o administrador master recebe.
        </p>
      </div>
    </div>
  );
}
