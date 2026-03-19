# TaskFox — Roadmap & Milestones

## V1.0 — Base (Fev/2026)
- Kanban com quadros, colunas e tarefas
- Tarefas recorrentes (diárias, semanais, mensais)
- Sistema de compras de materiais
- Autenticação e permissões por usuário
- Notificações internas

## V2.0 — Consolidação (09/03/2026)
- Módulo de Frota (veículos, motoristas, manutenções, documentos)
- Módulo Social Media (pipeline, metas, categorias)
- Busca global (Ctrl+K)
- Subtarefas e comentários
- Perfis editáveis
- Automações WhatsApp com memória conversacional e botões interativos
- Edição de listas de compras

## V3.0 — Frota Completa (19/03/2026)
- **Check-in multi-mensagem via WhatsApp**: motoristas respondem em múltiplas mensagens (foto + texto), com visão computacional (Gemini) para leitura de KM
- **Contexto de IA para check-ins**: sistema injeta contexto do check-in pendente no prompt da IA, garantindo que descrições de manutenção e ferramentas sejam interpretadas corretamente via tool calling (`responder_checkin_frota`)
- **Rastreamento parcial de conclusão**: check-in só é marcado como "respondido" quando KM, manutenção e ferramentas estão todos preenchidos
- **Lembretes automáticos a cada 15 min**: edge function (`notify-checkin-reminder`) dispara via cron durante horário comercial, listando exatamente quais itens faltam
- **Triagem de check-ins na UI**: campo `resolution_status` (Em aberto / Manutenção agendada / Resolvido) para acompanhar se problemas reportados foram tratados
- **Ferramentas no diálogo**: seção dedicada no formulário de edição para status e descrição das ferramentas
- **Botão "Criar Manutenção"**: criação direta de registro de manutenção a partir de problemas reportados no check-in
- **Tarefas automáticas detalhadas**: tarefas criadas no Kanban incluem descrição completa de manutenção e ferramentas
- **Página de detalhes do veículo**: timeline de histórico, documentos anexados, alertas de vencimento

## V3.1 — Refinamento Visual & Prevenção (Próximo)
- **Melhorias visuais**: redesign de cards, dashboards e responsividade mobile
- **Manutenção preventiva**: alertas automáticos baseados em KM, tempo desde última manutenção e histórico do veículo
- **Dashboard analítico da frota**: custos, tendências de KM, histórico de manutenções
- **Relatórios exportáveis** (PDF/CSV) de check-ins e manutenções
- **Integração de abastecimento**: controle de combustível por veículo

⚠️ **Regra de estabilidade V3.1+**: Nenhuma alteração pode quebrar funcionalidades consolidadas na V3.0. Todas as mudanças devem ser aditivas ou isoladas em novos componentes.
