

## Plano: Modal de Manutenção Profissional e Inteligente

### Resumo
Reescrever o componente `CreateMaintenanceFromCheckin.tsx` como um modal completo e inteligente, com preenchimento automático baseado no check-in, automações ao salvar (atualizar veículo, criar tarefa Kanban, enviar notificação), e UX profissional com cores de prioridade e sugestões.

### Mudanças no Banco de Dados

**Migração**: Adicionar colunas à tabela `fleet_maintenances`:
- `priority` (text, default `'medium'`): `critical`, `attention`, `low`
- `scheduled_date` (date, nullable)
- `scheduled_time` (time, nullable)
- `assigned_to` (uuid, nullable)
- `missing_tools` (text[], nullable)

### Arquivo: `src/components/fleet/CreateMaintenanceFromCheckin.tsx`
Reescrever completamente com:

**1. Campos do formulário:**
- **Tipo**: Select com apenas "Preventiva" / "Corretiva", auto-detectado por palavras-chave na descrição
- **Prioridade**: Select obrigatório com ícones coloridos (Critico/Atenção/Baixo), auto-detectado por palavras-chave (freio, motor, suspensão → Crítico; balanceamento, alinhamento → Atenção)
- **Oficina/Fornecedor**: Input com datalist de sugestões (query das oficinas já usadas em `fleet_maintenances.supplier`)
- **Problema do Veículo**: Textarea pré-preenchido do check-in, editável
- **Ferramentas Faltantes**: Multi-checkbox com lista padrão (Notebook, Alicate, Conector, Máquina de fusão, Chave de fenda, Outros), pré-selecionado do `tools_description`
- **Custo Estimado**: Input numérico formatado
- **Data de Agendamento**: Campo date obrigatório + time opcional
- **Responsável**: Select com usuários do sistema, sugestão automática do motorista do veículo
- **Observações**: Textarea livre

**2. Lógica de auto-preenchimento (`handleOpen`):**
- Analisa `checkin.description` e `tools_description` para inferir tipo e prioridade
- Busca oficinas anteriores para sugestões
- Pré-seleciona ferramentas faltantes parseando o texto do check-in

**3. Automações no `handleSubmit`:**
- Criar registro de manutenção com novos campos
- Atualizar status do veículo: Crítico → `"maintenance"`, Atenção → `"active"` (com nota)
- Criar tarefa Kanban no board configurado em `fleet_settings.default_board_id`
- Invocar `notify-task-assigned` para notificar responsável
- Atualizar check-in `resolution_status` para `"scheduled"`

**4. UX/UI:**
- Cores de badge para prioridade (vermelho, amarelo, verde)
- Ícones em cada seção do formulário
- Layout em grid responsivo com scroll interno
- Botão "Criar Manutenção" com gradiente e loading state
- Toast de sucesso detalhado

### Arquivo: `src/hooks/useFleet.ts`
- Atualizar `FleetMaintenance` interface com novos campos (`priority`, `scheduled_date`, `scheduled_time`, `assigned_to`, `missing_tools`)
- Atualizar `FleetVehicle` status type para incluir `"attention"`

### Arquivo: `src/pages/fleet/FleetMaintenances.tsx`
- Adicionar coluna de Prioridade na tabela com badges coloridos
- Exibir responsável atribuído
- Manter compatibilidade com registros antigos sem os novos campos

### Detalhes Técnicos

**Detecção automática de tipo e prioridade:**
```text
Palavras → Corretiva + Crítico: barulho, falha, quebra, motor, freio, suspensão
Palavras → Corretiva + Atenção: balanceamento, alinhamento, folga
Palavras → Preventiva: revisão, troca de óleo, km
Default: Corretiva + Atenção
```

**Criação de tarefa Kanban:**
- Busca `fleet_settings` para `default_board_id`
- Busca primeira coluna do board
- Insere tarefa com título "Manutenção - [Veículo]", descrição, responsável e prazo

**Sugestão de oficinas:**
- Query `SELECT DISTINCT supplier FROM fleet_maintenances WHERE supplier IS NOT NULL` para popular datalist

### Arquivos Impactados
1. `src/components/fleet/CreateMaintenanceFromCheckin.tsx` (reescrita)
2. `src/hooks/useFleet.ts` (tipos atualizados)
3. `src/pages/fleet/FleetMaintenances.tsx` (tabela atualizada)
4. Migração SQL (novos campos)

