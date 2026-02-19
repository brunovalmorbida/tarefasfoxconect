import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Accepted schedule types via query param or body
type ScheduleType = "daily" | "weekly" | "monthly";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Determine schedule type from body or query param
    let scheduleType: ScheduleType = "daily";
    try {
      const body = await req.json();
      if (body?.schedule) scheduleType = body.schedule;
    } catch {
      const url = new URL(req.url);
      const s = url.searchParams.get("schedule");
      if (s) scheduleType = s as ScheduleType;
    }

    console.log(`Running notify-recurring-tasks for schedule: ${scheduleType}`);

    // BRT time
    const now = new Date();
    const brtOffset = -3 * 60;
    const brtNow = new Date(now.getTime() + (brtOffset + now.getTimezoneOffset()) * 60000);
    const jsDay = brtNow.getDay(); // 0=Sun, 1=Mon...

    // Skip Sundays — recurring tasks only apply Mon-Sat
    if (jsDay === 0) {
      console.log("Today is Sunday, skipping recurring task notifications.");
      return new Response(JSON.stringify({ message: "Domingo — notificações de tarefas fixas ignoradas", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ourDay = jsDay - 1; // 0=Mon, 1=Tue... 5=Sat
    const dayOfMonth = brtNow.getDate();

    // Get Z-API config
    const { data: zapiConfig } = await adminClient
      .from("zapi_config")
      .select("*")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    // Get all recurring tasks
    const { data: allTasks, error: tasksError } = await adminClient
      .from("recurring_tasks")
      .select("*");
    if (tasksError) throw tasksError;

    // Filter tasks based on schedule type
    let relevantTasks: any[] = [];

    if (scheduleType === "daily") {
      // Daily tasks + weekday tasks for today's weekday
      relevantTasks = (allTasks || []).filter((t: any) => {
        if (t.frequency === "daily") return true;
        if (t.frequency === "weekday" && t.weekday === ourDay) return true;
        return false;
      });
    } else if (scheduleType === "weekly") {
      // Weekly tasks (sent on Monday)
      relevantTasks = (allTasks || []).filter((t: any) => t.frequency === "weekly");
    } else if (scheduleType === "monthly") {
      // Monthly tasks (sent on first business day)
      relevantTasks = (allTasks || []).filter((t: any) => t.frequency === "monthly");
    }

    if (relevantTasks.length === 0) {
      return new Response(JSON.stringify({ message: `Nenhuma tarefa ${scheduleType} encontrada`, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get boards for these tasks
    const boardIds = [...new Set(relevantTasks.map((t: any) => t.board_id).filter(Boolean))];
    const { data: boards } = boardIds.length > 0
      ? await adminClient.from("recurring_task_boards").select("id, name, assigned_user_id, team_id").in("id", boardIds)
      : { data: [] };
    const boardMap = new Map((boards || []).map((b: any) => [b.id, b]));

    // Get master user
    const { data: masterAuth } = await adminClient.auth.admin.listUsers();
    const masterUser = masterAuth?.users?.find((u: any) => u.email === "brunovalmorbida@live.com");
    let masterProfile: any = null;
    if (masterUser) {
      const { data } = await adminClient.from("profiles").select("user_id, name, whatsapp_number").eq("user_id", masterUser.id).maybeSingle();
      masterProfile = data;
    }

    // Group tasks by assigned user
    const tasksByUser = new Map<string, { tasks: any[]; boardNames: string[] }>();

    for (const task of relevantTasks) {
      const board = task.board_id ? boardMap.get(task.board_id) : null;
      const assignedUserId = board?.assigned_user_id;
      
      if (!assignedUserId) continue; // Skip tasks without an assigned user on the board

      if (!tasksByUser.has(assignedUserId)) {
        tasksByUser.set(assignedUserId, { tasks: [], boardNames: [] });
      }
      const entry = tasksByUser.get(assignedUserId)!;
      entry.tasks.push({ ...task, boardName: board?.name || "Sem quadro" });
      if (board?.name && !entry.boardNames.includes(board.name)) {
        entry.boardNames.push(board.name);
      }
    }

    // Get profiles for assigned users
    const assignedUserIds = [...tasksByUser.keys()];
    const { data: profiles } = assignedUserIds.length > 0
      ? await adminClient.from("profiles").select("user_id, name, whatsapp_number").in("user_id", assignedUserIds)
      : { data: [] };
    const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

    const frequencyLabels: Record<string, string> = {
      daily: "Diária",
      weekly: "Semanal",
      weekday: "Dia da semana",
      monthly: "Mensal",
    };

    const weekdayNames = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

    const results: Array<{ to: string; phone: string; status: string; error?: string }> = [];

    const sendWhatsApp = async (phone: string, message: string, label: string) => {
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
          to: label,
          phone,
          status: response.ok ? "sent" : "error",
          ...(response.ok ? {} : { error: JSON.stringify(responseData) }),
        });
      } catch (e: any) {
        results.push({ to: label, phone, status: "error", error: e.message });
      }
    };

    // Build schedule label for message header
    const scheduleLabel = scheduleType === "daily"
      ? `📅 *Tarefas de Hoje - ${weekdayNames[ourDay]}*`
      : scheduleType === "weekly"
      ? `📅 *Tarefas da Semana*`
      : `📅 *Tarefas do Mês*`;

    for (const [userId, { tasks: userTasks }] of tasksByUser) {
      const profile = profileMap.get(userId);
      if (!profile) continue;

      // Build consolidated message
      let message = `${scheduleLabel}\n\n`;
      message += `Olá ${profile.name}! `;

      if (scheduleType === "daily") {
        message += `Aqui estão suas tarefas fixas para hoje:\n\n`;
      } else if (scheduleType === "weekly") {
        message += `Aqui estão suas tarefas fixas semanais:\n\n`;
      } else {
        message += `Aqui estão suas tarefas fixas mensais:\n\n`;
      }

      for (const task of userTasks) {
        const freqInfo = task.frequency === "weekday"
          ? ` (${weekdayNames[task.weekday ?? 0]})`
          : task.frequency === "monthly"
          ? ` (dia ${task.month_day ?? 1})`
          : "";

        message += `📋 *${task.title}*\n`;
        message += `   📊 Quadro: ${task.boardName}\n`;
        message += `   🔄 Frequência: ${frequencyLabels[task.frequency]}${freqInfo}\n`;
        if (task.description) {
          message += `   📝 ${task.description}\n`;
        }
        message += `\n`;
      }

      message += `Total: *${userTasks.length}* tarefa(s) pendente(s). Bom trabalho! 💪`;

      // Send WhatsApp to assigned user
      if (profile.whatsapp_number) {
        await sendWhatsApp(profile.whatsapp_number, message, `user:${profile.name}`);
      }

      // Send WhatsApp to master admin (if different)
      if (masterProfile?.whatsapp_number && masterProfile.user_id !== userId) {
        const masterMessage = `${scheduleLabel}\n\n` +
          `Resumo das tarefas de *${profile.name}*:\n\n` +
          userTasks.map((t: any) => `📋 *${t.title}* (${t.boardName})`).join("\n") +
          `\n\nTotal: *${userTasks.length}* tarefa(s).`;
        await sendWhatsApp(masterProfile.whatsapp_number, masterMessage, `master:${profile.name}`);
      }

      // In-app notification for assigned user
      const notifTitle = scheduleType === "daily"
        ? `📋 Tarefas fixas de hoje`
        : scheduleType === "weekly"
        ? `📋 Tarefas fixas da semana`
        : `📋 Tarefas fixas do mês`;
      const notifMessage = `Você tem ${userTasks.length} tarefa(s) fixa(s) pendente(s): ${userTasks.map((t: any) => t.title).join(", ")}`;

      await adminClient.from("notifications").insert({
        user_id: userId,
        title: notifTitle,
        message: notifMessage,
        link: "/recurring-tasks",
      });

      // In-app notification for master (if different)
      if (masterUser && masterUser.id !== userId) {
        await adminClient.from("notifications").insert({
          user_id: masterUser.id,
          title: notifTitle,
          message: `${profile.name}: ${notifMessage}`,
          link: "/recurring-tasks",
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      schedule: scheduleType,
      total_tasks: relevantTasks.length,
      users_notified: tasksByUser.size,
      whatsapp_results: results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Error in notify-recurring-tasks:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
