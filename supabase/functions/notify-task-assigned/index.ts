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
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { taskTitle, assigneeId, boardName, assignedByName, isNewTask, dueDate, description } = await req.json();

    if (!taskTitle) {
      return new Response(JSON.stringify({ error: "taskTitle is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Z-API config
    const { data: zapiConfig } = await adminClient
      .from("zapi_config")
      .select("*")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (!zapiConfig) {
      return new Response(JSON.stringify({ skipped: true, reason: "Z-API não configurada ou inativa" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get assignee profile if exists
    let assigneeProfile: any = null;
    if (assigneeId) {
      const { data } = await adminClient
        .from("profiles")
        .select("user_id, name, whatsapp_number")
        .eq("user_id", assigneeId)
        .maybeSingle();
      assigneeProfile = data;
    }

    // Get master user (brunovalmorbida@live.com)
    const { data: masterAuth } = await adminClient.auth.admin.listUsers();
    const masterUser = masterAuth?.users?.find((u: any) => u.email === "brunovalmorbida@live.com");
    
    let masterProfile: any = null;
    if (masterUser) {
      const { data } = await adminClient
        .from("profiles")
        .select("user_id, name, whatsapp_number")
        .eq("user_id", masterUser.id)
        .maybeSingle();
      masterProfile = data;
    }

    const results: Array<{ to: string; phone: string; status: string; error?: string }> = [];

    const isAssignment = !!assigneeId;
    const emoji = isNewTask ? "🆕" : "📌";
    const title = isNewTask && !isAssignment ? "Nova Tarefa Criada" : "Nova Tarefa Atribuída";

    const sendMessage = async (phone: string, recipientName: string, label: string) => {
      const formattedDueDate = dueDate ? new Date(dueDate).toLocaleDateString("pt-BR") : "—";
      const message = `${emoji} *${title}*\n\n` +
        `📋 *Tarefa:* ${taskTitle}\n` +
        (description ? `📝 *Descrição:* ${description}\n` : "") +
        `📊 *Quadro:* ${boardName || "—"}\n` +
        `📅 *Prazo:* ${formattedDueDate}\n` +
        (isAssignment ? `👤 *Responsável:* ${assigneeProfile?.name || "—"}\n` : "") +
        `🔔 *Criada por:* ${assignedByName || "—"}\n\n` +
        `Olá ${recipientName}, ${isAssignment ? "uma tarefa foi atribuída" : "uma nova tarefa foi criada"}. Verifique no sistema!`;

      try {
        const zapiUrl = `https://api.z-api.io/instances/${zapiConfig.instance_id}/token/${zapiConfig.token}/send-text`;
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (zapiConfig.client_token) headers["Client-Token"] = zapiConfig.client_token;

        const response = await fetch(zapiUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({ phone: phone.replace(/\D/g, ""), message }),
        });
        const responseData = await response.json();

        if (response.ok) {
          results.push({ to: label, phone, status: "sent" });
        } else {
          results.push({ to: label, phone, status: "error", error: JSON.stringify(responseData) });
        }
      } catch (e: any) {
        results.push({ to: label, phone, status: "error", error: e.message });
      }
    };

    // Send to assignee (if exists)
    if (assigneeProfile?.whatsapp_number) {
      await sendMessage(assigneeProfile.whatsapp_number, assigneeProfile.name, "assignee");
    }

    // Always send to master user (if different from assignee)
    if (masterProfile?.whatsapp_number && (!assigneeId || masterProfile.user_id !== assigneeId)) {
      await sendMessage(masterProfile.whatsapp_number, masterProfile.name, "master");
    }

    // Create in-app notifications
    if (assigneeProfile) {
      await adminClient.from("notifications").insert({
        user_id: assigneeId,
        title: isAssignment ? "Nova tarefa atribuída" : "Nova tarefa criada",
        message: `A tarefa "${taskTitle}" foi ${isAssignment ? "atribuída a você" : "criada"} no quadro ${boardName || "—"}.`,
        link: "/boards",
      });
    }
    if (masterUser && (!assigneeId || masterUser.id !== assigneeId)) {
      await adminClient.from("notifications").insert({
        user_id: masterUser.id,
        title: isNewTask ? "Nova tarefa criada" : "Tarefa atribuída",
        message: isAssignment
          ? `A tarefa "${taskTitle}" foi atribuída a ${assigneeProfile?.name || "um usuário"} no quadro ${boardName || "—"}.`
          : `A tarefa "${taskTitle}" foi criada no quadro ${boardName || "—"}.`,
        link: "/boards",
      });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Error in notify-task-assigned:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
