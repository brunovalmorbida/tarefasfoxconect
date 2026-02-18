import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Loader2 } from "lucide-react";

export function IntegrationsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
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
        </CardContent>
      </Card>
    </div>
  );
}
