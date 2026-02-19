
# TaskFlow - Sistema de Gestão de Tarefas

## 🏁 Marco: Versão V1.0 (19/02/2026)
> Estado estável do sistema com todas as funcionalidades base implementadas:
> - Autenticação (login, cadastro, recuperação de senha)
> - Dashboard com abas (Kanban, Tarefas Recorrentes, Compras)
> - Quadros Kanban com drag & drop, colunas, tarefas, etiquetas, prioridades
> - Gestão de Equipes (criar, convidar membros, papéis admin/membro)
> - Tarefas Recorrentes (diárias, semanais, mensais, por dia da semana)
> - Compras (listas, itens, catálogo de produtos, categorias, fluxo pendente→comprado→recebido)
> - Notificações internas e via WhatsApp (Z-API)
> - Configurações (usuários, permissões, integrações, log de atividades, backup)
> - Controle de permissões granular por usuário
> - Sistema de roles (admin/user)
>
> **Para restaurar esta versão:** Use o Histórico de edições do Lovable e encontre esta mensagem.

## Visão Geral
Sistema completo de gestão de tarefas estilo Trello com Kanban, gestão de equipes, dashboard analítico, autenticação por email/senha e notificações via WhatsApp (Z-API). Design clean e minimalista.

---

## Fase 1 - Base do Sistema

### 1. Autenticação
- Cadastro e login com email e senha
- Recuperação de senha
- Perfil do usuário (nome, avatar, cargo)

### 2. Layout e Navegação
- Sidebar com menu: Dashboard, Quadros, Equipes, Notificações, Configurações
- Layout responsivo, clean e minimalista com cores neutras

### 3. Gestão de Equipes
- Criar equipes e convidar membros por email
- Papéis: Admin e Membro
- Cada equipe com seus próprios quadros

---

## Fase 2 - Kanban e Tarefas

### 4. Quadro Kanban
- Colunas: A Fazer, Em Andamento, Em Revisão, Concluído
- Drag and drop para mover tarefas entre colunas
- Cards com título, responsável, prazo, etiquetas e prioridade

### 5. Gestão de Tarefas
- Criar, editar e excluir tarefas
- Atribuir membros, definir prazos, etiquetas coloridas
- Comentários em cada tarefa
- Notificações internas (atribuição, comentários, prazos)

---

## Fase 3 - Dashboard

### 6. Dashboard de Acompanhamento
- **Cards de resumo**: total de tarefas por status (a fazer, em andamento, concluídas, atrasadas)
- **Gráficos de progresso**: barras e pizza com distribuição por status e por equipe
- **Tarefas atrasadas**: lista destacada com indicadores visuais de urgência
- **Atividade recente**: timeline das últimas ações (criação, movimentação, conclusão)

---

## Fase 4 - Integração WhatsApp (Z-API)

### 7. Notificações via WhatsApp
- Configuração da conexão Z-API nas configurações do sistema (instância, token)
- Cada usuário pode cadastrar seu número de WhatsApp no perfil
- **Notificações automáticas** enviadas via WhatsApp:
  - Tarefas que passaram do prazo (alerta de atraso)
  - Atribuição de nova tarefa
  - Lembrete de prazo próximo (ex: 24h antes)
- Edge function no Supabase para envio das mensagens via Z-API
- Painel de configuração para ativar/desativar tipos de notificação por usuário
- Log de mensagens enviadas para acompanhamento

---

## Backend (Supabase)
- Tabelas: profiles, teams, team_members, boards, columns, tasks, task_labels, comments, activity_log, notifications, whatsapp_settings
- Row Level Security (RLS) para acesso seguro por equipe
- Edge functions para integração Z-API e verificação de prazos (cron job)
- Autenticação via Supabase Auth

