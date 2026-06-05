import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Sends recurring tasks that are still PENDING (not completed) for the current
// period. Used by the 13:30 and 17:00 BRT reminders Mon-Fri.
// Includes daily, weekday (today), and weekly tasks. Monthly is handled by the
// morning consolidated send.
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

    // Optional label from body (afternoon | end_of_day) — only used in the message header
    let label: "afternoon" | "end_of_day" = "afternoon";
    try {
      const body = await req.json();
      if (body?.label === "end_of_day") label = "end_of_day";
    } catch { /* ignore */ }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // BRT date math
    const now = new Date();
    const brtNow = new Date(now.getTime() + (-3 * 60 + now.getTimezoneOffset()) * 60000);
    const jsDay = brtNow.getDay(); // 0=Sun..6=Sat
    const ourDay = jsDay === 0 ? 6 : jsDay - 1; // 0=Mon..5=Sat,6=Sun

    const todayStr = `${brtNow.getFullYear()}-${String(brtNow.getMonth() + 1).padStart(2, "0")}-${String(brtNow.getDate()).padStart(2, "0")}`;
    // Monday of current week (BRT) as period_start for weekly tasks
    const monday = new Date(brtNow);
    const diffToMon = jsDay === 0 ? -6 : 1 - jsDay;
    monday.setDate(brtNow.getDate() + diffToMon);
    const weekStartStr = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;

    // Get all recurring tasks
    const { data: allTasks, error: tasksError } = await adminClient
      .from("recurring_tasks")
      .select("*");
    if (tasksError) throw tasksError;

    // Filter to today's daily / weekday-of-today / weekly tasks
    const pendingCandidates = (allTasks || []).filter((t: any) => {
      if (t.frequency === "daily") return true;
      if (t.frequency === "weekday") return t.weekday === ourDay;
      if (t.frequency === "weekly") return true;
      return false;
    });

    if (pendingCandidates.length === 0) {
      return new Response(JSON.stringify({ message: "Nenhuma tarefa pendente hoje", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine completions: daily/weekday use today; weekly uses Monday of this week
    const dailyIds = pendingCandidates.filter((t: any) => t.frequency !== "weekly").map((t: any) => t.id);
    const weeklyIds = pendingCandidates.filter((t: any) => t.frequency === "weekly").map((t: any) => t.id);

    const completedSet = new Set<string>();
    if (dailyIds.length > 0) {
      const { data } = await adminClient
        .from("recurring_task_completions")
        .select("recurring_task_id")
        .in("recurring_task_id", dailyIds)
        .eq("period_start", todayStr);
      (data || []).forEach((c: any) => completedSet.add(c.recurring_task_id));
    }
    if (weeklyIds.length > 0) {
      const { data } = await adminClient
        .from("recurring_task_completions")
        .select("recurring_task_id")
        .in("recurring_task_id", weeklyIds)
        .eq("period_start", weekStartStr);
      (data || []).forEach((c: any) => completedSet.add(c.recurring_task_id));
    }

    const pending = pendingCandidates.filter((t: any) => !completedSet.has(t.id));
    if (pending.length === 0) {
      return new Response(JSON.stringify({ message: "Todas as tarefas fixas já foram concluídas 🎉", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Boards
    const boardIds = [...new Set(pending.map((t: any) => t.board_id).filter(Boolean))];
    const { data: boards } = boardIds.length > 0
      ? await adminClient.from("recurring_task_boards").select("id, name, assigned_user_id").in("id", boardIds)
      : { data: [] };
    const boardMap = new Map((boards || []).map((b: any) => [b.id, b]));

    // Z-API
    const { data: zapiConfig } = await adminClient
      .from("zapi_config").select("*").eq("is_active", true).limit(1).maybeSingle();

    // Master admin
    const { data: masterAuth } = await adminClient.auth.admin.listUsers();
    const masterUser = masterAuth?.users?.find((u: any) =>
      u.email === "brunovalmorbida@foxconect.net.br" || u.email === "brunovalmorbida@live.com"
    );
    let masterProfile: any = null;
    if (masterUser) {
      const { data } = await adminClient.from("profiles").select("user_id, name, whatsapp_number").eq("user_id", masterUser.id).maybeSingle();
      masterProfile = data;
    }

    // Group by assigned user
    const tasksByUser = new Map<string, any[]>();
    for (const task of pending) {
      const board = task.board_id ? boardMap.get(task.board_id) : null;
      const assignedUserId = board?.assigned_user_id;
      if (!assignedUserId) continue;
      if (!tasksByUser.has(assignedUserId)) tasksByUser.set(assignedUserId, []);
      tasksByUser.get(assignedUserId)!.push({ ...task, boardName: board?.name || "Sem quadro" });
    }

    const userIds = [...tasksByUser.keys()];
    const { data: profiles } = userIds.length > 0
      ? await adminClient.from("profiles").select("user_id, name, whatsapp_number").in("user_id", userIds)
      : { data: [] };
    const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

    const headerTitle = label === "end_of_day"
      ? "🕔 *Pendências de Fim de Expediente — Tarefas Fixas*"
      : "🕐 *Pendências da Tarde — Tarefas Fixas*";
    const headerHint = label === "end_of_day"
      ? "Estas *tarefas fixas* (recorrentes, não são do quadro Kanban) ainda não foram concluídas hoje. Última chance antes do fim do expediente!"
      : "Estas *tarefas fixas* (recorrentes, não são do quadro Kanban) ainda estão pendentes. Vamos concluir?";

    const results: any[] = [];
    const sendWhatsApp = async (phone: string, message: string, tag: string) => {
      if (!zapiConfig) return;
      try {
        const url = `https://api.z-api.io/instances/${zapiConfig.instance_id}/token/${zapiConfig.token}/send-text`;
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (zapiConfig.client_token) headers["Client-Token"] = zapiConfig.client_token;
        const r = await fetch(url, { method: "POST", headers, body: JSON.stringify({ phone: phone.replace(/\D/g, ""), message }) });
        const rd = await r.json();
        results.push({ to: tag, phone, status: r.ok ? "sent" : "error", ...(r.ok ? {} : { error: JSON.stringify(rd) }) });
      } catch (e: any) {
        results.push({ to: tag, phone, status: "error", error: e.message });
      }
    };

    const freqLabel = (t: any) => {
      if (t.frequency === "daily") return "Diária";
      if (t.frequency === "weekly") return "Semanal";
      if (t.frequency === "weekday") return "Dia da semana";
      return t.frequency;
    };

    for (const [userId, userTasks] of tasksByUser) {
      const profile = profileMap.get(userId);
      if (!profile) continue;

      let message = `${headerTitle}\n\n`;
      message += `📌 *Tipo:* Tarefa Fixa (recorrente)\n\n`;
      message += `Olá ${profile.name}! ${headerHint}\n\n`;
      for (const task of userTasks) {
        message += `📋 *${task.title}*\n`;
        message += `   📊 Quadro: ${task.boardName}\n`;
        message += `   🔄 ${freqLabel(task)}`;
        if (task.scheduled_time) message += ` · ⏰ ${task.scheduled_time.slice(0, 5)}`;
        message += `\n`;
        if (task.description) message += `   📝 ${task.description}\n`;
        message += `\n`;
      }
      message += `Total: *${userTasks.length}* tarefa(s) pendente(s). ⏳`;

      if (profile.whatsapp_number) {
        await sendWhatsApp(profile.whatsapp_number, message, `user:${profile.name}`);
      }

      if (masterProfile?.whatsapp_number && masterProfile.user_id !== userId) {
        const masterMsg = `${headerTitle} — *${profile.name}*\n\n` +
          userTasks.map((t: any) => `📋 *${t.title}* (${t.boardName})${t.scheduled_time ? ` ⏰ ${t.scheduled_time.slice(0,5)}` : ""}`).join("\n") +
          `\n\nTotal: *${userTasks.length}* pendente(s).`;
        await sendWhatsApp(masterProfile.whatsapp_number, masterMsg, `master:${profile.name}`);
      }

      await adminClient.from("notifications").insert({
        user_id: userId,
        title: label === "end_of_day" ? "🕔 Pendências de fim de expediente" : "🕐 Pendências da tarde",
        message: `Você tem ${userTasks.length} tarefa(s) fixa(s) pendente(s): ${userTasks.map((t: any) => t.title).join(", ")}`,
        link: "/recurring-tasks",
      });

      if (masterUser && masterUser.id !== userId) {
        await adminClient.from("notifications").insert({
          user_id: masterUser.id,
          title: label === "end_of_day" ? "🕔 Pendências de fim de expediente" : "🕐 Pendências da tarde",
          message: `${profile.name}: ${userTasks.length} pendente(s) — ${userTasks.map((t: any) => t.title).join(", ")}`,
          link: "/recurring-tasks",
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      label,
      pending_tasks: pending.length,
      users_notified: tasksByUser.size,
      whatsapp_results: results,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("Error in notify-overdue-recurring-tasks:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
