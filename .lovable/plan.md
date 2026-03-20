

## Plano: Sistema de Score de Veículos

### Resumo
Implementar score automático (0-100) para cada veículo calculado no frontend com base em manutenções, check-ins e ferramentas. Sem alteração no banco de dados -- o score é computado em tempo real a partir dos dados já existentes. Isso mantém a estabilidade do V3.0 e evita migrações desnecessárias.

### Decisão Arquitetural: Score Calculado no Frontend

O score **não** será armazenado no banco. Será calculado via `useMemo` a partir dos dados já carregados (vehicles, checkins, maintenances). Razões:
- Dados já estão disponíveis nos hooks existentes
- Evita migrações e triggers complexos
- Atualização automática ao recarregar dados
- Preparado para futuro: pode migrar para DB function se necessário

### Novo Arquivo: `src/hooks/useVehicleScore.ts`

Função pura `calculateVehicleScore(vehicleId, maintenances, checkins)` que:

```text
Base: 100 pontos

Deduções:
- Manutenção não-completed com priority=critical: -30
- Manutenção não-completed com priority=attention: -15
- Manutenção não-completed com priority=low: -5
- Check-in da semana com tools_ok=false: -10
- Cada item em missing_tools da manutenção: -3
- Sem check-in answered na semana atual: -20
- >2 manutenções nos últimos 30 dias: -15
- >4 manutenções nos últimos 30 dias: -30 (substitui -15)

Bônus:
- 30 dias sem manutenção criada: +10
- Check-in answered na semana: +5

Clamp: Math.max(0, Math.min(100, score))
```

Hook `useVehicleScores()` retorna `Map<vehicleId, { score, classification }>`.

Classificação:
- 80-100: `healthy` (verde)
- 50-79: `attention` (amarelo)
- 0-49: `critical` (vermelho)

### Novo Componente: `src/components/fleet/VehicleScoreBadge.tsx`

Badge compacto que exibe score + classificação com cor. Usado nos cards de veículos e no dashboard.

```text
[🟢 92 Saudável]  [🟡 65 Atenção]  [🔴 32 Crítico]
```

Inclui barra de progresso circular ou linear opcional.

### Alterações em Arquivos Existentes

**1. `src/pages/fleet/FleetDashboard.tsx`**
Adicionar seção de Score da Frota:
- Card "Score Médio da Frota" com valor e cor
- Card com contagem por classificação (X saudáveis, Y atenção, Z críticos)
- Ranking: 5 piores veículos (menor score)
- Ranking: 5 melhores veículos (maior score)

**2. `src/pages/fleet/FleetVehicles.tsx`**
- Adicionar `VehicleScoreBadge` em cada card de veículo, entre stats e status badge
- Permitir ordenação por score

**3. `src/pages/fleet/VehicleDetail.tsx`**
- Adicionar card de Score no topo da página com classificação visual

### Detalhes Técnicos

**Cálculo centralizado**: Uma única função pura testável. O hook `useVehicleScores` consome os mesmos hooks `useFleetMaintenances` e `useFleetCheckins` já usados no dashboard.

**Performance**: O cálculo é O(n*m) onde n=veículos, m=manutenções+checkins. Com frotas pequenas (<100 veículos) é negligível. Usa `useMemo` com deps nos arrays de dados.

**Preparação para futuro**: A interface `ScoreConfig` com pesos será exportada para permitir configuração futura via settings.

### Arquivos Impactados
1. `src/hooks/useVehicleScore.ts` (novo)
2. `src/components/fleet/VehicleScoreBadge.tsx` (novo)
3. `src/pages/fleet/FleetDashboard.tsx` (adicionar seção de scores)
4. `src/pages/fleet/FleetVehicles.tsx` (adicionar badge nos cards)
5. `src/pages/fleet/VehicleDetail.tsx` (adicionar card de score)

### Sem Alterações no Banco
Nenhuma migração necessária. Score é 100% calculado no frontend.

