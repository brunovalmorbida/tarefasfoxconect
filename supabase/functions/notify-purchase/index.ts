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

    const { purchaseId, action } = await req.json();
    // action: "created" | "purchased" | "received"

    if (!purchaseId || !action) {
      return new Response(JSON.stringify({ error: "purchaseId and action required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch purchase request
    const { data: purchase, error: purchaseError } = await supabase
      .from("purchase_requests")
      .select("*")
      .eq("id", purchaseId)
      .single();

    if (purchaseError || !purchase) {
      return new Response(JSON.stringify({ error: "Purchase not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch Z-API config
    const { data: zapiConfig } = await supabase
      .from("zapi_config")
      .select("*")
      .eq("is_active", true)
      .limit(1)
      .single();

    // Get master admin profile
    const { data: masterProfile } = await supabase
      .from("profiles")
      .select("user_id, name, whatsapp_number")
      .ilike("name", "%bruno%")
      .limit(1)
      .single();

    // Get requester profile
    const { data: requesterProfile } = await supabase
      .from("profiles")
      .select("user_id, name, whatsapp_number")
      .eq("user_id", purchase.requested_by)
      .single();

    // Get buyer profile if exists
    let buyerProfile = null;
    if (purchase.buyer_id) {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, name, whatsapp_number")
        .eq("user_id", purchase.buyer_id)
        .single();
      buyerProfile = data;
    }

    const urgencyLabels: Record<string, string> = {
      low: "Baixa",
      medium: "Média",
      high: "Alta",
      urgent: "Urgente",
    };

    const categoryLabels: Record<string, string> = {
      office: "Escritório",
      cleaning: "Limpeza",
      technology: "Tecnologia",
      maintenance: "Manutenção",
      food: "Alimentação",
      other: "Outros",
    };

    const sendWhatsApp = async (phone: string, message: string) => {
      if (!zapiConfig || !phone) return;
      const cleanPhone = phone.replace(/\D/g, "");
      const url = `https://api.z-api.io/instances/${zapiConfig.instance_id}/token/${zapiConfig.token}/send-text`;
      await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Client-Token": zapiConfig.client_token || "",
        },
        body: JSON.stringify({ phone: cleanPhone, message }),
      });
    };

    const notifications: Array<{ user_id: string; title: string; message: string }> = [];
    const results: string[] = [];

    if (action === "created") {
      // Notify admin master: new purchase request
      const msg = `🛒 *Nova Solicitação de Compra*\n\n` +
        `📦 *Item:* ${purchase.title}\n` +
        `📊 *Qtd:* ${purchase.quantity}\n` +
        `📂 *Categoria:* ${categoryLabels[purchase.category] || purchase.category}\n` +
        `⚡ *Urgência:* ${urgencyLabels[purchase.urgency] || purchase.urgency}\n` +
        (purchase.estimated_value ? `💰 *Valor estimado:* R$ ${Number(purchase.estimated_value).toFixed(2)}\n` : "") +
        (purchase.description ? `📝 *Obs:* ${purchase.description}\n` : "") +
        `👤 *Solicitado por:* ${requesterProfile?.name || "Desconhecido"}`;

      if (masterProfile?.whatsapp_number) {
        await sendWhatsApp(masterProfile.whatsapp_number, msg);
        results.push("WhatsApp sent to admin");
      }
      if (masterProfile) {
        notifications.push({
          user_id: masterProfile.user_id,
          title: "Nova solicitação de compra",
          message: `${requesterProfile?.name || "Alguém"} solicitou a compra de ${purchase.quantity}x ${purchase.title}`,
        });
      }
    } else if (action === "purchased") {
      // Notify requester: item was purchased
      const msg = `✅ *Compra Realizada*\n\n` +
        `📦 *Item:* ${purchase.title}\n` +
        `📊 *Qtd:* ${purchase.quantity}\n` +
        (purchase.actual_value ? `💰 *Valor:* R$ ${Number(purchase.actual_value).toFixed(2)}\n` : "") +
        (purchase.purchase_notes ? `📝 *Obs:* ${purchase.purchase_notes}\n` : "") +
        `🛍️ *Comprado por:* ${buyerProfile?.name || "Desconhecido"}`;

      if (requesterProfile?.whatsapp_number) {
        await sendWhatsApp(requesterProfile.whatsapp_number, msg);
        results.push("WhatsApp sent to requester");
      }
      notifications.push({
        user_id: purchase.requested_by,
        title: "Compra realizada",
        message: `O item "${purchase.title}" foi comprado por ${buyerProfile?.name || "alguém"}`,
      });
      // Also notify admin
      if (masterProfile && masterProfile.user_id !== purchase.requested_by) {
        notifications.push({
          user_id: masterProfile.user_id,
          title: "Compra realizada",
          message: `${buyerProfile?.name || "Alguém"} comprou o item "${purchase.title}"`,
        });
      }
    } else if (action === "received") {
      // Notify admin: material arrived
      const msg = `📬 *Material Recebido*\n\n` +
        `📦 *Item:* ${purchase.title}\n` +
        `📊 *Qtd:* ${purchase.quantity}\n` +
        (purchase.receive_notes ? `📝 *Obs:* ${purchase.receive_notes}\n` : "") +
        `👤 *Recebido por:* ${requesterProfile?.name || "Desconhecido"}`;

      if (masterProfile?.whatsapp_number) {
        await sendWhatsApp(masterProfile.whatsapp_number, msg);
        results.push("WhatsApp sent to admin");
      }
      if (masterProfile) {
        notifications.push({
          user_id: masterProfile.user_id,
          title: "Material recebido",
          message: `${requesterProfile?.name || "Alguém"} confirmou o recebimento de "${purchase.title}"`,
        });
      }
    }

    // Insert in-app notifications
    if (notifications.length > 0) {
      await supabase.from("notifications").insert(notifications);
      results.push(`${notifications.length} in-app notifications created`);
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
