# TaskFox — Sistema de Gestão de Tarefas da Fox Conect

## O que é o TaskFox?

TaskFox é uma plataforma SaaS de gestão de tarefas e produtividade desenvolvida para a **Fox Conect**. É um sistema web responsivo com design premium, autenticação por email/senha, controle de permissões granular por usuário e integração com WhatsApp via Z-API. O sistema roda em React + TypeScript + Tailwind CSS no frontend, com backend serverless (banco de dados PostgreSQL, autenticação, edge functions e storage em nuvem).

---

## Módulos e Funcionalidades

### 1. Autenticação e Perfil
- Cadastro e login com email e senha (com verificação de email)
- Recuperação e redefinição de senha
- Perfil do usuário: nome, cargo, avatar, número de WhatsApp
- Dois papéis globais: **Admin** e **Usuário**
- Permissões granulares por usuário:
  - `can_manage_boards` — criar/editar/excluir quadros Kanban
  - `can_manage_columns` — criar/editar/excluir colunas dentro dos quadros
  - `can_manage_tasks` — criar/editar/excluir tarefas
  - `can_manage_recurring_tasks` — gerenciar tarefas recorrentes

### 2. Equipes (Teams)
- Criar equipes com nome e descrição
- Convidar membros por email
- Papéis dentro da equipe: **Admin** e **Membro**
- Cada equipe possui seus próprios quadros e tarefas
- Apenas admins do sistema podem editar/excluir equipes (membros só visualizam)

### 3. Quadros Kanban (Boards)
- Cada quadro pertence a uma equipe e pode ser atribuído a um usuário
- Colunas padrão: A Fazer, Em Andamento, Em Revisão, Concluído
- Colunas customizáveis (criar, editar, excluir, reordenar)
- **Tarefas (cards)** com:
  - Título e descrição
  - Responsável (assignee) — membro da equipe
  - Prioridade: baixa, média, alta, urgente
  - Data de vencimento (due date)
  - Etiquetas/labels coloridas
  - Comentários
- Drag & drop para mover tarefas entre colunas (arrastar pelo card inteiro, cursor grab/grabbing, elevação visual ao arrastar)
- Cards com barra de progresso colorida (verde ≥70%, amarelo ≥40%, vermelho <40%)
- Hover com botão de edição e elevação suave

### 4. Tarefas Recorrentes (Recurring Tasks)
- Quadros de tarefas recorrentes, cada um com frequência definida:
  - **Diária** — ativa todos os dias
  - **Semanal** — ativa em um dia específico da semana
  - **Mensal** — ativa em um dia específico do mês
  - **Dia da semana** — ativa de segunda a sexta
- Cada quadro pode ser atribuído a um usuário
- Tarefas dentro do quadro herdam a frequência
- Sistema de conclusão por período (marca como feita para o dia/semana/mês atual)
- Barra de progresso do dia com porcentagem de conclusão
- Animação visual ao concluir (riscar + opacidade)
- Drag & drop para reordenar tarefas

### 5. Compras (Purchases)
- Listas de compras com título, urgência e itens
- Cada item tem: nome, quantidade, categoria, valor estimado, descrição
- Categorias: Escritório, Limpeza, Tecnologia, Manutenção, Alimentação, Outros
- Urgência: Baixa, Média, Alta, Urgente
- Fluxo de status: **Pendente → Comprado → Recebido**
  - Ao marcar como "Tudo Comprado": registra comprador e data
  - Ao marcar como "Tudo Recebido": registra recebedor, data e notas
- Itens individuais também podem ser marcados como comprados/recebidos
- Valor real pode ser preenchido ao marcar item como comprado
- Resumo financeiro: total estimado vs total real
- Admins podem marcar como recebido mesmo sem ser o solicitante
- Catálogo de produtos (product_catalog) com categorias para reutilização

### 6. Dashboard
- Saudação personalizada com nome do usuário
- Três abas: **Kanban**, **Recorrentes**, **Compras**
- **Aba Kanban**:
  - Cards de resumo: total de tarefas, em andamento, concluídas, atrasadas
  - Score de produtividade (% concluídas)
  - Lista de tarefas atrasadas e tarefas do dia
- **Aba Recorrentes**:
  - Total de quadros, tarefas ativas hoje, concluídas hoje, pendentes
  - Barra de progresso do dia
  - Lista de tarefas pendentes para hoje
- **Aba Compras**:
  - Total de listas, pendentes, compradas, recebidas
  - Resumo financeiro (estimado vs real)
- Feed de atividades recentes
- Skeleton loading durante carregamento

### 7. Notificações
- Notificações internas (in-app):
  - Atribuição de tarefas
  - Eventos de compras (criada, comprada, recebida)
  - Tarefas atrasadas e próximas do vencimento
  - Tarefas recorrentes do dia
- Badge de contagem de não lidas na sidebar
- Marcar como lida (individual ou todas)
- Excluir notificação
- **Notificações via WhatsApp (Z-API)**:
  - Tarefas atrasadas
  - Tarefas próximas do vencimento (hoje e 3 dias antes)
  - Atribuição de nova tarefa
  - Tarefas recorrentes do dia
  - Eventos de compras
  - Disparos automáticos via cron e disparos manuais pelo admin

### 8. Bot WhatsApp (TaskFox Bot)
- Webhook que recebe mensagens do WhatsApp via Z-API
- Usa IA para interpretar comandos em linguagem natural
- Comandos disponíveis:
  - `criar_tarefa` — cria tarefa em um quadro Kanban
  - `listar_tarefas` — lista tarefas (filtros por status/quadro)
  - `concluir_tarefa` — move tarefa para coluna "Concluído"
  - `criar_lista_compras` — cria lista de compras com itens
  - `resumo_dia` — resumo diário de tarefas
  - `resumo_completo` — resumo por período (dia/semana/mês)
  - `tarefas_usuario` — ver tarefas de outro usuário (admin)
  - `tarefas_diarias_usuario` — ver tarefas recorrentes de outro usuário (admin)
  - `ajuda` — lista de comandos
- Identifica o usuário pelo número de WhatsApp cadastrado no perfil

### 9. Configurações (Settings) — Somente Admin
- **Geral**: Exportar backup completo do sistema (JSON)
- **Usuários**: Criar, editar, excluir usuários; gerenciar papéis (admin/user); atribuir equipes
- **Permissões**: Configurar permissões granulares por usuário
- **Integrações**: Configurar Z-API (instance ID, token, client token, ativar/desativar)
- **Log de Atividades**: Histórico completo de ações no sistema
- **Compras**: Configurações do módulo de compras (categorias, catálogo)
- **Notificações**: Ver agendamentos automáticos, disparar notificações manualmente

---

## Arquitetura Técnica

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Estilização | Tailwind CSS + shadcn/ui + CSS custom tokens |
| Estado | TanStack React Query (cache + mutations) |
| Drag & Drop | @hello-pangea/dnd |
| Roteamento | React Router v6 |
| Backend | PostgreSQL + Edge Functions (Deno) |
| Autenticação | Auth com email/senha |
| Segurança | Row Level Security (RLS) em todas as tabelas |
| Integrações | Z-API (WhatsApp) |
| IA | Modelo de linguagem para interpretação de comandos do bot |

---

## Tabelas do Banco de Dados

| Tabela | Descrição |
|---|---|
| `profiles` | Perfil do usuário (nome, cargo, avatar, WhatsApp) |
| `user_roles` | Papel global do usuário (admin/user) |
| `user_permissions` | Permissões granulares por usuário |
| `teams` | Equipes |
| `team_members` | Membros de cada equipe (com papel admin/member) |
| `boards` | Quadros Kanban |
| `board_columns` | Colunas dos quadros |
| `tasks` | Tarefas dos quadros Kanban |
| `comments` | Comentários em tarefas |
| `recurring_task_boards` | Quadros de tarefas recorrentes |
| `recurring_tasks` | Tarefas recorrentes |
| `recurring_task_completions` | Registro de conclusões de tarefas recorrentes |
| `purchase_lists` | Listas de compras |
| `purchase_list_items` | Itens das listas de compras |
| `product_catalog` | Catálogo de produtos reutilizáveis |
| `product_categories` | Categorias de produtos |
| `notifications` | Notificações internas |
| `activity_log` | Log de atividades do sistema |
| `zapi_config` | Configuração da integração Z-API |

---

## Regras de Negócio Importantes

1. **Admins** têm acesso total ao sistema. **Usuários** só veem/editam o que suas permissões permitem.
2. Todas as tabelas possuem RLS — dados só são acessíveis a membros da equipe correspondente.
3. O bot WhatsApp identifica o usuário pelo número cadastrado; comandos de admin só funcionam para admins.
4. Tarefas recorrentes são marcadas como concluídas por período — se a frequência é diária, a conclusão vale só para hoje.
5. O fluxo de compras é sequencial: Pendente → Comprado → Recebido. Cada transição registra quem fez e quando.
6. Notificações WhatsApp dependem da Z-API estar configurada e ativa, e do usuário ter número cadastrado.

---

## URL da Aplicação

- Produção: https://tarefasfoxconect.lovable.app
