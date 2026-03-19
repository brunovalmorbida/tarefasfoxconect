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
      description: "Cria uma nova tarefa no quadro Kanban. Pode ser no quadro do próprio usuário ou de outro (se admin/gestor). Extraia prazo, horário e responsável da mensagem quando informados.",
      parameters: {
        type: "object",
        properties: {
          titulo: { type: "string", description: "Título da tarefa" },
          descricao: { type: "string", description: "Descrição da tarefa" },
          prioridade: { type: "string", enum: ["low", "medium", "high", "urgent"], description: "Prioridade da tarefa" },
          prazo: { type: "string", description: "Data do prazo em formato YYYY-MM-DD. Interprete: 'hoje'=data atual, 'amanhã'=+1 dia, 'sexta'=próxima sexta, 'dia 10'=dia 10 do mês atual/próximo, etc." },
          horario: { type: "string", description: "Horário agendado no formato HH:MM (24h). Ex: 'às 14h'='14:00', 'meio-dia'='12:00', '9h30'='09:30'" },
          nome_responsavel: { type: "string", description: "Nome (ou parte) do responsável/dono do quadro onde criar a tarefa. Se não informado, cria no quadro do próprio usuário." },
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
      description: "Lista as tarefas pendentes do usuário. Mostra tarefas do quadro Kanban (não concluídas) e tarefas fixas/recorrentes (não feitas no período). Pode filtrar por 'hoje', 'semana', 'mes', 'atrasadas', 'fixas' (só recorrentes), 'kanban' (só quadro), ou 'todas' (tudo pendente).",
      parameters: {
        type: "object",
        properties: {
          filtro: { type: "string", enum: ["todas", "hoje", "semana", "mes", "atrasadas", "fixas", "kanban", "pendentes", "concluidas"], description: "Filtro: 'hoje' mostra tarefas kanban com prazo hoje + fixas do dia; 'semana' mostra kanban com prazo na semana + fixas da semana; 'mes' similar; 'fixas' só recorrentes pendentes; 'kanban' só quadro; 'atrasadas' só atrasadas; 'todas'/'pendentes' tudo pendente" },
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
      description: "Marca uma tarefa do Kanban como concluída movendo-a para a última coluna do quadro",
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
      name: "concluir_tarefa_fixa",
      description: "Marca uma tarefa fixa/recorrente/diária como concluída para o período atual (hoje). Use quando o usuário disser 'feita', 'concluída', 'pronta' referindo-se a uma tarefa fixa/diária/recorrente.",
      parameters: {
        type: "object",
        properties: {
          titulo_parcial: { type: "string", description: "Parte do título da tarefa fixa para buscar" },
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
A data de hoje é ${new Date().toISOString().split("T")[0]}.

Exemplos:
- "Criar tarefa revisar relatório para amanhã" → criar_tarefa (titulo, prazo=amanhã)
- "Criar tarefa reunião às 14h para o dia 28" → criar_tarefa (titulo, horario="14:00", prazo="2024-02-28")
- "Criar tarefa X para o Leonardo" → criar_tarefa (titulo, nome_responsavel="Leonardo")
- "Tarefa urgente ligar pro cliente amanhã 9h" → criar_tarefa (titulo, prioridade="urgent", prazo=amanhã, horario="09:00")
- "Preciso comprar 5 resmas de papel e 2 toners" → criar_lista_compras  
- "Quais minhas tarefas?" → listar_tarefas (filtro: "todas")
- "Tarefas de hoje" → listar_tarefas (filtro: "hoje")
- "Tarefas da semana" → listar_tarefas (filtro: "semana")
- "Tarefas do mês" → listar_tarefas (filtro: "mes")
- "Tarefas fixas pendentes" → listar_tarefas (filtro: "fixas")
- "Tarefas atrasadas" → listar_tarefas (filtro: "atrasadas")
- "O que falta fazer?" → listar_tarefas (filtro: "hoje")
- "Concluir tarefa relatório" → concluir_tarefa (tarefa kanban)
- "Feita tarefa limpeza" ou "Concluir diária limpeza" → concluir_tarefa_fixa (tarefa fixa/recorrente)
- "Tarefa fixa feita: organizar estoque" → concluir_tarefa_fixa
- "Já fiz a tarefa X" (se X é uma tarefa fixa do contexto) → concluir_tarefa_fixa
- Se o usuário responder "feita" ou "pronta" após receber notificação de tarefa fixa atrasada → concluir_tarefa_fixa
- "Como tá meu dia?" → resumo_dia
- "Meu resumo da semana" → resumo_completo (periodo: "semana")
- "Resumo do dia do João" → resumo_completo (periodo: "dia", nome_usuario: "João")
- "Tarefas do João" → tarefas_usuario (nome "João")
- "Tarefas diárias da Maria" → tarefas_diarias_usuario (nome "Maria")
- "O que posso fazer?" → ajuda

Regras:
- Sempre execute UMA ferramenta por mensagem
- Se não entender, use ajuda
- Para prioridade, infira do contexto (urgente, importante = high; normal = medium; pode esperar = low)
- Para criar_tarefa: SEMPRE tente extrair o prazo (prazo) e a descrição (descricao) da mensagem. Converta datas relativas para YYYY-MM-DD baseado na data de hoje
- A descrição é OBRIGATÓRIA para criar_tarefa. Se o usuário não informar a descrição, ainda assim chame criar_tarefa com os dados disponíveis (o sistema vai pedir a descrição automaticamente)
- Se o usuário mencionar um horário (ex: "às 14h", "9:30"), extraia como horario em formato HH:MM
- Se o usuário mencionar outra pessoa (ex: "para o João", "no quadro da Maria"), coloque em nome_responsavel
- Para lista de compras, extraia itens e quantidades. Quantidade padrão é 1
- Quando pedir resumo com período, use resumo_completo
- "tarefas diárias", "rotina", "tarefas fixas" de alguém → tarefas_diarias_usuario
- "tarefas", "quadro" de alguém → tarefas_usuario
- IMPORTANTE: Diferencie entre tarefas do Kanban e tarefas fixas/recorrentes/diárias:
  - "concluir tarefa X" (sem qualificação) → concluir_tarefa (Kanban)
  - "feita tarefa fixa X", "concluir diária X", "tarefa fixa feita X" → concluir_tarefa_fixa
  - Se no histórico recente há notificação de tarefa fixa atrasada e o usuário responde "feita" ou "pronta" com nome de tarefa → concluir_tarefa_fixa
- IMPORTANTE: Você tem acesso ao histórico recente da conversa. Se a mensagem do usuário parece ser uma RESPOSTA a uma pergunta anterior (ex: um nome, uma data, um número de quadro, uma descrição), use o contexto da conversa para completar o comando original. NÃO trate como um novo comando.
- Exemplo: Se você pediu o prazo e o usuário responde "amanhã" → complete o criar_tarefa com o prazo
- Exemplo: Se você pediu a descrição e o usuário responde "Reunião sobre o projeto X" → complete o criar_tarefa com a descrição
- Exemplo: Se houve erro de nome e o usuário corrige com "Leonardo Graeff" → complete o criar_tarefa com o nome correto
- Se a mensagem é curta e parece uma correção/complemento (nome, data, hora, descrição), olhe o histórico para entender o contexto`;

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
    const imageUrl = body.image?.imageUrl || null;
    const imageCaption = body.image?.caption || "";

    // Allow either text or image messages
    if (!phone || (!messageText && !imageUrl)) {
      return new Response(JSON.stringify({ ok: true, skipped: "no message" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
      });
    }

    // Ignore group messages
    if (body.isGroup) {
      return new Response(JSON.stringify({ ok: true, skipped: "group message" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Deduplication: ignore duplicate webhooks from Z-API ───
    const messageId = body.messageId || body.id?.id || body.ids?.[0]?.id || null;
    if (messageId) {
      const cleanPhoneDedup = phone.replace(/\D/g, "");
      const { data: existingMsg } = await supabase
        .from("whatsapp_chat_history")
        .select("id")
        .eq("phone", cleanPhoneDedup)
        .eq("content", messageText)
        .eq("role", "user")
        .gte("created_at", new Date(Date.now() - 30 * 1000).toISOString())
        .limit(1);
      if (existingMsg && existingMsg.length > 0) {
        console.log("Duplicate webhook detected, skipping. messageId:", messageId);
        return new Response(JSON.stringify({ ok: true, skipped: "duplicate" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const cleanPhone = phone.replace(/\D/g, "");
    console.log("Received phone raw:", phone, "| cleaned:", cleanPhone);

    // Find user by WhatsApp number - try multiple matching strategies
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, name, whatsapp_number");

    console.log("Profiles found:", (profiles || []).map((p: any) => ({ name: p.name, wn: p.whatsapp_number })));

    // Helper: extract DDD + subscriber from a Brazilian number (handles country code and nono dígito)
    const extractBrNumber = (num: string) => {
      let n = num;
      // Remove country code 55 if present
      if (n.length >= 12 && n.startsWith("55")) n = n.slice(2);
      // Now n should be DDD (2 digits) + subscriber (8 or 9 digits)
      if (n.length === 11) {
        // Has nono dígito: DDD(2) + 9 + 8 digits
        return { ddd: n.slice(0, 2), subscriber: n.slice(3) }; // 8-digit core
      } else if (n.length === 10) {
        // No nono dígito: DDD(2) + 8 digits
        return { ddd: n.slice(0, 2), subscriber: n.slice(2) }; // 8-digit core
      }
      return { ddd: "", subscriber: n.slice(-8) }; // fallback: last 8
    };

    const userProfile = (profiles || []).find((p: any) => {
      if (!p.whatsapp_number) return false;
      const storedClean = p.whatsapp_number.replace(/\D/g, "");
      // Exact match
      if (storedClean === cleanPhone) return true;
      // Suffix match
      if (cleanPhone.endsWith(storedClean) || storedClean.endsWith(cleanPhone)) return true;
      // Brazilian DDD + 8-digit core match (handles nono dígito difference)
      const stored = extractBrNumber(storedClean);
      const incoming = extractBrNumber(cleanPhone);
      if (stored.ddd === incoming.ddd && stored.subscriber === incoming.subscriber && stored.subscriber.length === 8) return true;
      // Last 8 fallback
      const last8stored = storedClean.slice(-8);
      const last8incoming = cleanPhone.slice(-8);
      if (last8stored === last8incoming && storedClean.length >= 10 && cleanPhone.length >= 10) return true;
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

    // ─── Fetch conversation history (last 10 messages within 30 min) ───
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: chatHistory } = await supabase
      .from("whatsapp_chat_history")
      .select("role, content, tool_name, tool_args")
      .eq("phone", cleanPhone)
      .gte("created_at", thirtyMinAgo)
      .order("created_at", { ascending: true })
      .limit(10);

    // Build conversation messages from history
    const historyMessages: any[] = [];
    for (const msg of (chatHistory || [])) {
      if (msg.role === "user") {
        historyMessages.push({ role: "user", content: msg.content });
      } else if (msg.role === "assistant") {
        if (msg.tool_name && msg.tool_args) {
          // Reconstruct the assistant tool call + tool result so the AI has context
          historyMessages.push({
            role: "assistant",
            content: null,
            tool_calls: [{
              id: "hist_" + Math.random().toString(36).slice(2, 8),
              type: "function",
              function: { name: msg.tool_name, arguments: JSON.stringify(msg.tool_args) },
            }],
          });
          historyMessages.push({
            role: "tool",
            tool_call_id: historyMessages[historyMessages.length - 1].tool_calls[0].id,
            content: msg.content,
          });
        } else {
          historyMessages.push({ role: "assistant", content: msg.content });
        }
      }
    }

    // Save current user message to history
    await supabase.from("whatsapp_chat_history").insert({
      user_id: userProfile.user_id,
      phone: cleanPhone,
      role: "user",
      content: messageText,
    });

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
          ...historyMessages,
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
        responseMessage = await handleCriarTarefa(supabase, userProfile, args, isAdmin, profiles || []);
        break;
      case "listar_tarefas":
        responseMessage = await handleListarTarefas(supabase, userProfile, args);
        break;
      case "concluir_tarefa":
        responseMessage = await handleConcluirTarefa(supabase, userProfile, args);
        break;
      case "concluir_tarefa_fixa":
        responseMessage = await handleConcluirTarefaFixa(supabase, userProfile, args);
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
      case "ajuda":
        responseMessage = handleAjuda(userProfile.name, isAdmin);
        break;
      default:
        responseMessage = "🤔 Comando não reconhecido. Envie *ajuda* para ver os comandos disponíveis.";
    }

    if (responseMessage) {
      await sendWhatsApp(supabase, cleanPhone, responseMessage);

      // Save assistant response to conversation history
      await supabase.from("whatsapp_chat_history").insert({
        user_id: userProfile.user_id,
        phone: cleanPhone,
        role: "assistant",
        content: responseMessage,
        tool_name: functionName,
        tool_args: args,
      });
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
async function handleCriarTarefa(supabase: any, profile: any, args: any, isAdmin: boolean, allProfiles: any[]) {
  const { titulo, descricao, prioridade, prazo, horario, nome_responsavel } = args;

  // Determine target user (whose board to create in)
  let targetProfile = profile;
  let targetBoard: any = null;

  if (nome_responsavel) {
    // Check permissions: only admin or team admin of the target's team
    if (!isAdmin) {
      // Check if user is team admin for any team the target is in
      const targetFound = findProfileByName(allProfiles, nome_responsavel);
      if (!targetFound) {
        return `❌ Não encontrei nenhum usuário com o nome "${nome_responsavel}".`;
      }
      // Check if sender is team admin for any common team
      const { data: senderTeams } = await supabase
        .from("team_members")
        .select("team_id, role")
        .eq("user_id", profile.user_id);
      const { data: targetTeams } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", targetFound.user_id);
      const senderAdminTeams = (senderTeams || []).filter((t: any) => t.role === "admin").map((t: any) => t.team_id);
      const targetTeamIds = (targetTeams || []).map((t: any) => t.team_id);
      const canManage = senderAdminTeams.some((tid: string) => targetTeamIds.includes(tid));
      if (!canManage) {
        return `🔒 Você não tem permissão para criar tarefas no quadro de ${targetFound.name}. Apenas administradores ou gestores da equipe podem fazer isso.`;
      }
      targetProfile = targetFound;
    } else {
      const targetFound = findProfileByName(allProfiles, nome_responsavel);
      if (!targetFound) {
        return `❌ Não encontrei nenhum usuário com o nome "${nome_responsavel}".`;
      }
      targetProfile = targetFound;
    }
  }

  // Find the target's board
  const { data: boards } = await supabase
    .from("boards")
    .select("id, name")
    .or(`assigned_user_id.eq.${targetProfile.user_id},created_by.eq.${targetProfile.user_id}`);

  if (!boards || boards.length === 0) {
    return `❌ ${targetProfile.user_id === profile.user_id ? "Você não tem" : targetProfile.name + " não tem"} nenhum quadro Kanban disponível.`;
  }

  // If multiple boards, pick the one assigned to the user first
  if (boards.length === 1) {
    targetBoard = boards[0];
  } else {
    // Prefer the assigned board
    const { data: assignedBoards } = await supabase
      .from("boards")
      .select("id, name")
      .eq("assigned_user_id", targetProfile.user_id);
    if (assignedBoards && assignedBoards.length === 1) {
      targetBoard = assignedBoards[0];
    } else if (assignedBoards && assignedBoards.length > 1) {
      // Multiple assigned boards - list them and ask
      const boardList = assignedBoards.map((b: any, i: number) => `${i + 1}. ${b.name}`).join("\n");
      return `📋 ${targetProfile.name} tem múltiplos quadros. Em qual deseja criar a tarefa?\n\n${boardList}\n\n_Responda com: "criar tarefa ${titulo} no quadro [nome]"_`;
    } else {
      targetBoard = boards[0];
    }
  }

  // Get first column
  const { data: columns } = await supabase
    .from("board_columns")
    .select("id, name")
    .eq("board_id", targetBoard.id)
    .order("position", { ascending: true })
    .limit(1);

  if (!columns || columns.length === 0) {
    return "❌ O quadro não tem colunas. Peça ao administrador para configurá-lo.";
  }

  // Validate prazo
  let dueDate: string | null = null;
  if (prazo) {
    const parsed = new Date(prazo + "T18:00:00-03:00"); // End of business day BRT
    if (isNaN(parsed.getTime())) {
      return `❌ Não consegui entender a data "${prazo}". Use formatos como "amanhã", "sexta", "dia 28" ou "2024-03-15".`;
    }
    // Don't allow past dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const parsedDate = new Date(prazo);
    parsedDate.setHours(0, 0, 0, 0);
    if (parsedDate < today) {
      return `❌ O prazo não pode ser uma data no passado. Informe uma data a partir de hoje.`;
    }
    dueDate = parsed.toISOString();
  }

  // Validate horario
  let scheduledTime: string | null = null;
  if (horario) {
    const timeMatch = horario.match(/^(\d{1,2}):(\d{2})$/);
    if (!timeMatch) {
      return `❌ Não consegui entender o horário "${horario}". Use formato como "14:00" ou "09:30".`;
    }
    scheduledTime = horario;
  }

  // If no prazo provided, ask for it
  if (!dueDate) {
    let msg = `⚠️ *Prazo obrigatório!*\n\nPara criar a tarefa *"${titulo}"*`;
    if (targetProfile.user_id !== profile.user_id) msg += ` no quadro de *${targetProfile.name}*`;
    msg += `, informe o prazo.\n\n_Responda com: "criar tarefa ${titulo} para [data]"_\n_Ex: "para amanhã", "para sexta", "para dia 28"_`;
    return msg;
  }

  // If no description provided, ask for it
  if (!descricao || !descricao.trim()) {
    let msg = `⚠️ *Descrição obrigatória!*\n\nPara criar a tarefa *"${titulo}"*`;
    if (targetProfile.user_id !== profile.user_id) msg += ` no quadro de *${targetProfile.name}*`;
    msg += `, informe uma descrição.\n\n_Responda com a descrição da tarefa._`;
    return msg;
  }

  // Get next position
  const { data: existingTasks } = await supabase
    .from("tasks")
    .select("position")
    .eq("column_id", columns[0].id)
    .order("position", { ascending: false })
    .limit(1);

  const nextPosition = (existingTasks?.[0]?.position ?? -1) + 1;

  // Create the task
  const taskData: any = {
    title: titulo,
    description: descricao || null,
    priority: prioridade || "medium",
    column_id: columns[0].id,
    created_by: profile.user_id,
    assignee_id: targetProfile.user_id,
    position: nextPosition,
    due_date: dueDate,
  };
  if (scheduledTime) taskData.scheduled_time = scheduledTime;

  const { error } = await supabase.from("tasks").insert(taskData);

  if (error) {
    console.error("Error creating task:", error);
    return `❌ Erro ao criar tarefa: ${error.message}`;
  }

  const priorityLabels: Record<string, string> = { low: "🟢 Baixa", medium: "🟡 Média", high: "🟠 Alta", urgent: "🔴 Urgente" };
  const formattedDate = new Date(dueDate!).toLocaleDateString("pt-BR");

  let response = `✅ *Tarefa criada com sucesso!*\n\n` +
    `📋 *Título:* ${titulo}\n` +
    (descricao ? `📝 *Descrição:* ${descricao}\n` : "") +
    `🔥 *Prioridade:* ${priorityLabels[prioridade || "medium"]}\n` +
    `📅 *Prazo:* ${formattedDate}\n` +
    (scheduledTime ? `⏰ *Horário:* ${scheduledTime}\n` : "") +
    `📊 *Quadro:* ${targetBoard.name}\n` +
    `📂 *Coluna:* ${columns[0].name}`;

  if (targetProfile.user_id !== profile.user_id) {
    response += `\n👤 *Responsável:* ${targetProfile.name}`;
  }

  // Send notification to target if different from creator
  if (targetProfile.user_id !== profile.user_id) {
    await supabase.from("notifications").insert({
      user_id: targetProfile.user_id,
      title: "Nova tarefa criada",
      message: `A tarefa "${titulo}" foi atribuída a você no quadro ${targetBoard.name}.`,
      link: "/boards",
    });

    // Also send WhatsApp notification to assignee
    if (targetProfile.whatsapp_number) {
      const notifMsg = `📋 *Nova Tarefa Atribuída*\n\n` +
        `Olá ${targetProfile.name}, uma nova tarefa foi criada para você por ${profile.name}:\n\n` +
        `📋 *Tarefa:* ${titulo}\n` +
        (descricao ? `📝 *Descrição:* ${descricao}\n` : "") +
        `📅 *Prazo:* ${formattedDate}\n` +
        (scheduledTime ? `⏰ *Horário:* ${scheduledTime}\n` : "") +
        `📊 *Quadro:* ${targetBoard.name}`;
      await sendWhatsApp(supabase, targetProfile.whatsapp_number.replace(/\D/g, ""), notifMsg);
    }
  }

  return response;
}

// ─── COMMAND: Listar Tarefas ───────────────────────────────
async function handleListarTarefas(supabase: any, profile: any, args: any) {
  const { filtro } = args;
  const now = new Date();
  const brtOffset = -3 * 60;
  const brtNow = new Date(now.getTime() + (brtOffset + now.getTimezoneOffset()) * 60000);
  const todayStr = `${brtNow.getFullYear()}-${String(brtNow.getMonth() + 1).padStart(2, "0")}-${String(brtNow.getDate()).padStart(2, "0")}`;

  const showKanban = !["fixas"].includes(filtro);
  const showRecurring = !["kanban", "concluidas"].includes(filtro);

  let msg = "";

  // ── KANBAN TASKS ──
  if (showKanban) {
    const { data: allTasks } = await supabase
      .from("tasks")
      .select("id, title, priority, due_date, column_id, scheduled_time")
      .eq("assignee_id", profile.user_id);

    const tasks = allTasks || [];

    // Get column info to identify done columns
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
    const colMap = new Map(columns.map((c: any) => [c.id, c.name]));

    // Get board names
    const boardIds = [...new Set(columns.map((c: any) => c.board_id))];
    let boardMap = new Map<string, string>();
    if (boardIds.length > 0) {
      const { data: boards } = await supabase.from("boards").select("id, name").in("id", boardIds);
      boardMap = new Map((boards || []).map((b: any) => [b.id, b.name]));
    }
    const colBoardMap = new Map(columns.map((c: any) => [c.id, c.board_id]));

    let filteredTasks: any[] = [];
    const priorityEmoji: Record<string, string> = { low: "🟢", medium: "🟡", high: "🟠", urgent: "🔴" };

    if (filtro === "concluidas") {
      filteredTasks = tasks.filter((t: any) => doneColumnIds.has(t.column_id));
    } else if (filtro === "atrasadas") {
      filteredTasks = tasks.filter((t: any) => t.due_date && new Date(t.due_date) < now && !doneColumnIds.has(t.column_id));
    } else {
      // All pending (not done)
      filteredTasks = tasks.filter((t: any) => !doneColumnIds.has(t.column_id));
    }

    // Determine date range emphasis
    let emphasisStart: Date | null = null;
    let emphasisEnd: Date | null = null;
    let emphasisLabel = "";

    if (filtro === "hoje") {
      emphasisStart = new Date(brtNow); emphasisStart.setHours(0,0,0,0);
      emphasisEnd = new Date(brtNow); emphasisEnd.setHours(23,59,59,999);
      emphasisLabel = "hoje";
    } else if (filtro === "semana") {
      const day = brtNow.getDay();
      const diff = day === 0 ? 6 : day - 1;
      emphasisStart = new Date(brtNow); emphasisStart.setDate(brtNow.getDate() - diff); emphasisStart.setHours(0,0,0,0);
      emphasisEnd = new Date(emphasisStart); emphasisEnd.setDate(emphasisStart.getDate() + 6); emphasisEnd.setHours(23,59,59,999);
      emphasisLabel = "esta semana";
    } else if (filtro === "mes") {
      emphasisStart = new Date(brtNow.getFullYear(), brtNow.getMonth(), 1);
      emphasisEnd = new Date(brtNow.getFullYear(), brtNow.getMonth() + 1, 0, 23, 59, 59, 999);
      emphasisLabel = "este mês";
    }

    // Sort: tasks with due date in emphasis period first, then overdue, then rest
    filteredTasks.sort((a: any, b: any) => {
      const aDate = a.due_date ? new Date(a.due_date) : null;
      const bDate = b.due_date ? new Date(b.due_date) : null;
      const aInEmphasis = emphasisStart && aDate && aDate >= emphasisStart && aDate <= emphasisEnd! ? 1 : 0;
      const bInEmphasis = emphasisStart && bDate && bDate >= emphasisStart && bDate <= emphasisEnd! ? 1 : 0;
      if (aInEmphasis !== bInEmphasis) return bInEmphasis - aInEmphasis;
      const aOverdue = aDate && aDate < now ? 1 : 0;
      const bOverdue = bDate && bDate < now ? 1 : 0;
      if (aOverdue !== bOverdue) return bOverdue - aOverdue;
      if (aDate && bDate) return aDate.getTime() - bDate.getTime();
      return 0;
    });

    if (filteredTasks.length > 0) {
      const filtroTitles: Record<string, string> = {
        todas: "Tarefas Pendentes (Kanban)",
        hoje: "Tarefas Kanban",
        semana: "Tarefas Kanban",
        mes: "Tarefas Kanban",
        atrasadas: "Tarefas Atrasadas (Kanban)",
        kanban: "Tarefas Pendentes (Kanban)",
        pendentes: "Tarefas Pendentes (Kanban)",
        concluidas: "Tarefas Concluídas (Kanban)",
      };

      msg += `📋 *${filtroTitles[filtro] || "Tarefas Kanban"}*\n`;
      if (emphasisLabel) msg += `📌 _Ênfase: prazo ${emphasisLabel}_\n`;
      msg += `\n`;

      // Separate emphasized tasks
      const emphasizedTasks = emphasisStart
        ? filteredTasks.filter((t: any) => {
            if (!t.due_date) return false;
            const d = new Date(t.due_date);
            return d >= emphasisStart! && d <= emphasisEnd!;
          })
        : [];
      const otherTasks = emphasisStart
        ? filteredTasks.filter((t: any) => {
            if (!t.due_date) return true;
            const d = new Date(t.due_date);
            return d < emphasisStart! || d > emphasisEnd!;
          })
        : filteredTasks;

      if (emphasizedTasks.length > 0) {
        const periodEmoji = filtro === "hoje" ? "🔴" : "⚡";
        msg += `${periodEmoji} *Prazo ${emphasisLabel} (${emphasizedTasks.length}):*\n`;
        emphasizedTasks.slice(0, 10).forEach((t: any, i: number) => {
          const emoji = priorityEmoji[t.priority] || "⚪";
          const boardName = boardMap.get(colBoardMap.get(t.column_id) || "") || "";
          const dueStr = t.due_date ? new Date(t.due_date).toLocaleDateString("pt-BR") : "";
          const timeStr = t.scheduled_time ? ` ⏰${t.scheduled_time.slice(0,5)}` : "";
          const isOverdue = t.due_date && new Date(t.due_date) < now ? " ⚠️" : "";
          msg += `  ${i + 1}. ${emoji} *${t.title}*${isOverdue}\n     📊 ${boardName} | 📅 ${dueStr}${timeStr}\n`;
        });
        msg += `\n`;
      }

      if (otherTasks.length > 0 && filtro !== "atrasadas") {
        if (emphasizedTasks.length > 0) msg += `📋 *Outras pendentes (${otherTasks.length}):*\n`;
        otherTasks.slice(0, 10).forEach((t: any, i: number) => {
          const emoji = priorityEmoji[t.priority] || "⚪";
          const boardName = boardMap.get(colBoardMap.get(t.column_id) || "") || "";
          const dueStr = t.due_date ? ` | 📅 ${new Date(t.due_date).toLocaleDateString("pt-BR")}` : "";
          const isOverdue = t.due_date && new Date(t.due_date) < now ? " ⚠️" : "";
          msg += `  ${i + 1}. ${emoji} ${t.title}${isOverdue}\n     📊 ${boardName}${dueStr}\n`;
        });
        if (otherTasks.length > 10) msg += `  ... e mais ${otherTasks.length - 10}\n`;
        msg += `\n`;
      }
    } else {
      if (filtro === "concluidas") {
        msg += `📋 Nenhuma tarefa concluída no quadro Kanban.\n\n`;
      } else if (filtro === "atrasadas") {
        msg += `✅ Nenhuma tarefa atrasada no Kanban! 🎉\n\n`;
      } else {
        msg += `✅ Nenhuma tarefa pendente no Kanban! 🎉\n\n`;
      }
    }
  }

  // ── RECURRING TASKS ──
  if (showRecurring) {
    // Get boards assigned to user
    const { data: recBoards } = await supabase
      .from("recurring_task_boards")
      .select("id, name, assigned_user_id, frequency_type, weekday")
      .or(`assigned_user_id.eq.${profile.user_id},assigned_user_id.is.null`);

    const boards = recBoards || [];
    const boardIds = boards.map((b: any) => b.id);

    if (boardIds.length > 0) {
      const { data: recTasks } = await supabase
        .from("recurring_tasks")
        .select("id, title, frequency, weekday, month_day, board_id, scheduled_time")
        .in("board_id", boardIds)
        .order("position");

      const allRecTasks = recTasks || [];

      // Get completions
      const recTaskIds = allRecTasks.map((t: any) => t.id);
      let completions: any[] = [];
      if (recTaskIds.length > 0) {
        // For period filtering, get completions in a range
        const jsDay = brtNow.getDay();
        let periodStartStr = todayStr;
        if (filtro === "semana") {
          const diff = jsDay === 0 ? 6 : jsDay - 1;
          const weekStart = new Date(brtNow);
          weekStart.setDate(brtNow.getDate() - diff);
          periodStartStr = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, "0")}-${String(weekStart.getDate()).padStart(2, "0")}`;
        } else if (filtro === "mes") {
          periodStartStr = `${brtNow.getFullYear()}-${String(brtNow.getMonth() + 1).padStart(2, "0")}-01`;
        }

        const { data } = await supabase
          .from("recurring_task_completions")
          .select("recurring_task_id, period_start")
          .in("recurring_task_id", recTaskIds)
          .gte("period_start", periodStartStr)
          .lte("period_start", todayStr);
        completions = data || [];
      }

      const completedSet = new Set(completions.map((c: any) => `${c.recurring_task_id}_${c.period_start}`));

      // Filter active tasks for today
      const jsDay = brtNow.getDay();
      const ourDay = jsDay === 0 ? 6 : jsDay - 1;

      const activeTodayTasks = allRecTasks.filter((t: any) => {
        if (jsDay === 0) return false; // Sunday off
        if (t.frequency === "daily") return true;
        if (t.frequency === "weekday" && t.weekday !== null) return ourDay === t.weekday;
        if (t.frequency === "monthly" && t.month_day !== null) return brtNow.getDate() === t.month_day;
        if (t.frequency === "weekly") return true;
        return false;
      });

      // Find pending (not completed today)
      const pendingToday = activeTodayTasks.filter((t: any) => !completedSet.has(`${t.id}_${todayStr}`));
      const doneToday = activeTodayTasks.filter((t: any) => completedSet.has(`${t.id}_${todayStr}`));

      const boardNameMap = new Map(boards.map((b: any) => [b.id, b.name]));

      const showAll = ["todas", "pendentes", "fixas"].includes(filtro);
      const showToday = filtro === "hoje" || showAll;
      const showWeek = filtro === "semana";
      const showMonth = filtro === "mes";

      if (showToday && activeTodayTasks.length > 0) {
        const progress = activeTodayTasks.length > 0 ? Math.round((doneToday.length / activeTodayTasks.length) * 100) : 0;
        let pEmoji = "🔴";
        if (progress >= 80) pEmoji = "🟢";
        else if (progress >= 50) pEmoji = "🟡";

        msg += `🔄 *Tarefas Fixas - Hoje* ${pEmoji} ${progress}% (${doneToday.length}/${activeTodayTasks.length})\n\n`;

        if (pendingToday.length > 0) {
          msg += `⏳ *Pendentes (${pendingToday.length}):*\n`;
          pendingToday.forEach((t: any, i: number) => {
            const boardName = boardNameMap.get(t.board_id) || "";
            const timeStr = t.scheduled_time ? ` ⏰ ${t.scheduled_time.slice(0,5)}` : "";
            const isLate = t.scheduled_time && t.scheduled_time.slice(0,5) < `${String(brtNow.getHours()).padStart(2,"0")}:${String(brtNow.getMinutes()).padStart(2,"0")}`;
            msg += `  ${i + 1}. ${isLate ? "⚠️" : "⏳"} ${t.title}${timeStr}\n     📌 ${boardName}\n`;
          });
          msg += `\n`;
        }

        if (doneToday.length > 0) {
          msg += `✅ *Concluídas (${doneToday.length}):*\n`;
          doneToday.forEach((t: any, i: number) => {
            msg += `  ${i + 1}. ✅ ${t.title}\n`;
          });
          msg += `\n`;
        }
      } else if (showToday && activeTodayTasks.length === 0 && filtro === "fixas") {
        msg += `🔄 Sem tarefas fixas para hoje.\n\n`;
      }

      // Week/Month: show all tasks with completion status summary
      if (showWeek || showMonth) {
        const periodLabel = showWeek ? "Semana" : "Mês";
        const totalInPeriod = allRecTasks.length;
        const completionsInPeriod = completions.length;

        msg += `🔄 *Tarefas Fixas - ${periodLabel}*\n`;
        msg += `📈 Conclusões no período: ${completionsInPeriod}\n\n`;

        // Still show today's pending
        if (pendingToday.length > 0) {
          msg += `⏳ *Pendentes HOJE (${pendingToday.length}):*\n`;
          pendingToday.forEach((t: any, i: number) => {
            const boardName = boardNameMap.get(t.board_id) || "";
            const timeStr = t.scheduled_time ? ` ⏰ ${t.scheduled_time.slice(0,5)}` : "";
            msg += `  ${i + 1}. ⏳ ${t.title}${timeStr}\n     📌 ${boardName}\n`;
          });
          msg += `\n`;
        } else if (activeTodayTasks.length > 0) {
          msg += `✅ Todas as tarefas fixas de hoje concluídas! 🎉\n\n`;
        }
      }
    }
  }

  if (!msg.trim()) {
    return `📋 Sem tarefas encontradas para o filtro "${filtro}". Bom trabalho! 🎉`;
  }

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

// ─── COMMAND: Concluir Tarefa Fixa ─────────────────────────
async function handleConcluirTarefaFixa(supabase: any, profile: any, args: any) {
  const { titulo_parcial } = args;

  const now = new Date();
  const brtOffset = -3 * 60;
  const brtNow = new Date(now.getTime() + (brtOffset + now.getTimezoneOffset()) * 60000);
  const todayStr = `${brtNow.getFullYear()}-${String(brtNow.getMonth() + 1).padStart(2, "0")}-${String(brtNow.getDate()).padStart(2, "0")}`;
  const jsDay = brtNow.getDay();
  const ourDay = jsDay === 0 ? 6 : jsDay - 1;

  // Get boards assigned to this user
  const { data: recBoards } = await supabase
    .from("recurring_task_boards")
    .select("id, name, assigned_user_id")
    .or(`assigned_user_id.eq.${profile.user_id},assigned_user_id.is.null`);

  const boardIds = (recBoards || []).map((b: any) => b.id);
  if (boardIds.length === 0) {
    return `❌ Você não tem quadros de tarefas fixas atribuídos.`;
  }

  // Get recurring tasks matching the title
  const { data: recTasks } = await supabase
    .from("recurring_tasks")
    .select("id, title, frequency, weekday, month_day, board_id, team_id, scheduled_time")
    .in("board_id", boardIds)
    .ilike("title", `%${titulo_parcial}%`);

  if (!recTasks || recTasks.length === 0) {
    return `❌ Nenhuma tarefa fixa encontrada com "${titulo_parcial}". Verifique o nome e tente novamente.`;
  }

  // Filter to only tasks active today
  const activeTasks = recTasks.filter((t: any) => {
    if (jsDay === 0) return false;
    if (t.frequency === "daily") return true;
    if (t.frequency === "weekday" && t.weekday !== null) return ourDay === t.weekday;
    if (t.frequency === "monthly" && t.month_day !== null) return brtNow.getDate() === t.month_day;
    if (t.frequency === "weekly") return true;
    return false;
  });

  if (activeTasks.length === 0) {
    return `❌ A tarefa "${recTasks[0].title}" não está ativa hoje.`;
  }

  const task = activeTasks[0];

  // Determine period_start based on frequency
  let periodStart = todayStr;
  if (task.frequency === "weekly") {
    const diff = jsDay === 0 ? 6 : jsDay - 1;
    const weekStart = new Date(brtNow);
    weekStart.setDate(brtNow.getDate() - diff);
    periodStart = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, "0")}-${String(weekStart.getDate()).padStart(2, "0")}`;
  } else if (task.frequency === "monthly") {
    periodStart = `${brtNow.getFullYear()}-${String(brtNow.getMonth() + 1).padStart(2, "0")}-01`;
  }

  // Check if already completed
  const { data: existing } = await supabase
    .from("recurring_task_completions")
    .select("id")
    .eq("recurring_task_id", task.id)
    .eq("period_start", periodStart)
    .limit(1);

  if (existing && existing.length > 0) {
    return `✅ A tarefa *"${task.title}"* já foi marcada como concluída hoje!`;
  }

  // Mark as completed
  const { error } = await supabase
    .from("recurring_task_completions")
    .insert({
      recurring_task_id: task.id,
      completed_by: profile.user_id,
      period_start: periodStart,
    });

  if (error) {
    console.error("Error completing recurring task:", error);
    return `❌ Erro ao concluir tarefa fixa: ${error.message}`;
  }

  const boardName = (recBoards || []).find((b: any) => b.id === task.board_id)?.name || "";

  return `✅ *Tarefa fixa concluída!*\n\n` +
    `📋 *${task.title}*\n` +
    `📌 Quadro: *${boardName}*\n` +
    (task.scheduled_time ? `⏰ Horário previsto: ${task.scheduled_time.slice(0, 5)}\n` : "") +
    `\nÓtimo trabalho! 🎉`;
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
    `🔄 *Tarefas Fixas/Diárias:*\n` +
    `  • "Tarefas fixas pendentes"\n` +
    `  • "Feita tarefa limpeza" (marca como concluída)\n` +
    `  • "Concluir diária organizar estoque"\n\n` +
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
      `  • "Resumo da semana do Carlos"\n`;
  } else {
    msg += `\n👥 *Gestor de equipe:*\n` +
      `  • "Resumo do dia do [nome]" (membros da sua equipe)\n`;
  }

  msg += `\nBasta digitar normalmente que eu entendo! 🚀`;
  return msg;
}
