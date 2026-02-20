import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Loader2, ShoppingCart, PackageCheck, PackageOpen, Clock, Save } from "lucide-react";
import { toast } from "sonner";

interface NotifSetting {
  id: string;
  stage: string;
  notify_user_ids: string[];
  reminder_days: number | null;
  is_active: boolean;
}

interface Profile {
  user_id: string;
  name: string;
}

const STAGE_CONFIG = {
  created: {
    label: "Lista Criada",
    description: "Notifica quando uma nova lista de compras é criada.",
    icon: ShoppingCart,
    color: "text-blue-500",
  },
  purchased: {
    label: "Compra Realizada",
    description: "Notifica quando uma lista é marcada como comprada.",
    icon: PackageCheck,
    color: "text-green-500",
  },
  received: {
    label: "Material Recebido",
    description: "Notifica quando uma lista é marcada como recebida.",
    icon: PackageOpen,
    color: "text-purple-500",
  },
  pending_purchase_reminder: {
    label: "Lembrete de Compra Pendente",
    description: "Envia lembrete quando uma lista está pendente há X dias.",
    icon: Clock,
    color: "text-amber-500",
  },
  pending_receipt_reminder: {
    label: "Lembrete de Recebimento Pendente",
    description: "Envia lembrete quando uma compra foi feita mas não recebida há X dias.",
    icon: Clock,
    color: "text-red-500",
  },
};

export function PurchaseNotificationsConfig() {
  const queryClient = useQueryClient();
  const [localSettings, setLocalSettings] = useState<Record<string, NotifSetting>>({});
  const [saving, setSaving] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["purchase-notification-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_notification_settings")
        .select("*")
        .order("created_at");
      if (error) throw error;
      return data as NotifSetting[];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["all-profiles-for-notif"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, name")
        .order("name");
      if (error) throw error;
      return data as Profile[];
    },
  });

  useEffect(() => {
    if (settings) {
      const map: Record<string, NotifSetting> = {};
      settings.forEach((s) => { map[s.stage] = s; });
      setLocalSettings(map);
    }
  }, [settings]);

  const updateLocal = (stage: string, updates: Partial<NotifSetting>) => {
    setLocalSettings((prev) => ({
      ...prev,
      [stage]: { ...prev[stage], ...updates },
    }));
  };

  const toggleUser = (stage: string, userId: string) => {
    const current = localSettings[stage]?.notify_user_ids || [];
    const updated = current.includes(userId)
      ? current.filter((id) => id !== userId)
      : [...current, userId];
    updateLocal(stage, { notify_user_ids: updated });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const [stage, setting] of Object.entries(localSettings)) {
        const { error } = await supabase
          .from("purchase_notification_settings")
          .update({
            notify_user_ids: setting.notify_user_ids,
            reminder_days: setting.reminder_days,
            is_active: setting.is_active,
          })
          .eq("id", setting.id);
        if (error) throw error;
      }
      toast.success("Configurações de notificações de compras salvas!");
      queryClient.invalidateQueries({ queryKey: ["purchase-notification-settings"] });
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const stages = ["created", "purchased", "received", "pending_purchase_reminder", "pending_receipt_reminder"] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShoppingCart className="h-4 w-4" />
          Notificações de Compras
        </CardTitle>
        <CardDescription>
          Defina quem recebe notificações em cada estágio e configure lembretes automáticos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {stages.map((stage) => {
          const config = STAGE_CONFIG[stage];
          const setting = localSettings[stage];
          if (!setting) return null;

          const Icon = config.icon;
          const isReminder = stage.includes("reminder");

          return (
            <div key={stage} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Icon className={`h-5 w-5 ${config.color} shrink-0`} />
                  <div>
                    <p className="text-sm font-medium">{config.label}</p>
                    <p className="text-xs text-muted-foreground">{config.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={setting.is_active ? "default" : "secondary"} className="text-xs">
                    {setting.is_active ? "Ativo" : "Inativo"}
                  </Badge>
                  <Switch
                    checked={setting.is_active}
                    onCheckedChange={(checked) => updateLocal(stage, { is_active: checked })}
                  />
                </div>
              </div>

              {setting.is_active && (
                <div className="ml-8 space-y-3">
                  {isReminder && (
                    <div className="flex items-center gap-2">
                      <Label className="text-xs whitespace-nowrap">Notificar após</Label>
                      <Input
                        type="number"
                        min={1}
                        max={90}
                        value={setting.reminder_days ?? ""}
                        onChange={(e) => updateLocal(stage, { reminder_days: parseInt(e.target.value) || null })}
                        className="w-20 h-8 text-sm"
                      />
                      <span className="text-xs text-muted-foreground">dias</span>
                    </div>
                  )}

                  <div>
                    <Label className="text-xs">Notificar usuários:</Label>
                    <ScrollArea className="h-[100px] rounded-md border p-2 mt-1">
                      <div className="space-y-1.5">
                        {profiles?.map((p) => (
                          <div key={p.user_id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`${stage}-${p.user_id}`}
                              checked={setting.notify_user_ids.includes(p.user_id)}
                              onCheckedChange={() => toggleUser(stage, p.user_id)}
                            />
                            <label
                              htmlFor={`${stage}-${p.user_id}`}
                              className="text-xs font-medium leading-none cursor-pointer"
                            >
                              {p.name}
                            </label>
                          </div>
                        ))}
                        {(!profiles || profiles.length === 0) && (
                          <p className="text-xs text-muted-foreground">Nenhum usuário encontrado.</p>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              )}

              {stage !== "pending_receipt_reminder" && <Separator />}
            </div>
          );
        })}

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Salvar Configurações de Compras
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
