import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get reminder settings
    const { data: settings } = await supabase
      .from("purchase_notification_settings")
      .select("*")
      .in("stage", ["pending_purchase_reminder", "pending_receipt_reminder"])
      .eq("is_active", true);

    if (!settings || settings.length === 0) {
      return new Response(JSON.stringify({ message: "No active reminder settings", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Z-API config
    const { data: zapiConfig } = await supabase
      .from("zapi_config")
      .select("*")
      .eq("is_active", true)
      .limit(1)
      .single();

    // Get all profiles for name resolution and WhatsApp numbers
    const { data: allProfiles } = await supabase.from("profiles").select("user_id, name, whatsapp_number");
    const profileMap = new Map((allProfiles || []).map((p: any) => [p.user_id, p]));

    const sendWhatsApp = async (phone: string, message: string) => {
      if (!zapiConfig || !phone) return;
      const cleanPhone = phone.replace(/\D/g, "");
      const url = `https://api.z-api.io/instances/${zapiConfig.instance_id}/token/${zapiConfig.token}/send-text`;
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Client-Token": zapiConfig.client_token || "" },
        body: JSON.stringify({ phone: cleanPhone, message }),
      });
    };

    const now = new Date();
    let totalSent = 0;
    let totalErrors = 0;
    const notifications: Array<{ user_id: string; title: string; message: string; link: string }> = [];

    for (const setting of settings) {
      if (!setting.reminder_days || setting.notify_user_ids.length === 0) continue;

      const thresholdDate = new Date(now);
      thresholdDate.setDate(thresholdDate.getDate() - setting.reminder_days);
      const thresholdISO = thresholdDate.toISOString();

      let lists: any[] = [];

      if (setting.stage === "pending_purchase_reminder") {
        // Lists that are still pending and were created more than X days ago
        const { data } = await supabase
          .from("purchase_lists")
          .select("id, title, requested_by, created_at, urgency")
          .eq("status", "pending")
          .lte("created_at", thresholdISO);
        lists = data || [];
      } else if (setting.stage === "pending_receipt_reminder") {
        // Lists that were purchased but not received, purchased more than X days ago
        const { data } = await supabase
          .from("purchase_lists")
          .select("id, title, requested_by, buyer_id, purchased_at, urgency")
          .eq("status", "purchased")
          .not("purchased_at", "is", null)
          .lte("purchased_at", thresholdISO);
        lists = data || [];
      }

      if (lists.length === 0) continue;

      const urgencyLabels: Record<string, string> = {
        low: "Baixa", medium: "Média", high: "Alta", urgent: "Urgente"
      };

      for (const list of lists) {
        const requester = profileMap.get(list.requested_by);
        const daysAgo = Math.floor((now.getTime() - new Date(
          setting.stage === "pending_purchase_reminder" ? list.created_at : list.purchased_at
        ).getTime()) / (1000 * 60 * 60 * 24));

        const stageLabel = setting.stage === "pending_purchase_reminder"
          ? "⏰ *Lembrete: Compra Pendente*"
          : "⏰ *Lembrete: Recebimento Pendente*";

        const stageDetail = setting.stage === "pending_purchase_reminder"
          ? `Criada há ${daysAgo} dias e ainda não foi comprada.`
          : `Comprada há ${daysAgo} dias e ainda não foi recebida.`;

        const msg = `${stageLabel}\n\n` +
          `📋 *${list.title}*\n` +
          `⚡ *Urgência:* ${urgencyLabels[list.urgency] || list.urgency}\n` +
          `👤 *Solicitado por:* ${requester?.name || "Desconhecido"}\n` +
          `📅 ${stageDetail}`;

        const notifTitle = setting.stage === "pending_purchase_reminder"
          ? "Compra pendente"
          : "Recebimento pendente";

        for (const userId of setting.notify_user_ids) {
          const profile = profileMap.get(userId);
          if (!profile) continue;

          // Send WhatsApp
          if (profile.whatsapp_number && zapiConfig) {
            try {
              await sendWhatsApp(profile.whatsapp_number, msg);
              totalSent++;
            } catch {
              totalErrors++;
            }
          }

          // In-app notification
          notifications.push({
            user_id: userId,
            title: notifTitle,
            message: `"${list.title}" — ${stageDetail}`,
            link: "/purchases",
          });
        }
      }
    }

    if (notifications.length > 0) {
      await supabase.from("notifications").insert(notifications);
    }

    return new Response(JSON.stringify({
      success: true,
      sent: totalSent,
      in_app: notifications.length,
      errors: totalErrors,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
