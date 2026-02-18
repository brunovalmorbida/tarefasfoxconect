import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { listId, action } = await req.json();

    if (!listId || !action) {
      return new Response(JSON.stringify({ error: "listId and action required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch list with items
    const { data: list, error: listError } = await supabase
      .from("purchase_lists").select("*").eq("id", listId).single();
    if (listError || !list) {
      return new Response(JSON.stringify({ error: "List not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: items } = await supabase
      .from("purchase_list_items").select("*").eq("list_id", listId);

    // Fetch Z-API config
    const { data: zapiConfig } = await supabase
      .from("zapi_config").select("*").eq("is_active", true).limit(1).single();

    // Get master admin
    const { data: masterProfile } = await supabase
      .from("profiles").select("user_id, name, whatsapp_number")
      .ilike("name", "%bruno%").limit(1).single();

    // Get requester
    const { data: requesterProfile } = await supabase
      .from("profiles").select("user_id, name, whatsapp_number")
      .eq("user_id", list.requested_by).single();

    // Get buyer
    let buyerProfile = null;
    if (list.buyer_id) {
      const { data } = await supabase
        .from("profiles").select("user_id, name, whatsapp_number")
        .eq("user_id", list.buyer_id).single();
      buyerProfile = data;
    }

    const urgencyLabels: Record<string, string> = { low: "Baixa", medium: "Média", high: "Alta", urgent: "Urgente" };
    const categoryLabels: Record<string, string> = {
      office: "Escritório", cleaning: "Limpeza", technology: "Tecnologia",
      maintenance: "Manutenção", food: "Alimentação", other: "Outros",
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

    // Build items list text
    const buildItemsList = (showActual = false) => {
      return (items || []).map((item: any, i: number) => {
        let line = `  ${i + 1}. ${item.name} (x${item.quantity}) - ${categoryLabels[item.category] || item.category}`;
        if (item.estimated_value && !showActual) line += ` | Est: R$ ${Number(item.estimated_value).toFixed(2)}`;
        if (item.actual_value && showActual) line += ` | R$ ${Number(item.actual_value).toFixed(2)}`;
        if (item.description) line += ` | ${item.description}`;
        return line;
      }).join("\n");
    };

    const notifications: Array<{ user_id: string; title: string; message: string }> = [];
    const results: string[] = [];

    if (action === "created") {
      const msg = `🛒 *Nova Lista de Compras*\n\n` +
        `📋 *${list.title}*\n` +
        `⚡ *Urgência:* ${urgencyLabels[list.urgency] || list.urgency}\n` +
        `👤 *Solicitado por:* ${requesterProfile?.name || "Desconhecido"}\n\n` +
        `📦 *Itens (${(items || []).length}):*\n${buildItemsList()}`;

      if (masterProfile?.whatsapp_number) {
        await sendWhatsApp(masterProfile.whatsapp_number, msg);
        results.push("WhatsApp sent to admin");
      }
      if (masterProfile) {
        const itemNames = (items || []).map((i: any) => i.name).join(", ");
        notifications.push({
          user_id: masterProfile.user_id,
          title: "Nova lista de compras",
          message: `${requesterProfile?.name || "Alguém"} solicitou: ${itemNames}`,
        });
      }
    } else if (action === "purchased") {
      const totalValue = (items || []).reduce((sum: number, i: any) => sum + (Number(i.actual_value) || 0), 0);
      const msg = `✅ *Compra Realizada*\n\n` +
        `📋 *${list.title}*\n` +
        `🛍️ *Comprado por:* ${buyerProfile?.name || "Desconhecido"}\n` +
        (totalValue > 0 ? `💰 *Total:* R$ ${totalValue.toFixed(2)}\n` : "") +
        (list.purchase_notes ? `📝 *Obs:* ${list.purchase_notes}\n` : "") +
        `\n📦 *Itens:*\n${buildItemsList(true)}`;

      if (requesterProfile?.whatsapp_number) {
        await sendWhatsApp(requesterProfile.whatsapp_number, msg);
        results.push("WhatsApp sent to requester");
      }
      const itemNames = (items || []).map((i: any) => i.name).join(", ");
      notifications.push({
        user_id: list.requested_by,
        title: "Compra realizada",
        message: `${buyerProfile?.name || "Alguém"} comprou: ${itemNames}`,
      });
      if (masterProfile && masterProfile.user_id !== list.requested_by) {
        notifications.push({
          user_id: masterProfile.user_id,
          title: "Compra realizada",
          message: `${buyerProfile?.name || "Alguém"} comprou a lista "${list.title}"`,
        });
      }
    } else if (action === "received") {
      const msg = `📬 *Material Recebido*\n\n` +
        `📋 *${list.title}*\n` +
        `👤 *Recebido por:* ${requesterProfile?.name || "Desconhecido"}\n` +
        (list.receive_notes ? `📝 *Obs:* ${list.receive_notes}\n` : "") +
        `\n📦 *Itens:*\n${buildItemsList(true)}`;

      if (masterProfile?.whatsapp_number) {
        await sendWhatsApp(masterProfile.whatsapp_number, msg);
        results.push("WhatsApp sent to admin");
      }
      if (masterProfile) {
        notifications.push({
          user_id: masterProfile.user_id,
          title: "Material recebido",
          message: `${requesterProfile?.name || "Alguém"} recebeu a lista "${list.title}"`,
        });
      }
    }

    if (notifications.length > 0) {
      await supabase.from("notifications").insert(notifications);
      results.push(`${notifications.length} in-app notifications`);
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
