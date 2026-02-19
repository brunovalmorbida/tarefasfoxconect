import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLogActivity } from "@/hooks/useActivityLog";
import { MessageSquare, Loader2, Copy, Bot, CheckCircle2 } from "lucide-react";

export function IntegrationsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const logActivity = useLogActivity();
  const [instanceId, setInstanceId] = useState("");
  const [token, setToken] = useState("");
  const [clientToken, setClientToken] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  

  const { data: config, isLoading } = useQuery({
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

  useEffect(() => {
    if (config) {
      setInstanceId(config.instance_id);
      setToken(config.token);
      setClientToken((config as any).client_token || "");
      setIsActive(config.is_active);
    }
  }, [config]);

  const handleSave = async () => {
    if (!instanceId.trim() || !token.trim()) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (config) {
        const { error } = await supabase
          .from("zapi_config")
          .update({ instance_id: instanceId, token, client_token: clientToken, is_active: isActive } as any)
          .eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("zapi_config")
          .insert({ instance_id: instanceId, token, client_token: clientToken, is_active: isActive } as any);
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: ["zapi-config"] });
      toast({ title: "Configuração salva com sucesso!" });
      await logActivity("Atualizou configuração da Z-API", { is_active: isActive });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
              <MessageSquare className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <CardTitle className="text-lg">Z-API (WhatsApp)</CardTitle>
              <CardDescription>
                Integração com a Z-API para envio de notificações via WhatsApp.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="instance-id">Instance ID</Label>
            <Input
              id="instance-id"
              placeholder="Seu Instance ID da Z-API"
              value={instanceId}
              onChange={(e) => setInstanceId(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="token">Token</Label>
            <Input
              id="token"
              type="password"
              placeholder="Seu Token da Z-API"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="client-token">Client-Token (Token de Segurança da Conta)</Label>
            <Input
              id="client-token"
              type="password"
              placeholder="Seu Client-Token da Z-API (aba Segurança)"
              value={clientToken}
              onChange={(e) => setClientToken(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="zapi-active">Integração ativa</Label>
            <Switch
              id="zapi-active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {config ? "Atualizar Configuração" : "Salvar Configuração"}
          </Button>

          {config && isActive && (
            <>
              <Separator />
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">
                  ✅ Z-API ativa. Gerencie o disparo de notificações na aba <strong>Notificações</strong>.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* WhatsApp Bot Commands */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">Bot de Comandos WhatsApp</CardTitle>
                <Badge variant="secondary" className="text-xs">IA</Badge>
              </div>
              <CardDescription>
                Envie comandos por WhatsApp para criar tarefas, listar pendências e mais.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>URL do Webhook (configure no Z-API)</Label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`}
                className="text-xs font-mono"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`
                  );
                  toast({ title: "URL copiada!" });
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Cole esta URL na configuração de Webhook de Recebimento da sua instância Z-API.
            </p>
          </div>

          <Separator />

          <div className="space-y-3">
            <h4 className="text-sm font-medium">Comandos Disponíveis</h4>
            <div className="grid gap-2 text-xs">
              <div className="flex items-start gap-2 rounded-lg border p-2.5">
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Criar Tarefa</p>
                  <p className="text-muted-foreground">"Criar tarefa revisar relatório" ou "Tarefa urgente: preparar apresentação"</p>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-lg border p-2.5">
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Listar Tarefas</p>
                  <p className="text-muted-foreground">"Minhas tarefas", "Tarefas atrasadas", "Tarefas de hoje"</p>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-lg border p-2.5">
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Concluir Tarefa</p>
                  <p className="text-muted-foreground">"Concluir tarefa relatório"</p>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-lg border p-2.5">
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Lista de Compras</p>
                  <p className="text-muted-foreground">"Comprar 5 resmas de papel e 2 toners"</p>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-lg border p-2.5">
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Resumo do Dia</p>
                  <p className="text-muted-foreground">"Como tá meu dia?" ou "Resumo"</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">
              💡 O bot usa IA para interpretar mensagens em linguagem natural. Os usuários precisam ter o número de WhatsApp cadastrado no perfil para serem identificados.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
