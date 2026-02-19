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
      name: "resumo_completo",
      description: "Mostra um resumo completo das tarefas do usuário (kanban + fixas) para um período. Pode pedir de si mesmo ou de outro usuário (se for gestor da equipe ou admin). Ex: 'meu resumo da semana', 'resumo do mês do João', 'resumo semanal da Maria'",
      parameters: {
        type: "object",
        properties: {
          periodo: { type: "string", enum: ["dia", "semana", "mes"], description: "Período do resumo" },
          nome_usuario: { type: "string", description: "Nome do usuário alvo (opcional, se não informado usa o próprio usuário)" },
        },
        required: ["periodo"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "tarefas_usuario",
      description: "ADMIN ONLY: Lista as tarefas do quadro Kanban de outro usuário pelo nome. Ex: 'tarefas do João', 'quadro da Maria'",
      parameters: {
        type: "object",
        properties: {
          nome_usuario: { type: "string", description: "Nome (ou parte do nome) do usuário cujas tarefas se quer ver" },
          filtro: { type: "string", enum: ["todas", "atrasadas", "pendentes", "concluidas"], description: "Filtro das tarefas" },
        },
        required: ["nome_usuario"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "tarefas_diarias_usuario",
      description: "ADMIN ONLY: Lista as tarefas fixas/recorrentes (diárias) de outro usuário. Ex: 'tarefas diárias do João', 'rotina da Maria'",
      parameters: {
        type: "object",
        properties: {
          nome_usuario: { type: "string", description: "Nome (ou parte do nome) do usuário cujas tarefas diárias se quer ver" },
        },
        required: ["nome_usuario"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "print_quadro",
      description: "Gera uma imagem visual do quadro Kanban do usuário (ou de outro usuário se admin/gestor) e envia via WhatsApp. Ex: 'print do quadro', 'foto do meu quadro', 'imagem do quadro do João'",
      parameters: {
        type: "object",
        properties: {
          nome_usuario: { type: "string", description: "Nome do usuário alvo (opcional, se não informado usa o próprio usuário)" },
          nome_quadro: { type: "string", description: "Nome específico do quadro (opcional, se não informado usa o primeiro quadro)" },
        },
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
- "Meu resumo da semana" ou "Resumo semanal" → resumo_completo (periodo: "semana", sem nome_usuario)
- "Resumo do mês" → resumo_completo (periodo: "mes", sem nome_usuario)
- "Resumo do dia do João" → resumo_completo (periodo: "dia", nome_usuario: "João")
- "Resumo semanal da Maria" → resumo_completo (periodo: "semana", nome_usuario: "Maria")
- "Tarefas do João" ou "Quadro do João" → tarefas_usuario (pegar nome "João")
- "Tarefas diárias da Maria" ou "Rotina da Maria" ou "Tarefas fixas do João" → tarefas_diarias_usuario (pegar nome)
- "Print do quadro" ou "Foto do meu quadro" ou "Imagem do quadro" → print_quadro
- "Print do quadro do João" ou "Foto do quadro da Maria" → print_quadro (nome_usuario)
- "O que posso fazer?" → ajuda

Regras:
- Sempre execute UMA ferramenta por mensagem
- Se não entender, use ajuda
- Para prioridade, infira do contexto (urgente, importante = high; normal = medium; pode esperar = low)
- Para lista de compras, extraia os itens e quantidades da mensagem
- Quantidade padrão é 1 se não especificada
- Quando o usuário pedir um resumo completo (com período dia/semana/mês), use resumo_completo
- Se o usuário pedir resumo de OUTRA pessoa, inclua nome_usuario no resumo_completo
- Quando o usuário pedir tarefas de OUTRA pessoa, use tarefas_usuario ou tarefas_diarias_usuario
- "tarefas diárias", "rotina", "tarefas fixas" de alguém → tarefas_diarias_usuario
- "tarefas", "quadro" de alguém → tarefas_usuario
- "print", "foto", "imagem", "screenshot" do quadro → print_quadro`;

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
    console.log("Received phone raw:", phone, "| cleaned:", cleanPhone);

    // Find user by WhatsApp number - try multiple matching strategies
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, name, whatsapp_number");

    console.log("Profiles found:", (profiles || []).map((p: any) => ({ name: p.name, wn: p.whatsapp_number })));

    const userProfile = (profiles || []).find((p: any) => {
      if (!p.whatsapp_number) return false;
      const storedClean = p.whatsapp_number.replace(/\D/g, "");
      if (storedClean === cleanPhone) return true;
      if (cleanPhone.endsWith(storedClean) || storedClean.endsWith(cleanPhone)) return true;
      const last9stored = storedClean.slice(-9);
      const last9incoming = cleanPhone.slice(-9);
      if (last9stored === last9incoming && storedClean.length >= 10 && cleanPhone.length >= 10) return true;
      return false;
    });

    if (!userProfile) {
      await sendWhatsApp(supabase, cleanPhone, "❌ Seu número não está cadastrado no sistema TaskFox. Peça ao administrador para cadastrar seu WhatsApp no perfil.");
      return new Response(JSON.stringify({ ok: true, error: "user not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is admin
    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userProfile.user_id)
      .eq("role", "admin")
      .maybeSingle();
    const isAdmin = !!adminRole;

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
      case "resumo_completo":
        responseMessage = await handleResumoCompleto(supabase, userProfile, profiles || [], args, isAdmin);
        break;
      case "tarefas_usuario":
        if (!isAdmin) {
          responseMessage = "🔒 Apenas administradores podem consultar tarefas de outros usuários.";
        } else {
          responseMessage = await handleTarefasUsuario(supabase, profiles || [], args);
        }
        break;
      case "tarefas_diarias_usuario":
        if (!isAdmin) {
          responseMessage = "🔒 Apenas administradores podem consultar tarefas diárias de outros usuários.";
        } else {
          responseMessage = await handleTarefasDiariasUsuario(supabase, profiles || [], args);
        }
        break;
      case "print_quadro":
        // Special handling: sends image directly, not text
        await handlePrintQuadro(supabase, userProfile, profiles || [], args, isAdmin, cleanPhone, lovableApiKey);
        responseMessage = ""; // Already sent
        break;
      case "ajuda":
        responseMessage = handleAjuda(userProfile.name, isAdmin);
        break;
      default:
        responseMessage = "🤔 Comando não reconhecido. Envie *ajuda* para ver os comandos disponíveis.";
    }

    if (responseMessage) {
      await sendWhatsApp(supabase, cleanPhone, responseMessage);
    }

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

// ─── HELPER: Find profile by name ──────────────────────────
function findProfileByName(profiles: any[], nome: string) {
  const lower = nome.toLowerCase().trim();
  // Exact match first
  const exact = profiles.find((p: any) => p.name?.toLowerCase() === lower);
  if (exact) return exact;
  // Partial match
  return profiles.find((p: any) => p.name?.toLowerCase().includes(lower));
}

// ─── COMMAND: Criar Tarefa ─────────────────────────────────
async function handleCriarTarefa(supabase: any, profile: any, args: any) {
  const { titulo, descricao, prioridade } = args;

  const { data: boards } = await supabase
    .from("boards")
    .select("id, name")
    .or(`assigned_user_id.eq.${profile.user_id},created_by.eq.${profile.user_id}`)
    .limit(1);

  if (!boards || boards.length === 0) {
    return "❌ Você não tem nenhum quadro Kanban disponível. Peça ao administrador para criar um.";
  }

  const board = boards[0];

  const { data: columns } = await supabase
    .from("board_columns")
    .select("id, name")
    .eq("board_id", board.id)
    .order("position", { ascending: true })
    .limit(1);

  if (!columns || columns.length === 0) {
    return "❌ O quadro não tem colunas. Peça ao administrador para configurá-lo.";
  }

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

  const { data: col } = await supabase
    .from("board_columns")
    .select("board_id")
    .eq("id", task.column_id)
    .single();

  if (!col) return "❌ Erro ao encontrar o quadro da tarefa.";

  const { data: lastCol } = await supabase
    .from("board_columns")
    .select("id, name")
    .eq("board_id", col.board_id)
    .order("position", { ascending: false })
    .limit(1);

  if (!lastCol || lastCol.length === 0) return "❌ Erro ao encontrar coluna de conclusão.";

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

  try {
    await supabase.functions.invoke("notify-purchase", {
      body: { listId: list.id, action: "created" },
    });
  } catch { /* non-critical */ }

  return msg;
}

// ─── COMMAND: Resumo do Dia ────────────────────────────────
async function handleResumoDia(supabase: any, profile: any) {
  const { data: allTasks } = await supabase
    .from("tasks")
    .select("id, title, priority, due_date, column_id")
    .eq("assignee_id", profile.user_id);

  const now = new Date();
  const tasks = allTasks || [];

  const columnIds = [...new Set(tasks.map((t: any) => t.column_id))];
  const { data: columns } = columnIds.length > 0
    ? await supabase.from("board_columns").select("id, name, board_id, position").in("id", columnIds)
    : { data: [] };

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

// ─── COMMAND: Tarefas de outro usuário (ADMIN) ─────────────
async function handleTarefasUsuario(supabase: any, profiles: any[], args: any) {
  const { nome_usuario, filtro } = args;

  const targetProfile = findProfileByName(profiles, nome_usuario);
  if (!targetProfile) {
    return `❌ Nenhum usuário encontrado com o nome "${nome_usuario}".`;
  }

  // Get all boards where user is assigned or has tasks
  const { data: boards } = await supabase
    .from("boards")
    .select("id, name, board_columns(id, name, position)")
    .or(`assigned_user_id.eq.${targetProfile.user_id}`);

  // Also get tasks assigned to this user across all boards
  let taskQuery = supabase
    .from("tasks")
    .select("id, title, priority, due_date, column_id, created_at")
    .eq("assignee_id", targetProfile.user_id)
    .order("created_at", { ascending: false })
    .limit(20);

  const now = new Date().toISOString();
  if (filtro === "atrasadas") {
    taskQuery = taskQuery.lt("due_date", now).not("due_date", "is", null);
  }

  const { data: tasks } = await taskQuery;

  if (!tasks || tasks.length === 0) {
    return `📋 *${targetProfile.name}* não tem tarefas ${filtro === "atrasadas" ? "atrasadas" : ""} no momento.`;
  }

  // Get column info
  const columnIds = [...new Set(tasks.map((t: any) => t.column_id))];
  const { data: columns } = await supabase
    .from("board_columns")
    .select("id, name, board_id, position")
    .in("id", columnIds);

  const colMap = new Map((columns || []).map((c: any) => [c.id, c.name]));

  // Identify done columns
  const boardMaxPos = new Map<string, number>();
  (columns || []).forEach((c: any) => {
    const curr = boardMaxPos.get(c.board_id) || 0;
    if (c.position > curr) boardMaxPos.set(c.board_id, c.position);
  });
  const doneColumnIds = new Set(
    (columns || []).filter((c: any) => c.position === boardMaxPos.get(c.board_id)).map((c: any) => c.id)
  );

  // Filter based on filtro
  let filteredTasks = tasks;
  if (filtro === "pendentes") {
    filteredTasks = tasks.filter((t: any) => !doneColumnIds.has(t.column_id));
  } else if (filtro === "concluidas") {
    filteredTasks = tasks.filter((t: any) => doneColumnIds.has(t.column_id));
  }

  const pending = tasks.filter((t: any) => !doneColumnIds.has(t.column_id));
  const done = tasks.filter((t: any) => doneColumnIds.has(t.column_id));
  const overdue = tasks.filter((t: any) => t.due_date && new Date(t.due_date) < new Date() && !doneColumnIds.has(t.column_id));

  const priorityEmoji: Record<string, string> = { low: "🟢", medium: "🟡", high: "🟠", urgent: "🔴" };

  const filtroLabel = filtro === "atrasadas" ? " (Atrasadas)" : filtro === "pendentes" ? " (Pendentes)" : filtro === "concluidas" ? " (Concluídas)" : "";

  let msg = `👤 *Tarefas de ${targetProfile.name}${filtroLabel}*\n\n`;
  msg += `📊 Resumo: ✅ ${done.length} | ⏳ ${pending.length} | ⚠️ ${overdue.length}\n\n`;

  filteredTasks.slice(0, 15).forEach((t: any, i: number) => {
    const emoji = priorityEmoji[t.priority] || "⚪";
    const colName = colMap.get(t.column_id) || "";
    const dueStr = t.due_date ? ` | 📅 ${new Date(t.due_date).toLocaleDateString("pt-BR")}` : "";
    const isDone = doneColumnIds.has(t.column_id) ? " ✅" : "";
    msg += `${i + 1}. ${emoji} ${t.title}${isDone}\n   📂 ${colName}${dueStr}\n\n`;
  });

  return msg.trim();
}

// ─── COMMAND: Tarefas diárias de outro usuário (ADMIN) ─────
async function handleTarefasDiariasUsuario(supabase: any, profiles: any[], args: any) {
  const { nome_usuario } = args;

  const targetProfile = findProfileByName(profiles, nome_usuario);
  if (!targetProfile) {
    return `❌ Nenhum usuário encontrado com o nome "${nome_usuario}".`;
  }

  // Get recurring task boards assigned to this user
  const { data: boards } = await supabase
    .from("recurring_task_boards")
    .select("id, name, frequency_type, weekday")
    .eq("assigned_user_id", targetProfile.user_id);

  if (!boards || boards.length === 0) {
    return `📋 *${targetProfile.name}* não tem quadros de tarefas fixas atribuídos.`;
  }

  const boardIds = boards.map((b: any) => b.id);

  // Get recurring tasks for these boards
  const { data: tasks } = await supabase
    .from("recurring_tasks")
    .select("id, title, frequency, weekday, month_day, board_id")
    .in("board_id", boardIds);

  if (!tasks || tasks.length === 0) {
    return `📋 *${targetProfile.name}* não tem tarefas fixas cadastradas.`;
  }

  // Get today's completions
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const taskIds = tasks.map((t: any) => t.id);
  const { data: completions } = await supabase
    .from("recurring_task_completions")
    .select("recurring_task_id, period_start")
    .in("recurring_task_id", taskIds)
    .eq("period_start", todayStr);

  const completedTaskIds = new Set((completions || []).map((c: any) => c.recurring_task_id));

  const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  const currentWeekday = now.getDay();

  // Filter tasks active today
  const todayTasks = tasks.filter((t: any) => {
    if (t.frequency === "daily") return true;
    if (t.frequency === "weekday") return currentWeekday >= 1 && currentWeekday <= 5;
    if (t.frequency === "weekly") return t.weekday === currentWeekday;
    if (t.frequency === "monthly") return t.month_day === now.getDate();
    return false;
  });

  const totalToday = todayTasks.length;
  const doneToday = todayTasks.filter((t: any) => completedTaskIds.has(t.id)).length;
  const pendingToday = totalToday - doneToday;
  const progressPct = totalToday > 0 ? Math.round((doneToday / totalToday) * 100) : 0;

  let progressEmoji = "🔴";
  if (progressPct >= 80) progressEmoji = "🟢";
  else if (progressPct >= 50) progressEmoji = "🟡";

  let msg = `📋 *Tarefas Diárias de ${targetProfile.name}*\n\n`;
  msg += `${progressEmoji} *Progresso Hoje:* ${progressPct}% (${doneToday}/${totalToday})\n\n`;

  if (todayTasks.length === 0) {
    msg += `Sem tarefas fixas para hoje.\n`;
  } else {
    msg += `*Tarefas de Hoje:*\n`;
    todayTasks.forEach((t: any, i: number) => {
      const isDone = completedTaskIds.has(t.id);
      const status = isDone ? "✅" : "⏳";
      msg += `  ${i + 1}. ${status} ${t.title}\n`;
    });
  }

  if (pendingToday > 0) {
    msg += `\n⚠️ *${pendingToday} tarefa(s) pendente(s) hoje*`;
  } else if (totalToday > 0) {
    msg += `\n🎉 Todas as tarefas de hoje concluídas!`;
  }

  // Show all tasks grouped by board
  msg += `\n\n📊 *Todos os Quadros:*\n`;
  boards.forEach((board: any) => {
    const boardTasks = tasks.filter((t: any) => t.board_id === board.id);
    msg += `\n📌 *${board.name}* (${boardTasks.length} tarefas)\n`;
  });

  return msg.trim();
}

// ─── COMMAND: Resumo Completo (dia/semana/mês) ────────────
async function handleResumoCompleto(supabase: any, requesterProfile: any, allProfiles: any[], args: any, isAdmin: boolean) {
  const { periodo, nome_usuario } = args;
  
  let targetProfile = requesterProfile;
  
  // If requesting for another user, check permissions
  if (nome_usuario) {
    const found = findProfileByName(allProfiles, nome_usuario);
    if (!found) return `❌ Nenhum usuário encontrado com o nome "${nome_usuario}".`;
    
    if (found.user_id !== requesterProfile.user_id) {
      if (isAdmin) {
        targetProfile = found;
      } else {
        // Check if requester is team admin of a team the target belongs to
        const { data: requesterAdminTeams } = await supabase
          .from("team_members")
          .select("team_id")
          .eq("user_id", requesterProfile.user_id)
          .eq("role", "admin");
        
        const adminTeamIds = (requesterAdminTeams || []).map((t: any) => t.team_id);
        
        if (adminTeamIds.length === 0) {
          return "🔒 Você não tem permissão para ver o resumo de outros usuários.";
        }
        
        const { data: targetMemberships } = await supabase
          .from("team_members")
          .select("team_id")
          .eq("user_id", found.user_id)
          .in("team_id", adminTeamIds);
        
        if (!targetMemberships || targetMemberships.length === 0) {
          return "🔒 Você só pode ver o resumo de usuários das equipes que você gerencia.";
        }
        
        targetProfile = found;
      }
    }
  }
  
  // Calculate date range
  const now = new Date();
  let startDate: Date;
  let periodoLabel: string;
  
  switch (periodo) {
    case "semana": {
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1;
      startDate = new Date(now);
      startDate.setDate(now.getDate() - diff);
      startDate.setHours(0, 0, 0, 0);
      periodoLabel = "da Semana";
      break;
    }
    case "mes": {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      periodoLabel = "do Mês";
      break;
    }
    default: {
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
      periodoLabel = "do Dia";
      break;
    }
  }
  
  const isSelf = targetProfile.user_id === requesterProfile.user_id;
  const nameLabel = isSelf ? "Seu" : `de ${targetProfile.name}`;
  
  // ── KANBAN TASKS ──
  const { data: allTasks } = await supabase
    .from("tasks")
    .select("id, title, priority, due_date, column_id, created_at, updated_at")
    .eq("assignee_id", targetProfile.user_id);
  
  const tasks = allTasks || [];
  const columnIds = [...new Set(tasks.map((t: any) => t.column_id))];
  
  let columns: any[] = [];
  if (columnIds.length > 0) {
    const { data } = await supabase.from("board_columns").select("id, name, board_id, position").in("id", columnIds);
    columns = data || [];
  }
  
  const boardMaxPos = new Map<string, number>();
  columns.forEach((c: any) => {
    const curr = boardMaxPos.get(c.board_id) || 0;
    if (c.position > curr) boardMaxPos.set(c.board_id, c.position);
  });
  const doneColumnIds = new Set(
    columns.filter((c: any) => c.position === boardMaxPos.get(c.board_id)).map((c: any) => c.id)
  );
  
  const overdue = tasks.filter((t: any) => t.due_date && new Date(t.due_date) < now && !doneColumnIds.has(t.column_id));
  const doneTasks = tasks.filter((t: any) => doneColumnIds.has(t.column_id));
  const pendingTasks = tasks.filter((t: any) => !doneColumnIds.has(t.column_id));
  
  // ── RECURRING TASKS ──
  const { data: recurringBoards } = await supabase
    .from("recurring_task_boards")
    .select("id, name, assigned_user_id, team_id");
  
  const userRecBoards = (recurringBoards || []).filter((b: any) => 
    b.assigned_user_id === targetProfile.user_id || b.assigned_user_id === null
  );
  const recBoardIds = userRecBoards.map((b: any) => b.id);
  
  let recurringTasks: any[] = [];
  if (recBoardIds.length > 0) {
    const { data } = await supabase
      .from("recurring_tasks")
      .select("id, title, frequency, weekday, month_day, board_id")
      .in("board_id", recBoardIds);
    recurringTasks = data || [];
  }
  
  // Filter tasks active today
  const jsDay = now.getDay();
  const todayRecTasks = recurringTasks.filter((t: any) => {
    if (t.frequency === "daily") return true;
    if (t.frequency === "weekday") {
      const ourDay = jsDay === 0 ? 6 : jsDay - 1;
      return t.weekday === ourDay;
    }
    if (t.frequency === "weekly") return true;
    if (t.frequency === "monthly") return t.month_day === now.getDate();
    return false;
  });
  
  // Get completions for the period
  const recTaskIds = recurringTasks.map((t: any) => t.id);
  let completions: any[] = [];
  if (recTaskIds.length > 0) {
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const startStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}-${String(startDate.getDate()).padStart(2, "0")}`;
    
    const { data } = await supabase
      .from("recurring_task_completions")
      .select("recurring_task_id, period_start, completed_by")
      .in("recurring_task_id", recTaskIds)
      .gte("period_start", startStr)
      .lte("period_start", todayStr)
      .eq("completed_by", targetProfile.user_id);
    completions = data || [];
  }
  
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const completedTodaySet = new Set(
    completions.filter((c: any) => c.period_start === todayStr).map((c: any) => c.recurring_task_id)
  );
  
  const recDoneToday = todayRecTasks.filter((t: any) => completedTodaySet.has(t.id)).length;
  const recPendingToday = todayRecTasks.length - recDoneToday;
  const recTotalCompletions = completions.length;
  
  // ── BUILD MESSAGE ──
  const overallScore = (tasks.length + todayRecTasks.length) > 0
    ? Math.round(((doneTasks.length + recDoneToday) / (tasks.length + todayRecTasks.length)) * 100)
    : 0;
  
  let scoreEmoji = "🔴";
  if (overallScore >= 80) scoreEmoji = "🟢";
  else if (overallScore >= 50) scoreEmoji = "🟡";
  
  let msg = `📊 *Resumo ${periodoLabel} ${nameLabel}*\n`;
  msg += `${scoreEmoji} *Score Geral:* ${overallScore}%\n\n`;
  
  msg += `📋 *Kanban:*\n`;
  msg += `  ✅ Concluídas: ${doneTasks.length}\n`;
  msg += `  ⏳ Pendentes: ${pendingTasks.length}\n`;
  msg += `  ⚠️ Atrasadas: ${overdue.length}\n`;
  msg += `  📊 Total: ${tasks.length}\n\n`;
  
  msg += `🔄 *Tarefas Fixas (Hoje):*\n`;
  msg += `  ✅ Concluídas: ${recDoneToday}\n`;
  msg += `  ⏳ Pendentes: ${recPendingToday}\n`;
  msg += `  📊 Total: ${todayRecTasks.length}\n`;
  
  if (periodo !== "dia") {
    msg += `  📈 Conclusões no período: ${recTotalCompletions}\n`;
  }
  
  if (overdue.length > 0) {
    msg += `\n🔴 *Tarefas Atrasadas:*\n`;
    overdue.slice(0, 5).forEach((t: any, i: number) => {
      const dueStr = t.due_date ? new Date(t.due_date).toLocaleDateString("pt-BR") : "";
      msg += `  ${i + 1}. ${t.title} (📅 ${dueStr})\n`;
    });
    if (overdue.length > 5) msg += `  ... e mais ${overdue.length - 5}\n`;
  }
  
  if (recPendingToday > 0) {
    msg += `\n⏳ *Tarefas Fixas Pendentes Hoje:*\n`;
    const pendingRec = todayRecTasks.filter((t: any) => !completedTodaySet.has(t.id));
    pendingRec.slice(0, 5).forEach((t: any, i: number) => {
      msg += `  ${i + 1}. ${t.title}\n`;
    });
    if (pendingRec.length > 5) msg += `  ... e mais ${pendingRec.length - 5}\n`;
  }
  
  const { data: purchaseLists } = await supabase
    .from("purchase_lists")
    .select("id, status")
    .eq("requested_by", targetProfile.user_id)
    .eq("status", "pending");
  
  if (purchaseLists && purchaseLists.length > 0) {
    msg += `\n🛒 *Compras pendentes:* ${purchaseLists.length}\n`;
  }
  
  msg += `\n💬 Envie *ajuda* para ver todos os comandos.`;
  return msg.trim();
}

// ─── HELPER: Send WhatsApp image ──────────────────────────
async function sendWhatsAppImage(supabase: any, phone: string, base64Image: string, caption: string) {
  try {
    const { data: zapiConfig } = await supabase
      .from("zapi_config")
      .select("*")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (!zapiConfig) return;

    const url = `https://api.z-api.io/instances/${zapiConfig.instance_id}/token/${zapiConfig.token}/send-image`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (zapiConfig.client_token) headers["Client-Token"] = zapiConfig.client_token;

    await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        phone: phone.replace(/\D/g, ""),
        image: base64Image,
        caption,
      }),
    });
  } catch (e) {
    console.error("Error sending WhatsApp image:", e);
  }
}

// ─── COMMAND: Print do Quadro ─────────────────────────────
async function handlePrintQuadro(supabase: any, requesterProfile: any, allProfiles: any[], args: any, isAdmin: boolean, phone: string, _lovableApiKey: string) {
  const { nome_usuario, nome_quadro } = args;

  let targetProfile = requesterProfile;

  if (nome_usuario) {
    const found = findProfileByName(allProfiles, nome_usuario);
    if (!found) {
      await sendWhatsApp(supabase, phone, `❌ Nenhum usuário encontrado com o nome "${nome_usuario}".`);
      return;
    }
    if (found.user_id !== requesterProfile.user_id) {
      if (isAdmin) {
        targetProfile = found;
      } else {
        const { data: requesterAdminTeams } = await supabase
          .from("team_members")
          .select("team_id")
          .eq("user_id", requesterProfile.user_id)
          .eq("role", "admin");
        const adminTeamIds = (requesterAdminTeams || []).map((t: any) => t.team_id);
        if (adminTeamIds.length === 0) {
          await sendWhatsApp(supabase, phone, "🔒 Você não tem permissão para ver quadros de outros usuários.");
          return;
        }
        const { data: targetMemberships } = await supabase
          .from("team_members")
          .select("team_id")
          .eq("user_id", found.user_id)
          .in("team_id", adminTeamIds);
        if (!targetMemberships || targetMemberships.length === 0) {
          await sendWhatsApp(supabase, phone, "🔒 Você só pode ver quadros de usuários das equipes que você gerencia.");
          return;
        }
        targetProfile = found;
      }
    }
  }

  let boardQuery = supabase
    .from("boards")
    .select("id, name, description, board_columns(id, name, position, tasks(id, title, priority, due_date, assignee_id))")
    .or(`assigned_user_id.eq.${targetProfile.user_id},created_by.eq.${targetProfile.user_id}`);
  if (nome_quadro) {
    boardQuery = boardQuery.ilike("name", `%${nome_quadro}%`);
  }
  const { data: boards } = await boardQuery.limit(1);

  if (!boards || boards.length === 0) {
    await sendWhatsApp(supabase, phone, `❌ Nenhum quadro encontrado${nome_quadro ? ` com o nome "${nome_quadro}"` : ""}.`);
    return;
  }

  const board = boards[0];
  const sortedColumns = (board.board_columns || []).sort((a: any, b: any) => a.position - b.position);
  sortedColumns.forEach((col: any) => {
    if (col.tasks) col.tasks.sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));
  });

  const assigneeIds = new Set<string>();
  sortedColumns.forEach((col: any) => {
    (col.tasks || []).forEach((t: any) => { if (t.assignee_id) assigneeIds.add(t.assignee_id); });
  });
  const assigneeMap = new Map<string, string>();
  allProfiles.forEach((p: any) => { if (assigneeIds.has(p.user_id)) assigneeMap.set(p.user_id, p.name); });


  await sendWhatsApp(supabase, phone, buildTextBoardPrint(board, sortedColumns, assigneeMap));
}

function buildTextBoardPrint(board: any, columns: any[], assigneeMap: Map<string, string>): string {
  const priorityEmoji: Record<string, string> = { low: "🟢", medium: "🟡", high: "🟠", urgent: "🔴" };
  let msg = `📋 *${board.name}*\n`;
  if (board.description) msg += `${board.description}\n`;
  msg += `━━━━━━━━━━━━━━━━\n\n`;
  columns.forEach((col: any) => {
    const tasks = col.tasks || [];
    msg += `📌 *${col.name}* (${tasks.length})\n`;
    if (tasks.length === 0) {
      msg += `  _vazio_\n`;
    } else {
      tasks.forEach((t: any) => {
        const emoji = priorityEmoji[t.priority] || "⚪";
        const assignee = t.assignee_id ? assigneeMap.get(t.assignee_id) : null;
        const due = t.due_date ? ` 📅${new Date(t.due_date).toLocaleDateString("pt-BR")}` : "";
        msg += `  ${emoji} ${t.title}${assignee ? ` @${assignee}` : ""}${due}\n`;
      });
    }
    msg += `\n`;
  });
  return msg.trim();
}

// ─── COMMAND: Ajuda ────────────────────────────────────────
function handleAjuda(userName: string, isAdmin: boolean = false) {
  let msg = `👋 Olá, ${userName}! Sou o *TaskFox Bot*.\n\n` +
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
    `  • "Meu resumo da semana"\n` +
    `  • "Resumo do mês"\n\n` +
    `🖼️ *Print do Quadro:*\n` +
    `  • "Print do meu quadro"\n` +
    `  • "Foto do quadro"\n` +
    `  • "Imagem do quadro [nome]"\n`;

  if (isAdmin) {
     msg += `\n🔑 *Comandos de Admin:*\n` +
      `  • "Tarefas do João"\n` +
      `  • "Quadro da Maria"\n` +
      `  • "Tarefas atrasadas do Pedro"\n` +
      `  • "Tarefas diárias da Ana"\n` +
      `  • "Resumo da semana do Carlos"\n` +
      `  • "Print do quadro do João"\n`;
  } else {
    msg += `\n👥 *Gestor de equipe:*\n` +
      `  • "Resumo do dia do [nome]" (membros da sua equipe)\n` +
      `  • "Print do quadro do [nome]"\n`;
  }

  msg += `\nBasta digitar normalmente que eu entendo! 🚀`;
  return msg;
}
