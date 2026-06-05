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

    // Get Z-API config
    const { data: zapiConfig } = await adminClient
      .from("zapi_config")
      .select("*")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (!zapiConfig) {
      return new Response(JSON.stringify({ error: "Z-API não configurada ou inativa" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Today in BRT (UTC-3)
    const now = new Date();
    const brtOffset = -3 * 60;
    const brtNow = new Date(now.getTime() + (brtOffset + now.getTimezoneOffset()) * 60000);
    const todayStr = brtNow.toISOString().split("T")[0]; // YYYY-MM-DD

    // 3 days from now
    const threeDaysLater = new Date(brtNow);
    threeDaysLater.setDate(threeDaysLater.getDate() + 3);
    const threeDaysStr = threeDaysLater.toISOString().split("T")[0];

    // Get tasks with due_date today or in 3 days
    const { data: tasks, error: tasksError } = await adminClient
      .from("tasks")
      .select("id, title, due_date, assignee_id, priority, column_id")
      .not("due_date", "is", null);

    if (tasksError) throw tasksError;
    if (!tasks || tasks.length === 0) {
      return new Response(JSON.stringify({ message: "Nenhuma tarefa com prazo encontrada", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter tasks: due today or due in exactly 3 days
    const relevantTasks = tasks.filter((t) => {
      const dueDate = new Date(t.due_date!);
      const dueDateBrt = new Date(dueDate.getTime() + (brtOffset + dueDate.getTimezoneOffset()) * 60000);
      const dueDateStr = dueDateBrt.toISOString().split("T")[0];
      return dueDateStr === todayStr || dueDateStr === threeDaysStr;
    });

    if (relevantTasks.length === 0) {
      return new Response(JSON.stringify({ message: "Nenhuma tarefa com prazo hoje ou em 3 dias", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get assignee profiles
    const assigneeIds = [...new Set(relevantTasks.map((t) => t.assignee_id).filter(Boolean))];
    const { data: profiles } = assigneeIds.length > 0
      ? await adminClient.from("profiles").select("user_id, name, whatsapp_number").in("user_id", assigneeIds)
      : { data: [] };
    const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));

    // Get master user
    const { data: masterAuth } = await adminClient.auth.admin.listUsers();
    const masterUser = masterAuth?.users?.find((u: any) => u.email === "brunovalmorbida@live.com");
    let masterProfile: any = null;
    if (masterUser) {
      const { data } = await adminClient.from("profiles").select("user_id, name, whatsapp_number").eq("user_id", masterUser.id).maybeSingle();
      masterProfile = data;
    }

    // Get board names
    const columnIds = [...new Set(relevantTasks.map((t) => t.column_id))];
    const { data: columns } = await adminClient.from("board_columns").select("id, board_id").in("id", columnIds);
    const boardIds = columns ? [...new Set(columns.map((c) => c.board_id))] : [];
    const { data: boards } = boardIds.length > 0
      ? await adminClient.from("boards").select("id, name").in("id", boardIds)
      : { data: [] };
    const columnBoardMap = new Map(columns?.map((c) => [c.id, c.board_id]) || []);
    const boardNameMap = new Map(boards?.map((b) => [b.id, b.name]) || []);

    const priorityLabels: Record<string, string> = {
      low: "Baixa",
      medium: "Média",
      high: "Alta",
      urgent: "🚨 Urgente",
    };

    const results: Array<{ task: string; to: string; phone: string; status: string; error?: string }> = [];

    const sendWhatsApp = async (phone: string, message: string, taskTitle: string, label: string) => {
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
        results.push({
          task: taskTitle,
          to: label,
          phone,
          status: response.ok ? "sent" : "error",
          ...(response.ok ? {} : { error: JSON.stringify(responseData) }),
        });
      } catch (e: any) {
        results.push({ task: taskTitle, to: label, phone, status: "error", error: e.message });
      }
    };

    for (const task of relevantTasks) {
      const dueDate = new Date(task.due_date!);
      const dueDateBrt = new Date(dueDate.getTime() + (-3 * 60 + dueDate.getTimezoneOffset()) * 60000);
      const dueDateStr = dueDateBrt.toISOString().split("T")[0];
      const formattedDate = dueDateBrt.toLocaleDateString("pt-BR");

      const isToday = dueDateStr === todayStr;
      const boardId = columnBoardMap.get(task.column_id);
      const boardName = boardId ? boardNameMap.get(boardId) : "Desconhecido";

      const emoji = isToday ? "🔴" : "⚠️";
      const urgency = isToday
        ? "O prazo desta tarefa é *HOJE*! Por favor, finalize até o final do dia."
        : "Faltam *3 dias* para o prazo desta tarefa. Organize-se para concluí-la a tempo.";

      const buildMessage = (recipientName: string) =>
        `${emoji} *Lembrete de Prazo — Tarefa do Quadro Kanban*\n\n` +
        `📌 *Tipo:* Tarefa do Quadro Kanban\n` +
        `📋 *Tarefa:* ${task.title}\n` +
        `📊 *Quadro:* ${boardName}\n` +
        `📅 *Prazo:* ${formattedDate}\n` +
        `🔴 *Prioridade:* ${priorityLabels[task.priority] || task.priority}\n\n` +
        `Olá ${recipientName}, ${urgency}`;

      // Send to assignee
      const assigneeProfile = task.assignee_id ? profileMap.get(task.assignee_id) : null;
      if (assigneeProfile?.whatsapp_number) {
        await sendWhatsApp(assigneeProfile.whatsapp_number, buildMessage(assigneeProfile.name), task.title, "assignee");
      }

      // Send to master (if different from assignee)
      if (masterProfile?.whatsapp_number && (!task.assignee_id || masterProfile.user_id !== task.assignee_id)) {
        await sendWhatsApp(masterProfile.whatsapp_number, buildMessage(masterProfile.name), task.title, "master");
      }

      // In-app notifications
      const notifTitle = isToday ? "⚠️ Prazo hoje!" : "📅 Prazo em 3 dias";
      const notifMessage = isToday
        ? `A tarefa "${task.title}" no quadro ${boardName} vence HOJE!`
        : `A tarefa "${task.title}" no quadro ${boardName} vence em 3 dias (${formattedDate}).`;

      if (task.assignee_id) {
        await adminClient.from("notifications").insert({ user_id: task.assignee_id, title: notifTitle, message: notifMessage, link: "/boards" });
      }
      if (masterUser && (!task.assignee_id || masterUser.id !== task.assignee_id)) {
        await adminClient.from("notifications").insert({ user_id: masterUser.id, title: notifTitle, message: notifMessage, link: "/boards" });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      total_relevant: relevantTasks.length,
      sent: results.filter((r) => r.status === "sent").length,
      errors: results.filter((r) => r.status === "error").length,
      details: results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Error in notify-due-tasks:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
