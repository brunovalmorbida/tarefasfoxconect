import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TOOLS = [
  {
    type: "function",
    function: {
      name: "criar_tarefa",
      description: "Cria uma nova tarefa no quadro Kanban do usuário",
      parameters: {
        type: "object",
        properties: {
          titulo: { type: "string", description: "Título da tarefa" },
          descricao: { type: "string", description: "Descrição opcional da tarefa" },
          prioridade: { type: "string", enum: ["low", "medium", "high", "urgent"], description: "Prioridade da tarefa" },
        },
        required: ["titulo"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listar_tarefas",
      description: "Lista as tarefas do usuário. Pode filtrar por status ou mostrar atrasadas.",
      parameters: {
        type: "object",
        properties: {
          filtro: { type: "string", enum: ["todas", "atrasadas", "hoje", "pendentes", "concluidas"], description: "Filtro das tarefas" },
        },
        required: ["filtro"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "concluir_tarefa",
      description: "Marca uma tarefa como concluída movendo-a para a última coluna do quadro",
      parameters: {
        type: "object",
        properties: {
          titulo_parcial: { type: "string", description: "Parte do título da tarefa para buscar" },
        },
        required: ["titulo_parcial"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_lista_compras",
      description: "Cria uma nova lista de compras com itens",
      parameters: {
        type: "object",
        properties: {
          titulo: { type: "string", description: "Título da lista de compras" },
          urgencia: { type: "string", enum: ["low", "medium", "high", "urgent"], description: "Urgência da lista" },
          itens: {
            type: "array",
            items: {
              type: "object",
              properties: {
                nome: { type: "string" },
                quantidade: { type: "number" },
              },
              required: ["nome"],
              additionalProperties: false,
            },
            description: "Itens da lista de compras",
          },
        },
        required: ["titulo", "itens"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "resumo_dia",
      description: "Mostra um resumo do dia: tarefas pendentes, concluídas, atrasadas",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ajuda",
      description: "Mostra os comandos disponíveis quando o usuário não sabe o que fazer",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
];

const SYSTEM_PROMPT = `Você é o assistente TaskFox, um bot de gestão de tarefas via WhatsApp.
Interprete a mensagem do usuário em linguagem natural e execute o comando mais adequado.

Exemplos:
- "Criar tarefa revisar relatório" → criar_tarefa
- "Preciso comprar 5 resmas de papel e 2 toners" → criar_lista_compras  
- "Quais minhas tarefas?" ou "Minhas tarefas" → listar_tarefas
- "Concluir tarefa relatório" → concluir_tarefa
- "Como tá meu dia?" → resumo_dia
- "O que posso fazer?" → ajuda

Regras:
- Sempre execute UMA ferramenta por mensagem
- Se não entender, use ajuda
- Para prioridade, infira do contexto (urgente, importante = high; normal = medium; pode esperar = low)
- Para lista de compras, extraia os itens e quantidades da mensagem
- Quantidade padrão é 1 se não especificada`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();

    // Z-API webhook format
    const phone = body.phone || body.from;
    const messageText = body.text?.message || body.body || body.message?.text || "";

    if (!phone || !messageText) {
      return new Response(JSON.stringify({ ok: true, skipped: "no message" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ignore group messages
    if (body.isGroup) {
      return new Response(JSON.stringify({ ok: true, skipped: "group message" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanPhone = phone.replace(/\D/g, "");

    // Find user by WhatsApp number
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, name, whatsapp_number");

    const userProfile = (profiles || []).find(
      (p: any) => p.whatsapp_number && p.whatsapp_number.replace(/\D/g, "") === cleanPhone
    );

    if (!userProfile) {
      await sendWhatsApp(supabase, cleanPhone, "❌ Seu número não está cadastrado no sistema TaskFox. Peça ao administrador para cadastrar seu WhatsApp no perfil.");
      return new Response(JSON.stringify({ ok: true, error: "user not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!lovableApiKey) {
      await sendWhatsApp(supabase, cleanPhone, "⚠️ O sistema de comandos por IA está temporariamente indisponível.");
      return new Response(JSON.stringify({ ok: true, error: "no AI key" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call Lovable AI to interpret the command
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: messageText },
        ],
        tools: TOOLS,
        tool_choice: "required",
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);

      if (aiResponse.status === 429) {
        await sendWhatsApp(supabase, cleanPhone, "⏳ Muitas requisições. Tente novamente em alguns segundos.");
      } else if (aiResponse.status === 402) {
        await sendWhatsApp(supabase, cleanPhone, "⚠️ Limite de uso da IA atingido. Contate o administrador.");
      } else {
        await sendWhatsApp(supabase, cleanPhone, "⚠️ Erro ao processar comando. Tente novamente.");
      }

      return new Response(JSON.stringify({ ok: false, error: "AI error" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      await sendWhatsApp(supabase, cleanPhone, "🤔 Não entendi seu comando. Envie *ajuda* para ver o que posso fazer!");
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const functionName = toolCall.function.name;
    const args = JSON.parse(toolCall.function.arguments || "{}");

    // Execute the command
    let responseMessage = "";

    switch (functionName) {
      case "criar_tarefa":
        responseMessage = await handleCriarTarefa(supabase, userProfile, args);
        break;
      case "listar_tarefas":
        responseMessage = await handleListarTarefas(supabase, userProfile, args);
        break;
      case "concluir_tarefa":
        responseMessage = await handleConcluirTarefa(supabase, userProfile, args);
        break;
      case "criar_lista_compras":
        responseMessage = await handleCriarListaCompras(supabase, userProfile, args);
        break;
      case "resumo_dia":
        responseMessage = await handleResumoDia(supabase, userProfile);
        break;
      case "ajuda":
        responseMessage = handleAjuda(userProfile.name);
        break;
      default:
        responseMessage = "🤔 Comando não reconhecido. Envie *ajuda* para ver os comandos disponíveis.";
    }

    await sendWhatsApp(supabase, cleanPhone, responseMessage);

    // Log activity
    await supabase.from("activity_log").insert({
      action: `Comando WhatsApp: ${functionName}`,
      user_id: userProfile.user_id,
      details: { command: functionName, args, original_message: messageText },
    });

    return new Response(JSON.stringify({ ok: true, command: functionName }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─── HELPER: Send WhatsApp message ─────────────────────────
async function sendWhatsApp(supabase: any, phone: string, message: string) {
  try {
    const { data: zapiConfig } = await supabase
      .from("zapi_config")
      .select("*")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (!zapiConfig) return;

    const url = `https://api.z-api.io/instances/${zapiConfig.instance_id}/token/${zapiConfig.token}/send-text`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (zapiConfig.client_token) headers["Client-Token"] = zapiConfig.client_token;

    await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ phone: phone.replace(/\D/g, ""), message }),
    });
  } catch (e) {
    console.error("Error sending WhatsApp:", e);
  }
}

// ─── COMMAND: Criar Tarefa ─────────────────────────────────
async function handleCriarTarefa(supabase: any, profile: any, args: any) {
  const { titulo, descricao, prioridade } = args;

  // Find user's first board (assigned or team member)
  const { data: boards } = await supabase
    .from("boards")
    .select("id, name")
    .or(`assigned_user_id.eq.${profile.user_id},created_by.eq.${profile.user_id}`)
    .limit(1);

  if (!boards || boards.length === 0) {
    return "❌ Você não tem nenhum quadro Kanban disponível. Peça ao administrador para criar um.";
  }

  const board = boards[0];

  // Get first column of the board
  const { data: columns } = await supabase
    .from("board_columns")
    .select("id, name")
    .eq("board_id", board.id)
    .order("position", { ascending: true })
    .limit(1);

  if (!columns || columns.length === 0) {
    return "❌ O quadro não tem colunas. Peça ao administrador para configurá-lo.";
  }

  // Get max position
  const { data: existingTasks } = await supabase
    .from("tasks")
    .select("position")
    .eq("column_id", columns[0].id)
    .order("position", { ascending: false })
    .limit(1);

  const nextPosition = (existingTasks?.[0]?.position ?? -1) + 1;

  const { error } = await supabase.from("tasks").insert({
    title: titulo,
    description: descricao || null,
    priority: prioridade || "medium",
    column_id: columns[0].id,
    created_by: profile.user_id,
    assignee_id: profile.user_id,
    position: nextPosition,
  });

  if (error) {
    console.error("Error creating task:", error);
    return `❌ Erro ao criar tarefa: ${error.message}`;
  }

  const priorityLabels: Record<string, string> = { low: "🟢 Baixa", medium: "🟡 Média", high: "🟠 Alta", urgent: "🔴 Urgente" };

  return `✅ *Tarefa criada com sucesso!*\n\n` +
    `📋 *Título:* ${titulo}\n` +
    (descricao ? `📝 *Descrição:* ${descricao}\n` : "") +
    `🔥 *Prioridade:* ${priorityLabels[prioridade || "medium"]}\n` +
    `📊 *Quadro:* ${board.name}\n` +
    `📂 *Coluna:* ${columns[0].name}`;
}

// ─── COMMAND: Listar Tarefas ───────────────────────────────
async function handleListarTarefas(supabase: any, profile: any, args: any) {
  const { filtro } = args;

  let query = supabase
    .from("tasks")
    .select("id, title, priority, due_date, column_id")
    .eq("assignee_id", profile.user_id)
    .order("created_at", { ascending: false })
    .limit(10);

  const now = new Date().toISOString();

  if (filtro === "atrasadas") {
    query = query.lt("due_date", now).not("due_date", "is", null);
  } else if (filtro === "hoje") {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    query = query
      .gte("due_date", startOfDay.toISOString())
      .lte("due_date", endOfDay.toISOString());
  }

  const { data: tasks, error } = await query;

  if (error) return `❌ Erro ao buscar tarefas: ${error.message}`;

  if (!tasks || tasks.length === 0) {
    const filtroLabels: Record<string, string> = {
      todas: "nenhuma tarefa",
      atrasadas: "nenhuma tarefa atrasada",
      hoje: "nenhuma tarefa para hoje",
      pendentes: "nenhuma tarefa pendente",
      concluidas: "nenhuma tarefa concluída",
    };
    return `📋 Você não tem ${filtroLabels[filtro] || "tarefas"} no momento. Bom trabalho! 🎉`;
  }

  // Get column names
  const columnIds = [...new Set(tasks.map((t: any) => t.column_id))];
  const { data: columns } = await supabase
    .from("board_columns")
    .select("id, name")
    .in("id", columnIds);
  const colMap = new Map((columns || []).map((c: any) => [c.id, c.name]));

  const priorityEmoji: Record<string, string> = { low: "🟢", medium: "🟡", high: "🟠", urgent: "🔴" };

  const filtroTitles: Record<string, string> = {
    todas: "Suas Tarefas",
    atrasadas: "Tarefas Atrasadas ⚠️",
    hoje: "Tarefas de Hoje",
    pendentes: "Tarefas Pendentes",
    concluidas: "Tarefas Concluídas",
  };

  let msg = `📋 *${filtroTitles[filtro] || "Tarefas"}*\n\n`;
  tasks.forEach((t: any, i: number) => {
    const emoji = priorityEmoji[t.priority] || "⚪";
    const colName = colMap.get(t.column_id) || "";
    const dueStr = t.due_date ? ` | 📅 ${new Date(t.due_date).toLocaleDateString("pt-BR")}` : "";
    msg += `${i + 1}. ${emoji} ${t.title}\n   📂 ${colName}${dueStr}\n\n`;
  });

  return msg.trim();
}

// ─── COMMAND: Concluir Tarefa ──────────────────────────────
async function handleConcluirTarefa(supabase: any, profile: any, args: any) {
  const { titulo_parcial } = args;

  // Find matching task
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, column_id")
    .eq("assignee_id", profile.user_id)
    .ilike("title", `%${titulo_parcial}%`)
    .limit(5);

  if (!tasks || tasks.length === 0) {
    return `❌ Nenhuma tarefa encontrada com "${titulo_parcial}". Verifique o nome e tente novamente.`;
  }

  const task = tasks[0];

  // Get the board from column
  const { data: col } = await supabase
    .from("board_columns")
    .select("board_id")
    .eq("id", task.column_id)
    .single();

  if (!col) return "❌ Erro ao encontrar o quadro da tarefa.";

  // Get last column (Concluído)
  const { data: lastCol } = await supabase
    .from("board_columns")
    .select("id, name")
    .eq("board_id", col.board_id)
    .order("position", { ascending: false })
    .limit(1);

  if (!lastCol || lastCol.length === 0) return "❌ Erro ao encontrar coluna de conclusão.";

  // Move task to last column
  const { error } = await supabase
    .from("tasks")
    .update({ column_id: lastCol[0].id })
    .eq("id", task.id);

  if (error) return `❌ Erro ao concluir: ${error.message}`;

  return `✅ *Tarefa concluída!*\n\n` +
    `📋 *${task.title}*\n` +
    `📂 Movida para: *${lastCol[0].name}*\n\n` +
    `Ótimo trabalho! 🎉`;
}

// ─── COMMAND: Criar Lista de Compras ───────────────────────
async function handleCriarListaCompras(supabase: any, profile: any, args: any) {
  const { titulo, urgencia, itens } = args;

  const { data: list, error: listError } = await supabase
    .from("purchase_lists")
    .insert({
      title: titulo,
      urgency: urgencia || "medium",
      requested_by: profile.user_id,
    })
    .select()
    .single();

  if (listError) return `❌ Erro ao criar lista: ${listError.message}`;

  const rows = (itens || []).map((item: any) => ({
    list_id: list.id,
    name: item.nome,
    quantity: item.quantidade || 1,
    category: "other",
  }));

  if (rows.length > 0) {
    await supabase.from("purchase_list_items").insert(rows);
  }

  const urgencyLabels: Record<string, string> = { low: "🟢 Baixa", medium: "🟡 Média", high: "🟠 Alta", urgent: "🔴 Urgente" };

  let msg = `🛒 *Lista de compras criada!*\n\n` +
    `📋 *${titulo}*\n` +
    `⚡ *Urgência:* ${urgencyLabels[urgencia || "medium"]}\n\n` +
    `📦 *Itens (${rows.length}):*\n`;

  rows.forEach((item: any, i: number) => {
    msg += `  ${i + 1}. ${item.name} (x${item.quantity})\n`;
  });

  // Notify admin
  try {
    await supabase.functions.invoke("notify-purchase", {
      body: { listId: list.id, action: "created" },
    });
  } catch { /* non-critical */ }

  return msg;
}

// ─── COMMAND: Resumo do Dia ────────────────────────────────
async function handleResumoDia(supabase: any, profile: any) {
  // Get all user's tasks
  const { data: allTasks } = await supabase
    .from("tasks")
    .select("id, title, priority, due_date, column_id")
    .eq("assignee_id", profile.user_id);

  const now = new Date();
  const tasks = allTasks || [];

  // Get all columns to identify "done" (last column per board)
  const columnIds = [...new Set(tasks.map((t: any) => t.column_id))];
  const { data: columns } = columnIds.length > 0
    ? await supabase.from("board_columns").select("id, name, board_id, position").in("id", columnIds)
    : { data: [] };

  // Find last columns per board
  const boardMaxPos = new Map<string, number>();
  (columns || []).forEach((c: any) => {
    const curr = boardMaxPos.get(c.board_id) || 0;
    if (c.position > curr) boardMaxPos.set(c.board_id, c.position);
  });

  const doneColumnIds = new Set(
    (columns || []).filter((c: any) => c.position === boardMaxPos.get(c.board_id)).map((c: any) => c.id)
  );

  const overdue = tasks.filter((t: any) => t.due_date && new Date(t.due_date) < now && !doneColumnIds.has(t.column_id));
  const done = tasks.filter((t: any) => doneColumnIds.has(t.column_id));
  const pending = tasks.filter((t: any) => !doneColumnIds.has(t.column_id));

  // Purchases
  const { data: purchaseLists } = await supabase
    .from("purchase_lists")
    .select("id, status")
    .eq("requested_by", profile.user_id);

  const pendingPurchases = (purchaseLists || []).filter((p: any) => p.status === "pending").length;

  const totalScore = tasks.length > 0 ? Math.round((done.length / tasks.length) * 100) : 0;

  let scoreEmoji = "🔴";
  if (totalScore >= 80) scoreEmoji = "🟢";
  else if (totalScore >= 50) scoreEmoji = "🟡";

  let msg = `📊 *Resumo do Dia - ${profile.name}*\n\n` +
    `${scoreEmoji} *Score de Produtividade:* ${totalScore}%\n\n` +
    `📋 *Tarefas:*\n` +
    `  ✅ Concluídas: ${done.length}\n` +
    `  ⏳ Pendentes: ${pending.length}\n` +
    `  ⚠️ Atrasadas: ${overdue.length}\n` +
    `  📊 Total: ${tasks.length}\n`;

  if (pendingPurchases > 0) {
    msg += `\n🛒 *Compras pendentes:* ${pendingPurchases}\n`;
  }

  if (overdue.length > 0) {
    msg += `\n🔴 *Tarefas atrasadas:*\n`;
    overdue.slice(0, 5).forEach((t: any, i: number) => {
      const dueStr = t.due_date ? new Date(t.due_date).toLocaleDateString("pt-BR") : "";
      msg += `  ${i + 1}. ${t.title} (📅 ${dueStr})\n`;
    });
  }

  msg += `\n💬 Envie *ajuda* para ver os comandos disponíveis.`;

  return msg;
}

// ─── COMMAND: Ajuda ────────────────────────────────────────
function handleAjuda(userName: string) {
  return `👋 Olá, ${userName}! Sou o *TaskFox Bot*.\n\n` +
    `Você pode me enviar comandos em linguagem natural. Aqui estão alguns exemplos:\n\n` +
    `📋 *Tarefas:*\n` +
    `  • "Criar tarefa revisar relatório"\n` +
    `  • "Criar tarefa urgente: preparar apresentação"\n` +
    `  • "Minhas tarefas"\n` +
    `  • "Tarefas atrasadas"\n` +
    `  • "Concluir tarefa relatório"\n\n` +
    `🛒 *Compras:*\n` +
    `  • "Comprar 5 resmas de papel e 2 toners"\n` +
    `  • "Preciso de material de limpeza"\n\n` +
    `📊 *Resumo:*\n` +
    `  • "Como tá meu dia?"\n` +
    `  • "Resumo"\n\n` +
    `Basta digitar normalmente que eu entendo! 🚀`;
}
