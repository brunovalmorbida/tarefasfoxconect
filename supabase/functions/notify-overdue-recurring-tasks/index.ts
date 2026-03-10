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

    // BRT time for task logic
    const now = new Date();
    const brtOffset = -3 * 60;
    const brtNow = new Date(now.getTime() + (brtOffset + now.getTimezoneOffset()) * 60000);
    const jsDay = brtNow.getDay();
    const ourDay = jsDay - 1; // 0=Mon...5=Sat
    const dayOfMonth = brtNow.getDate();
    const currentTimeStr = `${String(brtNow.getHours()).padStart(2, "0")}:${String(brtNow.getMinutes()).padStart(2, "0")}`;
    const todayStr = `${brtNow.getFullYear()}-${String(brtNow.getMonth() + 1).padStart(2, "0")}-${String(brtNow.getDate()).padStart(2, "0")}`;

    console.log(`Checking overdue recurring tasks at BRT ${currentTimeStr} on ${todayStr}`);

    // Get all recurring tasks that have a scheduled_time
    const { data: allTasks, error: tasksError } = await adminClient
      .from("recurring_tasks")
      .select("*")
      .not("scheduled_time", "is", null);
    if (tasksError) throw tasksError;

    if (!allTasks || allTasks.length === 0) {
      return new Response(JSON.stringify({ message: "Nenhuma tarefa com horário definido", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter tasks that are active today AND whose scheduled_time has passed
    const overdueTasks = allTasks.filter((t: any) => {
      // Check if task is active today
      if (t.frequency === "weekday" && t.weekday !== ourDay) return false;
      if (t.frequency === "monthly" && t.month_day !== dayOfMonth) return false;
      // daily and weekly are always active on business days

      // Check if scheduled_time has passed
      const taskTime = t.scheduled_time?.slice(0, 5); // "HH:MM"
      if (!taskTime) return false;
      return currentTimeStr >= taskTime;
    });

    if (overdueTasks.length === 0) {
      return new Response(JSON.stringify({ message: "Nenhuma tarefa atrasada no momento", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check completions for today
    const taskIds = overdueTasks.map((t: any) => t.id);
    const { data: completions } = await adminClient
      .from("recurring_task_completions")
      .select("recurring_task_id")
      .in("recurring_task_id", taskIds)
      .eq("period_start", todayStr);

    const completedSet = new Set((completions || []).map((c: any) => c.recurring_task_id));

    // Filter to only truly overdue (not completed)
    const reallyOverdue = overdueTasks.filter((t: any) => !completedSet.has(t.id));

    if (reallyOverdue.length === 0) {
      return new Response(JSON.stringify({ message: "Todas as tarefas com horário já foram concluídas", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get boards info
    const boardIds = [...new Set(reallyOverdue.map((t: any) => t.board_id).filter(Boolean))];
    const { data: boards } = boardIds.length > 0
      ? await adminClient.from("recurring_task_boards").select("id, name, assigned_user_id").in("id", boardIds)
      : { data: [] };
    const boardMap = new Map((boards || []).map((b: any) => [b.id, b]));

    // Get Z-API config
    const { data: zapiConfig } = await adminClient
      .from("zapi_config")
      .select("*")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    // Get master user
    const { data: masterAuth } = await adminClient.auth.admin.listUsers();
    const masterUser = masterAuth?.users?.find((u: any) => u.email === "brunovalmorbida@live.com");
    let masterProfile: any = null;
    if (masterUser) {
      const { data } = await adminClient.from("profiles").select("user_id, name, whatsapp_number").eq("user_id", masterUser.id).maybeSingle();
      masterProfile = data;
    }

    // Group by assigned user
    const tasksByUser = new Map<string, any[]>();
    for (const task of reallyOverdue) {
      const board = task.board_id ? boardMap.get(task.board_id) : null;
      const assignedUserId = board?.assigned_user_id;
      if (!assignedUserId) continue;

      if (!tasksByUser.has(assignedUserId)) tasksByUser.set(assignedUserId, []);
      tasksByUser.get(assignedUserId)!.push({ ...task, boardName: board?.name || "Sem quadro" });
    }

    // Get profiles
    const userIds = [...tasksByUser.keys()];
    const { data: profiles } = userIds.length > 0
      ? await adminClient.from("profiles").select("user_id, name, whatsapp_number").in("user_id", userIds)
      : { data: [] };
    const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

    const results: any[] = [];

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
        results.push({ to: label, phone, status: response.ok ? "sent" : "error", ...(response.ok ? {} : { error: JSON.stringify(responseData) }) });
      } catch (e: any) {
        results.push({ to: label, phone, status: "error", error: e.message });
      }
    };

    const sendWhatsAppWithButtons = async (phone: string, message: string, buttons: { id: string; label: string }[], label: string) => {
      if (!zapiConfig) return;
      try {
        const zapiUrl = `https://api.z-api.io/instances/${zapiConfig.instance_id}/token/${zapiConfig.token}/send-button-list`;
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (zapiConfig.client_token) headers["Client-Token"] = zapiConfig.client_token;

        const response = await fetch(zapiUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({
            phone: phone.replace(/\D/g, ""),
            message,
            buttonList: { buttons },
          }),
        });
        const responseData = await response.json();
        
        // If button message fails, fallback to plain text with hint
        if (!response.ok) {
          console.log("Button message failed, falling back to text:", JSON.stringify(responseData));
          const fallbackMsg = message + `\n\n💡 _Responda com "Feita [nome da tarefa]" para marcar como concluída!_`;
          await sendWhatsApp(phone, fallbackMsg, label);
          return;
        }
        
        results.push({ to: label, phone, status: "sent" });
      } catch (e: any) {
        // Fallback to plain text
        console.error("Button message error, falling back:", e.message);
        const fallbackMsg = message + `\n\n💡 _Responda com "Feita [nome da tarefa]" para marcar como concluída!_`;
        await sendWhatsApp(phone, fallbackMsg, label);
      }
    };

    for (const [userId, userTasks] of tasksByUser) {
      const profile = profileMap.get(userId);
      if (!profile) continue;

      let message = `⚠️ *Tarefas Fixas Atrasadas*\n\n`;
      message += `Olá ${profile.name}! As seguintes tarefas já passaram do horário previsto e ainda não foram concluídas:\n\n`;

      for (const task of userTasks) {
        message += `📋 *${task.title}*\n`;
        message += `   ⏰ Horário: ${task.scheduled_time?.slice(0, 5)}\n`;
        message += `   📊 Quadro: ${task.boardName}\n`;
        if (task.description) message += `   📝 ${task.description}\n`;
        message += `\n`;
      }

      message += `Total: *${userTasks.length}* tarefa(s) atrasada(s). Por favor, conclua-as o mais rápido possível! ⏳`;

      // Send WhatsApp to user with buttons (max 3 buttons per WhatsApp limitation)
      if (profile.whatsapp_number) {
        const buttons = userTasks.slice(0, 3).map((t: any, i: number) => ({
          id: `done_${i}`,
          label: `✅ Feita: ${t.title.slice(0, 20)}`,
        }));

        await sendWhatsAppWithButtons(profile.whatsapp_number, message, buttons, `user:${profile.name}`);
      }

      // Send to master admin
      if (masterProfile?.whatsapp_number && masterProfile.user_id !== userId) {
        const masterMsg = `⚠️ *Tarefas Fixas Atrasadas - ${profile.name}*\n\n` +
          userTasks.map((t: any) => `📋 *${t.title}* (⏰ ${t.scheduled_time?.slice(0, 5)}) - ${t.boardName}`).join("\n") +
          `\n\nTotal: *${userTasks.length}* tarefa(s) atrasada(s).`;
        await sendWhatsApp(masterProfile.whatsapp_number, masterMsg, `master:${profile.name}`);
      }

      // In-app notification
      await adminClient.from("notifications").insert({
        user_id: userId,
        title: "⚠️ Tarefas fixas atrasadas",
        message: `Você tem ${userTasks.length} tarefa(s) fixa(s) atrasada(s): ${userTasks.map((t: any) => `${t.title} (${t.scheduled_time?.slice(0, 5)})`).join(", ")}`,
        link: "/recurring-tasks",
      });

      // Master notification
      if (masterUser && masterUser.id !== userId) {
        await adminClient.from("notifications").insert({
          user_id: masterUser.id,
          title: "⚠️ Tarefas fixas atrasadas",
          message: `${profile.name} tem ${userTasks.length} tarefa(s) fixa(s) atrasada(s): ${userTasks.map((t: any) => t.title).join(", ")}`,
          link: "/recurring-tasks",
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      overdue_tasks: reallyOverdue.length,
      users_notified: tasksByUser.size,
      whatsapp_results: results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Error in notify-overdue-recurring-tasks:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
