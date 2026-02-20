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
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // BRT time
    const now = new Date();
    const brtOffset = -3 * 60;
    const brtNow = new Date(now.getTime() + (brtOffset + now.getTimezoneOffset()) * 60000);
    const todayStr = brtNow.toISOString().split("T")[0];
    const currentHours = brtNow.getHours();
    const currentMinutes = brtNow.getMinutes();
    const currentTotalMinutes = currentHours * 60 + currentMinutes;

    console.log(`notify-scheduled-tasks running at BRT ${currentHours}:${String(currentMinutes).padStart(2, "0")}`);

    // Get Z-API config
    const { data: zapiConfig } = await adminClient
      .from("zapi_config")
      .select("*")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    // Get tasks with scheduled_time and due_date = today
    const { data: allTasks, error: tasksError } = await adminClient
      .from("tasks")
      .select("id, title, scheduled_time, due_date, assignee_id, priority, column_id, description")
      .not("scheduled_time", "is", null)
      .not("due_date", "is", null);

    if (tasksError) throw tasksError;
    if (!allTasks || allTasks.length === 0) {
      return new Response(JSON.stringify({ message: "Nenhuma tarefa com horário agendado", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter tasks due today
    const todayTasks = allTasks.filter((t) => {
      const dueDate = new Date(t.due_date!);
      const dueBrt = new Date(dueDate.getTime() + (brtOffset + dueDate.getTimezoneOffset()) * 60000);
      return dueBrt.toISOString().split("T")[0] === todayStr;
    });

    if (todayTasks.length === 0) {
      return new Response(JSON.stringify({ message: "Nenhuma tarefa agendada para hoje", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get columns to check if task is in "Concluído" column
    const columnIds = [...new Set(todayTasks.map((t) => t.column_id))];
    const { data: columns } = await adminClient
      .from("board_columns")
      .select("id, name, board_id")
      .in("id", columnIds);
    const columnMap = new Map((columns || []).map((c) => [c.id, c]));

    // Get board names
    const boardIds = [...new Set((columns || []).map((c) => c.board_id))];
    const { data: boards } = boardIds.length > 0
      ? await adminClient.from("boards").select("id, name").in("id", boardIds)
      : { data: [] };
    const boardNameMap = new Map((boards || []).map((b) => [b.id, b.name]));

    // Filter tasks that need notification (1h or 10min before, not in completed column)
    const tasksToNotify: Array<{ task: any; minutesBefore: number; boardName: string }> = [];

    for (const task of todayTasks) {
      const col = columnMap.get(task.column_id);
      // Skip completed tasks
      if (col?.name?.toLowerCase().includes("concluíd") || col?.name?.toLowerCase().includes("concluido") || col?.name?.toLowerCase().includes("done")) {
        continue;
      }

      const [hours, minutes] = task.scheduled_time!.split(":").map(Number);
      const taskTotalMinutes = hours * 60 + minutes;
      const diff = taskTotalMinutes - currentTotalMinutes;

      // 1 hour before (55-65 min window)
      if (diff >= 55 && diff <= 65) {
        const boardName = col?.board_id ? boardNameMap.get(col.board_id) || "Desconhecido" : "Desconhecido";
        tasksToNotify.push({ task, minutesBefore: 60, boardName });
      }
      // 10 minutes before (5-15 min window)
      else if (diff >= 5 && diff <= 15) {
        const boardName = col?.board_id ? boardNameMap.get(col.board_id) || "Desconhecido" : "Desconhecido";
        tasksToNotify.push({ task, minutesBefore: 10, boardName });
      }
    }

    if (tasksToNotify.length === 0) {
      return new Response(JSON.stringify({ message: "Nenhuma tarefa próxima do horário agendado", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get assignee profiles
    const assigneeIds = [...new Set(tasksToNotify.map((t) => t.task.assignee_id).filter(Boolean))];
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

    const priorityLabels: Record<string, string> = {
      low: "Baixa", medium: "Média", high: "Alta", urgent: "🚨 Urgente",
    };

    const results: Array<{ task: string; to: string; phone: string; status: string; error?: string }> = [];

    const sendWhatsApp = async (phone: string, message: string, taskTitle: string, label: string) => {
      if (!zapiConfig) return;
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
          task: taskTitle, to: label, phone,
          status: response.ok ? "sent" : "error",
          ...(response.ok ? {} : { error: JSON.stringify(responseData) }),
        });
      } catch (e: any) {
        results.push({ task: taskTitle, to: label, phone, status: "error", error: e.message });
      }
    };

    for (const { task, minutesBefore, boardName } of tasksToNotify) {
      const scheduledTimeFormatted = task.scheduled_time!.slice(0, 5);
      const emoji = minutesBefore === 10 ? "🔴" : "⚠️";
      const timeLabel = minutesBefore === 10 ? "*10 minutos*" : "*1 hora*";

      const buildMessage = (recipientName: string) =>
        `${emoji} *Lembrete de Horário*\n\n` +
        `📋 *Tarefa:* ${task.title}\n` +
        `📊 *Quadro:* ${boardName}\n` +
        `⏰ *Horário:* ${scheduledTimeFormatted}\n` +
        `🔴 *Prioridade:* ${priorityLabels[task.priority] || task.priority}\n` +
        (task.description ? `📝 *Descrição:* ${task.description}\n` : "") +
        `\nOlá ${recipientName}, faltam ${timeLabel} para o horário agendado desta tarefa. Por favor, finalize-a a tempo!`;

      // Send to assignee
      const assigneeProfile = task.assignee_id ? profileMap.get(task.assignee_id) : null;
      if (assigneeProfile?.whatsapp_number) {
        await sendWhatsApp(assigneeProfile.whatsapp_number, buildMessage(assigneeProfile.name), task.title, "assignee");
      }

      // Send to master (if different)
      if (masterProfile?.whatsapp_number && (!task.assignee_id || masterProfile.user_id !== task.assignee_id)) {
        await sendWhatsApp(masterProfile.whatsapp_number, buildMessage(masterProfile.name), task.title, "master");
      }

      // In-app notifications
      const notifTitle = minutesBefore === 10
        ? `🔴 Tarefa em 10 minutos!`
        : `⚠️ Tarefa em 1 hora`;
      const notifMessage = `A tarefa "${task.title}" no quadro ${boardName} está agendada para ${scheduledTimeFormatted}.`;

      if (task.assignee_id) {
        await adminClient.from("notifications").insert({ user_id: task.assignee_id, title: notifTitle, message: notifMessage, link: "/boards" });
      }
      if (masterUser && (!task.assignee_id || masterUser.id !== task.assignee_id)) {
        await adminClient.from("notifications").insert({ user_id: masterUser.id, title: notifTitle, message: notifMessage, link: "/boards" });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      tasks_notified: tasksToNotify.length,
      sent: results.filter((r) => r.status === "sent").length,
      errors: results.filter((r) => r.status === "error").length,
      details: results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Error in notify-scheduled-tasks:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
