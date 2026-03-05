# 📦 Documentação Técnica — Módulo de Compras (TaskFox v1.3)

---

## 1. Descrição Geral do Módulo

### Objetivo
O módulo de Compras é um sistema de gestão de materiais e suprimentos integrado ao TaskFox. Permite que usuários solicitem listas de compras, acompanhem o fluxo de aquisição (pendente → comprado → recebido) e recebam notificações em cada etapa.

### Principais Funcionalidades
- Criação de listas de compras com itens do catálogo de produtos
- Atribuição obrigatória de comprador (usuário com permissão `can_be_buyer`)
- Fluxo de status: `pending` → `purchased` → `received`
- Marcação individual de itens como comprados/recebidos
- Edição de listas pendentes (título, urgência, comprador, itens)
- Catálogo de produtos com categorias configuráveis
- Notificações automáticas via WhatsApp (Z-API) e in-app por estágio
- Lembretes automáticos para itens pendentes com prazo configurável
- Controle granular de permissões por usuário
- Dashboard com resumo financeiro de compras

---

## 2. Fluxo do Sistema

### Passo a Passo

```
1. Usuário cria uma lista de compras
   ├── Define título, urgência (low/medium/high/urgent)
   ├── Seleciona comprador obrigatório (usuário com permissão can_be_buyer)
   └── Adiciona itens do catálogo (nome, quantidade, categoria, valor estimado, descrição)

2. Lista criada com status "pending"
   ├── Notificação enviada aos usuários configurados (estágio "created")
   └── Lista visível na página de Compras e no Dashboard

3. Comprador realiza a compra
   ├── Pode marcar itens individualmente como "purchased" (com valor real)
   ├── Ou marcar lista inteira como "purchased" (com notas e valores por item)
   ├── Status da lista atualiza automaticamente baseado nos itens
   └── Notificação enviada (estágio "purchased")

4. Recebimento do material
   ├── Pode marcar itens individualmente como "received"
   ├── Ou marcar lista inteira como "received" (com notas)
   ├── Status da lista atualiza automaticamente
   └── Notificação enviada (estágio "received")

5. Edição (apenas listas pendentes)
   └── Criador ou admin pode alterar título, urgência, comprador e itens
```

### Como o Usuário Utiliza
- **Operador**: Acessa `/purchases`, cria listas, acompanha status
- **Comprador**: Recebe notificação, marca itens/lista como comprado(s), informa valores reais
- **Receptor**: Confirma recebimento dos materiais
- **Admin**: Gerencia catálogo, categorias, permissões, pode editar/excluir qualquer lista

---

## 3. Estrutura do Banco de Dados

### Tabela: `purchase_lists`
| Campo | Tipo | Nullable | Default | Descrição |
|-------|------|----------|---------|-----------|
| `id` | uuid | Não | `gen_random_uuid()` | PK |
| `title` | text | Não | `'Lista de Compras'` | Título da lista |
| `status` | enum `purchase_status` | Não | `'pending'` | `pending`, `purchased`, `received` |
| `urgency` | enum `purchase_urgency` | Não | `'medium'` | `low`, `medium`, `high`, `urgent` |
| `requested_by` | uuid | Não | — | ID do solicitante |
| `buyer_id` | uuid | Sim | — | ID do comprador atribuído |
| `purchased_at` | timestamptz | Sim | — | Data/hora da compra |
| `purchase_notes` | text | Sim | — | Notas da compra |
| `received_at` | timestamptz | Sim | — | Data/hora do recebimento |
| `received_by` | uuid | Sim | — | ID de quem recebeu |
| `receive_notes` | text | Sim | — | Notas do recebimento |
| `created_at` | timestamptz | Não | `now()` | Data de criação |
| `updated_at` | timestamptz | Não | `now()` | Data de atualização |

### Tabela: `purchase_list_items`
| Campo | Tipo | Nullable | Default | Descrição |
|-------|------|----------|---------|-----------|
| `id` | uuid | Não | `gen_random_uuid()` | PK |
| `list_id` | uuid | Não | — | FK → `purchase_lists.id` |
| `name` | text | Não | — | Nome do item |
| `quantity` | integer | Não | `1` | Quantidade |
| `category` | text | Não | `'other'` | Categoria do item |
| `estimated_value` | numeric | Sim | — | Valor estimado |
| `actual_value` | numeric | Sim | — | Valor real pago |
| `description` | text | Sim | — | Descrição |
| `status` | enum `purchase_status` | Não | `'pending'` | Status individual |
| `created_at` | timestamptz | Não | `now()` | Data de criação |

### Tabela: `product_catalog`
| Campo | Tipo | Nullable | Default | Descrição |
|-------|------|----------|---------|-----------|
| `id` | uuid | Não | `gen_random_uuid()` | PK |
| `name` | text | Não | — | Nome do produto |
| `category_id` | uuid | Sim | — | FK → `product_categories.id` |
| `default_estimated_value` | numeric | Sim | — | Valor estimado padrão |
| `created_at` | timestamptz | Não | `now()` | — |
| `updated_at` | timestamptz | Não | `now()` | — |

### Tabela: `product_categories`
| Campo | Tipo | Nullable | Default | Descrição |
|-------|------|----------|---------|-----------|
| `id` | uuid | Não | `gen_random_uuid()` | PK |
| `name` | text | Não | — | Nome da categoria |
| `created_at` | timestamptz | Não | `now()` | — |

### Tabela: `purchase_notification_settings`
| Campo | Tipo | Nullable | Default | Descrição |
|-------|------|----------|---------|-----------|
| `id` | uuid | Não | `gen_random_uuid()` | PK |
| `stage` | text | Não | — | Estágio da notificação |
| `is_active` | boolean | Não | `true` | Se está ativo |
| `notify_user_ids` | uuid[] | Não | `'{}'` | IDs dos destinatários |
| `reminder_days` | integer | Sim | — | Dias para lembrete |
| `created_at` | timestamptz | Não | `now()` | — |
| `updated_at` | timestamptz | Não | `now()` | — |

### Relacionamentos
```
purchase_list_items.list_id → purchase_lists.id (CASCADE DELETE)
product_catalog.category_id → product_categories.id
```

### Enums
```sql
purchase_status: 'pending' | 'purchased' | 'received'
purchase_urgency: 'low' | 'medium' | 'high' | 'urgent'
purchase_category: 'office' | 'cleaning' | 'technology' | 'maintenance' | 'food' | 'other'
```

---

## 4. Regras de Negócio

### Criação de Compras
- Qualquer usuário autenticado pode criar listas (`requested_by = auth.uid()`)
- Comprador (`buyer_id`) é **obrigatório** e deve ter permissão `can_be_buyer`
- Itens são inseridos com status `pending`

### Status Automático da Lista
- Se **todos os itens** forem `received` → lista fica `received`
- Se **todos os itens** forem `purchased` ou `received` → lista fica `purchased`
- Caso contrário → lista fica `pending`
- A função `updateListStatusFromItems` recalcula automaticamente após cada marcação individual

### Edição
- Permitida apenas para listas com status `pending`
- Apenas o criador (`requested_by`) ou administradores podem editar
- A edição remove todos os itens existentes e re-insere os novos (delete + insert)

### Exclusão
- Apenas administradores podem excluir listas (RLS: `is_app_admin()`)
- Itens são excluídos em cascata (FK com ON DELETE CASCADE)

### Horário Comercial para Notificações
- Segunda a Sexta: 08:30 – 18:00 (BRT/UTC-3)
- Sábado: 08:00 – 12:00
- Domingo: bloqueado
- Todas as Edge Functions verificam horário antes de processar

---

## 5. Estrutura das Telas

### Página de Compras (`/purchases`)
- **Lista de compras**: Cards com título, urgência (badge colorido), status, solicitante, comprador
- **Criação**: Dialog com campos título, urgência, comprador, itens do catálogo
- **Edição**: Dialog idêntico ao de criação (apenas listas pendentes)
- **Ações por lista**: Marcar como comprada (com notas e valores), marcar como recebida (com notas), excluir
- **Ações por item**: Marcar item individual como comprado (com valor real) ou recebido
- **Filtros visuais**: Separação por status (pendente, comprado, recebido)

### Configurações de Compras (`/settings` → aba "Compras")
- **Categorias**: CRUD de categorias de produtos
- **Catálogo**: CRUD de produtos com categoria e valor estimado padrão

### Configurações de Notificações (`/settings` → aba "Notificações")
- **Por estágio**: Ativar/desativar notificações para `created`, `purchased`, `received`
- **Destinatários**: Seleção de usuários por estágio
- **Lembretes**: Dias de lembrete para `pending_purchase_reminder` e `pending_receipt_reminder`
- **Disparo manual**: Botões para testar cada tipo de notificação

### Dashboard (`/` → aba "Compras")
- Resumo financeiro: total estimado vs. total real
- Contagem por status
- Listas recentes

---

## 6. Lógica do Backend

### Hook Principal: `usePurchases.ts`
| Função | Descrição |
|--------|-----------|
| `purchasesQuery` | Busca todas as listas com itens e nomes dos perfis |
| `createList` | Cria lista + itens + dispara notificação |
| `updateList` | Atualiza lista + deleta/re-insere itens |
| `markAsPurchased` | Marca lista inteira como comprada + atualiza itens + valores |
| `markAsReceived` | Marca lista inteira como recebida + atualiza itens |
| `markItemPurchased` | Marca item individual + recalcula status da lista |
| `markItemReceived` | Marca item individual + recalcula status da lista |
| `deleteList` | Remove lista (cascade deleta itens) |
| `updateListStatusFromItems` | Recalcula status da lista baseado nos itens |

### Edge Functions
| Função | Trigger | Descrição |
|--------|---------|-----------|
| `notify-purchase` | Chamada pelo frontend | Envia notificações WhatsApp + in-app ao criar/comprar/receber |
| `notify-purchase-reminders` | Cron (pg_cron) | Envia lembretes para listas pendentes há X dias |

### Automações
- **Notificação na criação**: `notify-purchase` com `action: "created"`
- **Notificação na compra**: `notify-purchase` com `action: "purchased"`
- **Notificação no recebimento**: `notify-purchase` com `action: "received"`
- **Lembretes**: `notify-purchase-reminders` verifica `purchase_notification_settings` com `reminder_days`
- **Horário comercial**: Todas as funções verificam BRT antes de enviar

### Validações
- RLS no banco garante isolamento de dados
- Permissões verificadas via função `has_permission()` (SECURITY DEFINER)
- Status do enum impede valores inválidos
- Frontend valida comprador obrigatório e pelo menos 1 item

---

## 7. Permissões de Usuário

### Matriz de Permissões
| Ação | Operador | Comprador | Admin | Admin Master |
|------|----------|-----------|-------|--------------|
| Ver listas | `can_view_purchases` | `can_view_purchases` | ✅ | ✅ |
| Criar listas | `can_manage_purchases` | `can_manage_purchases` | ✅ | ✅ |
| Editar listas pendentes | Apenas próprias | — | ✅ | ✅ |
| Marcar como comprado | — | ✅ (se atribuído) | ✅ | ✅ |
| Marcar como recebido | — | — | ✅ | ✅ |
| Excluir listas | — | — | ✅ | ✅ |
| Gerenciar catálogo | — | — | ✅ | ✅ |
| Config. notificações | — | — | ✅ | ✅ |

### Permissões no `user_permissions`
| Campo | Descrição |
|-------|-----------|
| `can_view_purchases` | Pode ver a página de compras |
| `can_manage_purchases` | Pode criar/editar listas e gerenciar catálogo |
| `can_be_buyer` | Pode ser atribuído como comprador |

### Políticas RLS Relevantes
- `purchase_lists` SELECT: aberto para autenticados (`true`)
- `purchase_lists` INSERT: `auth.uid() = requested_by`
- `purchase_lists` UPDATE: admin OU solicitante OU comprador
- `purchase_lists` DELETE: apenas admin
- `purchase_list_items` INSERT: apenas se o solicitante da lista
- `purchase_list_items` UPDATE: admin, solicitante ou comprador da lista
- `purchase_list_items` DELETE: admin ou solicitante

---

## 8. APIs e Integrações

### WhatsApp (Z-API)
- **Configuração**: Tabela `zapi_config` (instance_id, token, client_token)
- **Envio**: POST para `https://api.z-api.io/instances/{instance}/token/{token}/send-text`
- **Webhook**: Edge Function `whatsapp-webhook` para bot de comandos
- **Comandos do bot**: `criar_lista_compras` via IA (Lovable AI)

### Notificações In-App
- Tabela `notifications` com `title`, `message`, `link`, `is_read`
- Página `/notifications` para visualização
- Badge na sidebar com contagem de não lidas

### Supabase Edge Functions
- Todas as funções de notificação rodam em Deno (Supabase Edge Functions)
- Deploy automático via Lovable Cloud
- Cron jobs via `pg_cron` + `pg_net` para agendamentos

---

## 9. Stack Tecnológica

- **Frontend**: React + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Supabase (Auth, PostgreSQL, Edge Functions, Realtime)
- **Extensões**: pg_cron, pg_net
- **Integrações**: Z-API (WhatsApp), Lovable AI

---

*Documentação gerada em 05/03/2026 — TaskFox v1.3*
