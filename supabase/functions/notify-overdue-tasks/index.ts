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
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is admin (optional - skip for cron)
    const authHeader = req.headers.get("Authorization");
    let isAuthorized = false;

    if (authHeader && !authHeader.includes(anonKey)) {
      const callerClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user: caller } } = await callerClient.auth.getUser();
      if (caller) {
        const adminClient = createClient(supabaseUrl, serviceRoleKey);
        const { data: role } = await adminClient
          .from("user_roles")
          .select("role")
          .eq("user_id", caller.id)
          .eq("role", "admin")
          .maybeSingle();
        if (role) isAuthorized = true;
      }
    } else {
      // Allow cron/service calls
      isAuthorized = true;
    }

    if (!isAuthorized) throw new Error("Sem permissão");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check if Z-API is configured and active
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

    // Get overdue tasks with assignees who have WhatsApp numbers
    const { data: overdueTasks, error: tasksError } = await adminClient
      .from("tasks")
      .select(`
        id, title, due_date, assignee_id, priority,
        column_id
      `)
      .not("due_date", "is", null)
      .not("assignee_id", "is", null)
      .lt("due_date", new Date().toISOString());

    if (tasksError) throw tasksError;

    if (!overdueTasks || overdueTasks.length === 0) {
      return new Response(JSON.stringify({ message: "Nenhuma tarefa atrasada com responsável encontrada", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get assignee profiles with WhatsApp numbers
    const assigneeIds = [...new Set(overdueTasks.map(t => t.assignee_id).filter(Boolean))];
    const { data: profiles } = await adminClient
      .from("profiles")
      .select("user_id, name, whatsapp_number")
      .in("user_id", assigneeIds);

    if (!profiles) {
      return new Response(JSON.stringify({ message: "Nenhum perfil encontrado", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const profileMap = new Map(profiles.map(p => [p.user_id, p]));

    // Get board names for context
    const columnIds = [...new Set(overdueTasks.map(t => t.column_id))];
    const { data: columns } = await adminClient
      .from("board_columns")
      .select("id, board_id")
      .in("id", columnIds);

    const boardIds = columns ? [...new Set(columns.map(c => c.board_id))] : [];
    const { data: boards } = await adminClient
      .from("boards")
      .select("id, name")
      .in("id", boardIds);

    const columnBoardMap = new Map(columns?.map(c => [c.id, c.board_id]) || []);
    const boardNameMap = new Map(boards?.map(b => [b.id, b.name]) || []);

    const results: Array<{ task: string; phone: string; status: string; error?: string }> = [];

    // Parse optional body for test mode
    let testMode = false;
    let testPhone = "";
    try {
      const body = await req.json();
      testMode = body?.testMode === true;
      testPhone = body?.testPhone || "";
    } catch {
      // No body, proceed normally
    }

    for (const task of overdueTasks) {
      const profile = profileMap.get(task.assignee_id);
      if (!profile) continue;

      const phone = testMode && testPhone ? testPhone : profile.whatsapp_number;
      if (!phone) continue;

      const boardId = columnBoardMap.get(task.column_id);
      const boardName = boardId ? boardNameMap.get(boardId) : "Desconhecido";

      const dueDate = new Date(task.due_date!);
      const formattedDate = dueDate.toLocaleDateString("pt-BR");

      const priorityLabels: Record<string, string> = {
        low: "Baixa",
        medium: "Média",
        high: "Alta",
        urgent: "🚨 Urgente",
      };

      const message = `⚠️ *Tarefa Atrasada*\n\n` +
        `📋 *Tarefa:* ${task.title}\n` +
        `📊 *Quadro:* ${boardName}\n` +
        `📅 *Prazo:* ${formattedDate}\n` +
        `🔴 *Prioridade:* ${priorityLabels[task.priority] || task.priority}\n\n` +
        `Olá ${profile.name}, esta tarefa está atrasada. Por favor, verifique o mais breve possível.`;

      // Send via Z-API
      try {
        const zapiUrl = `https://api.z-api.io/instances/${zapiConfig.instance_id}/token/${zapiConfig.token}/send-text`;
        const response = await fetch(zapiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: phone.replace(/\D/g, ""),
            message,
          }),
        });

        const responseData = await response.json();

        if (response.ok) {
          results.push({ task: task.title, phone, status: "sent" });
        } else {
          results.push({ task: task.title, phone, status: "error", error: JSON.stringify(responseData) });
        }
      } catch (sendError: any) {
        results.push({ task: task.title, phone, status: "error", error: sendError.message });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      total_overdue: overdueTasks.length,
      sent: results.filter(r => r.status === "sent").length,
      errors: results.filter(r => r.status === "error").length,
      skipped: overdueTasks.length - results.length,
      details: results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Error in notify-overdue-tasks:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
