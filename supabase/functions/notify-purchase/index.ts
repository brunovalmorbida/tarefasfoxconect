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
    // Business hours check (BRT): Mon-Fri 08:30-18:00, Sat 08:00-12:00, Sun blocked
    const _now = new Date();
    const _brtNow = new Date(_now.getTime() + (-3 * 60 + _now.getTimezoneOffset()) * 60000);
    const _dayOfWeek = _brtNow.getDay();
    const _totalMin = _brtNow.getHours() * 60 + _brtNow.getMinutes();

    const isBusinessHours = (() => {
      if (_dayOfWeek === 0) return false;
      if (_dayOfWeek === 6) return _totalMin >= 480 && _totalMin < 720;
      return _totalMin >= 510 && _totalMin < 1080;
    })();

    if (!isBusinessHours) {
      return new Response(JSON.stringify({ message: "Fora do horário comercial — notificação não enviada", skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { listId, action } = await req.json();

    if (!listId || !action) {
      return new Response(JSON.stringify({ error: "listId and action required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch list
    const { data: list, error: listError } = await supabase
      .from("purchase_lists").select("*").eq("id", listId).single();
    if (listError || !list) {
      return new Response(JSON.stringify({ error: "List not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: items } = await supabase
      .from("purchase_list_items").select("*").eq("list_id", listId);

    // Fetch notification settings for this stage
    const { data: notifSetting } = await supabase
      .from("purchase_notification_settings")
      .select("*")
      .eq("stage", action)
      .eq("is_active", true)
      .maybeSingle();

    // Fetch Z-API config
    const { data: zapiConfig } = await supabase
      .from("zapi_config").select("*").eq("is_active", true).limit(1).single();

    // Get all relevant profiles
    const { data: allProfiles } = await supabase
      .from("profiles").select("user_id, name, whatsapp_number");
    const profileMap = new Map((allProfiles || []).map((p: any) => [p.user_id, p]));

    // Get master admin
    const { data: masterProfile } = await supabase
      .from("profiles").select("user_id, name, whatsapp_number")
      .ilike("name", "%bruno%").limit(1).single();

    const requesterProfile = profileMap.get(list.requested_by);
    const buyerProfile = list.buyer_id ? profileMap.get(list.buyer_id) : null;

    const urgencyLabels: Record<string, string> = { low: "Baixa", medium: "Média", high: "Alta", urgent: "Urgente" };
    const fixedCategoryLabels: Record<string, string> = {
      office: "Escritório", cleaning: "Limpeza", technology: "Tecnologia",
      maintenance: "Manutenção", food: "Alimentação", other: "Outros",
    };

    const { data: productCategories } = await supabase
      .from("product_categories").select("id, name");
    const customCatMap = new Map((productCategories || []).map((c: any) => [c.id, c.name]));

    const getCategoryName = (cat: string) => {
      if (fixedCategoryLabels[cat]) return fixedCategoryLabels[cat];
      if (customCatMap.has(cat)) return customCatMap.get(cat);
      return cat;
    };

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

    const buildItemsList = (showActual = false) => {
      return (items || []).map((item: any, i: number) => {
        let line = `  ${i + 1}. ${item.name} (x${item.quantity}) - ${getCategoryName(item.category)}`;
        if (item.estimated_value && !showActual) line += ` | Est: R$ ${Number(item.estimated_value).toFixed(2)}`;
        if (item.actual_value && showActual) line += ` | R$ ${Number(item.actual_value).toFixed(2)}`;
        if (item.description) line += ` | ${item.description}`;
        return line;
      }).join("\n");
    };

    const notifications: Array<{ user_id: string; title: string; message: string }> = [];
    const results: string[] = [];

    // Determine who should be notified
    const configuredUserIds: string[] = notifSetting?.notify_user_ids || [];

    // Build the message based on action
    let msg = "";
    let notifTitle = "";
    let notifMessage = "";
    const itemNames = (items || []).map((i: any) => i.name).join(", ");

    if (action === "created") {
      msg = `🛒 *Nova Lista de Compras*\n\n` +
        `📋 *${list.title}*\n` +
        `⚡ *Urgência:* ${urgencyLabels[list.urgency] || list.urgency}\n` +
        `👤 *Solicitado por:* ${requesterProfile?.name || "Desconhecido"}\n\n` +
        `📦 *Itens (${(items || []).length}):*\n${buildItemsList()}`;
      notifTitle = "Nova lista de compras";
      notifMessage = `${requesterProfile?.name || "Alguém"} solicitou: ${itemNames}`;
    } else if (action === "purchased") {
      const totalValue = (items || []).reduce((sum: number, i: any) => sum + (Number(i.actual_value) || 0), 0);
      msg = `✅ *Compra Realizada*\n\n` +
        `📋 *${list.title}*\n` +
        `🛍️ *Comprado por:* ${buyerProfile?.name || "Desconhecido"}\n` +
        (totalValue > 0 ? `💰 *Total:* R$ ${totalValue.toFixed(2)}\n` : "") +
        (list.purchase_notes ? `📝 *Obs:* ${list.purchase_notes}\n` : "") +
        `\n📦 *Itens:*\n${buildItemsList(true)}`;
      notifTitle = "Compra realizada";
      notifMessage = `${buyerProfile?.name || "Alguém"} comprou: ${itemNames}`;
    } else if (action === "received") {
      msg = `📬 *Material Recebido*\n\n` +
        `📋 *${list.title}*\n` +
        `👤 *Recebido por:* ${requesterProfile?.name || "Desconhecido"}\n` +
        (list.receive_notes ? `📝 *Obs:* ${list.receive_notes}\n` : "") +
        `\n📦 *Itens:*\n${buildItemsList(true)}`;
      notifTitle = "Material recebido";
      notifMessage = `${requesterProfile?.name || "Alguém"} recebeu a lista "${list.title}"`;
    }

    // If configured users exist, notify them
    if (configuredUserIds.length > 0) {
      for (const userId of configuredUserIds) {
        const profile = profileMap.get(userId);
        if (!profile) continue;

        if (profile.whatsapp_number && zapiConfig) {
          await sendWhatsApp(profile.whatsapp_number, msg);
          results.push(`WhatsApp sent to ${profile.name}`);
        }

        notifications.push({
          user_id: userId,
          title: notifTitle,
          message: notifMessage,
          link: "/purchases",
        });
      }
    } else {
      // Fallback: original behavior (admin + requester/buyer based on action)
      if (action === "created") {
        if (masterProfile?.whatsapp_number) {
          await sendWhatsApp(masterProfile.whatsapp_number, msg);
          results.push("WhatsApp sent to admin");
        }
        if (masterProfile) {
          notifications.push({ user_id: masterProfile.user_id, title: notifTitle, message: notifMessage, link: "/purchases" });
        }
      } else if (action === "purchased") {
        if (requesterProfile?.whatsapp_number) {
          await sendWhatsApp(requesterProfile.whatsapp_number, msg);
          results.push("WhatsApp sent to requester");
        }
        notifications.push({ user_id: list.requested_by, title: notifTitle, message: notifMessage, link: "/purchases" });
        if (masterProfile && masterProfile.user_id !== list.requested_by) {
          notifications.push({ user_id: masterProfile.user_id, title: notifTitle, message: `${buyerProfile?.name || "Alguém"} comprou a lista "${list.title}"`, link: "/purchases" });
        }
      } else if (action === "received") {
        if (masterProfile?.whatsapp_number) {
          await sendWhatsApp(masterProfile.whatsapp_number, msg);
          results.push("WhatsApp sent to admin");
        }
        if (masterProfile) {
          notifications.push({ user_id: masterProfile.user_id, title: notifTitle, message: notifMessage, link: "/purchases" });
        }
      }
    }

    if (notifications.length > 0) {
      await supabase.from("notifications").insert(notifications);
      results.push(`${notifications.length} in-app notifications`);
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
