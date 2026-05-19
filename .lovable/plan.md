## Diagnóstico

**Bug crítico identificado** no `whatsapp-webhook` (linhas 308–340):
- O número do Bruno está cadastrado como `5499223558` (10 dígitos, **sem o 9 e sem código de país**).
- O número do Eliseu está como `5554993107017` (13 dígitos, formato completo).
- A função de matching usa **3 estratégias soltas em cascata**: igualdade exata, `endsWith` em ambos os lados, comparação de "últimos 8 dígitos" e extração de DDD+core. Como `endsWith` é frouxo e os números armazenados estão em formatos diferentes, a primeira coincidência parcial vence — o que produz falsos positivos (ex.: identificar a mensagem do Bruno como sendo do Eliseu).
- A raiz do problema é dupla: **(1)** matching não-determinístico e **(2)** ausência de normalização ao salvar o `whatsapp_number` no perfil.

Outros pontos da revisão (escopo definido pelas suas respostas: **WhatsApp + Cron + links clicáveis in-app**):
- Há **6 cron jobs ativos**; `notify-due-tasks-daily` e `notify-purchase-reminders-daily` rodam ambos às 12:00 UTC — ok, mas a verificação de horário comercial é feita em BRT dentro de cada função (cuidado com confusões UTC/BRT).
- Notificações in-app têm coluna `link` na tabela `notifications`, mas a UI (`Notifications.tsx`) **não usa esse campo** — clicar numa notificação não leva a lugar nenhum.
- Várias funções (`notify-*`) duplicam o mesmo bloco "horário comercial" — manutenção espalhada.

---

## Plano de melhorias

### 1. Corrigir identificação de telefone (prioridade máxima)

**a) Criar utilitário canônico de normalização BR** (inline nas Edge Functions, sem import externo):
- Remove tudo que não é dígito.
- Remove código de país `55` se presente.
- Para números brasileiros: garante DDD (2 dígitos) + 9 dígitos de assinante (insere o "nono dígito" se faltar para celular; remove se sobrar).
- Retorna formato canônico único: `55 + DDD + 9 + 8 dígitos` (13 dígitos).
- Para qualquer comparação, normaliza ambos os lados antes — **igualdade exata** apenas, sem `endsWith`.

**b) Aplicar normalização em duas frentes**:
- **Webhook** (`whatsapp-webhook/index.ts`): substituir o bloco linhas 308–340 pela comparação canônica. Logar `raw → normalized` para auditoria.
- **Salvamento** (`ProfilePage.tsx` + tela de criação/edição de usuário em `UsersTab.tsx`): normalizar antes de gravar em `profiles.whatsapp_number`, e mostrar o número formatado (`(54) 99922-3558`) na UI.

**c) Migração de dados**: rodar UPDATE único normalizando os 22 perfis existentes ao formato canônico de 13 dígitos. Isso elimina ambiguidades históricas (ex.: Bruno `5499223558` → `5554999223558`).

**d) Conflito de duplicatas**: após normalização, se dois perfis tiverem o mesmo número canônico, logar warning e listar para revisão manual (não é o caso atual, mas previne futuro).

### 2. Centralizar regras compartilhadas das Edge Functions

Criar um arquivo único de helpers reutilizado por todas as funções `notify-*` e pelo webhook:
- `isBusinessHoursBRT()` — substitui o bloco copiado em 7+ arquivos.
- `normalizePhoneBR(raw)` — normalização canônica descrita acima.
- `sendWhatsAppText(zapi, phone, message)` — wrapper com retry simples e logs uniformes.

Cada função `notify-*` passa a importar de `supabase/functions/_shared/notifications.ts` (padrão suportado pelo Deno).

### 3. Revisão dos cron jobs

- Manter os 6 jobs atuais; eles cobrem casos distintos.
- Adicionar **deduplicação por contexto** nas notificações in-app: antes de inserir em `notifications`, verificar se já existe uma com mesmo `user_id + title + message` criada nas últimas 6h. Evita spam quando o cron roda a cada 30 min e a tarefa continua atrasada.
- Documentar no topo de cada função o horário UTC vs BRT que ela realmente executa.

### 4. Links clicáveis na central in-app

- Popular o campo `link` ao criar notificações em todas as Edge Functions (`/boards/:id`, `/fleet/maintenances`, `/purchases/:id`, `/recurring-tasks`, etc.).
- Em `src/pages/Notifications.tsx`: tornar cada card clicável (`<Card>` com `onClick` que faz `navigate(link)` se houver), e adicionar cursor + hover. Marcar como lida automaticamente ao clicar.
- Aplicar o mesmo no popover do sino na sidebar (se existir).

### 5. Conteúdo das mensagens WhatsApp (ajustes pontuais)

- Padronizar cabeçalho (emoji + tipo) e rodapé (link curto para o sistema) em todas as mensagens via `sendWhatsAppText`.
- Garantir que toda notificação tenha o **nome do destinatário** no topo (algumas hoje só dizem "Olá," sem nome).

---

## Detalhes técnicos

**Arquivos afetados**:
- `supabase/functions/_shared/notifications.ts` (novo)
- `supabase/functions/whatsapp-webhook/index.ts` (matching)
- `supabase/functions/notify-*/index.ts` (importar shared, popular `link`)
- `src/pages/ProfilePage.tsx`, `src/components/settings/UsersTab.tsx` (normalizar no save + máscara de exibição)
- `src/pages/Notifications.tsx` (navegação ao clicar)
- 1 migração: UPDATE em `profiles.whatsapp_number` normalizando os 22 registros existentes.

**Sem mudanças** em: schema das tabelas (`notifications.link` já existe), RLS, configurações de Z-API, lógica de IA do bot.

**Validação após implementação**:
1. Enviar mensagem WhatsApp dos números do Bruno e do Eliseu e verificar nos logs que `normalized` coincide com o perfil correto.
2. Forçar disparo de `notify-overdue-tasks` duas vezes seguidas e confirmar deduplicação.
3. Clicar numa notificação in-app e validar redirecionamento.