
# TaskFox - Sistema de Gestão de Tarefas

## 🏁 Marco: Versão V2.0 (09/03/2026)
> Consolidação completa do TaskFox sobre a base V1.3:
> - **Documentação técnica completa** do sistema exportável em formato público (.txt) para análise por IAs externas
> - **Busca global** (Ctrl+K) em tarefas, quadros e compras
> - **Subtarefas/Checklist** com barra de progresso nos cards Kanban
> - **Comentários** em tarefas com controle de autoria
> - **Perfis de usuário** editáveis (nome, avatar, cargo, WhatsApp)
> - **Edição de listas de compras** pendentes (título, urgência, comprador, itens)
> - **WhatsApp Bot com IA** (Gemini): comandos por linguagem natural, memória conversacional (10 msgs / 30min), roteamento por permissão
> - **Automações avançadas**: 8 Edge Functions de notificação com controle de horário comercial (BRT)
> - **Permissões granulares**: 7 permissões independentes + visibilidade de equipes por usuário
> - Todas funcionalidades das versões anteriores mantidas
>
> **Para restaurar esta versão:** Use o Histórico de edições do Lovable e encontre esta mensagem.

## 🏁 Marco: Versão V1.2 (19/02/2026)
> Melhorias de UX e interação sobre a base V1.1:
> - **Dashboard Premium**: refatoração completa das 3 dashboards (Kanban, Tarefas Fixas, Compras) com hierarquia visual aprimorada, cards expressivos, barras de progresso com gradiente, feed de atividades, skeleton loading e microinterações
> - **Kanban Cards**: arrasto pelo card inteiro (sem grip handle), cursor grab/grabbing, elevação ao arrastar
> - Todas funcionalidades anteriores mantidas sem alteração de backend
>
> **Para restaurar esta versão:** Use o Histórico de edições do Lovable e encontre esta mensagem.

## 🏁 Marco: Versão V1.1 (19/02/2026)
> Refatoração completa de UI/UX para experiência SaaS premium sobre a base V1.0:
> - **Design System**: bordas 12px, sombras suaves, tokens semânticos de prioridade, animações (fade-in, scale-in, slide-up, check-strike, progress-fill)
> - **Quadros Kanban**: cards premium com avatar, barra de progresso colorida (verde/amarelo/vermelho), hover com elevação e botão editar
> - **Kanban interno**: bordas laterais de prioridade, datas inteligentes (atrasadas em vermelho com alerta), badges sólidos nas colunas, hover com ações rápidas
> - **Tarefas Fixas**: layout em blocos visuais por frequência, barra de progresso do dia animada, animação ao concluir (riscar + opacidade)
> - **Dashboard**: saudação personalizada, abas Kanban/Recorrentes/Compras, score de produtividade, resumo financeiro de compras
> - **Tema claro/escuro**: toggle na sidebar com persistência em localStorage
> - Todas funcionalidades da V1.0 mantidas sem alteração de backend
>
> **Para restaurar esta versão:** Use o Histórico de edições do Lovable e encontre esta mensagem.

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

