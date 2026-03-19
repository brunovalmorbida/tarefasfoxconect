

# Fix: Check-in Multi-Message Flow with Context Awareness

## Problem

When a driver sends a KM photo first and then text responses separately, the system fails because:

1. **Photo sets status to "answered"** -- subsequent text queries only look for "pending" check-ins, so they miss it
2. **Free-form text** (e.g., "Barulho na suspensão dianteira") doesn't match `KM:` or `Manutenção:` regex patterns, so it falls through to the general AI which interprets it as a task creation command
3. **No partial completion tracking** -- the system can't tell which parts of the checklist are already filled in

## Solution

### 1. Add `tools_ok` column to `fleet_checkins` table

Track which fields have been answered so the bot knows what's still missing.

```sql
ALTER TABLE fleet_checkins ADD COLUMN tools_ok boolean DEFAULT NULL;
ALTER TABLE fleet_checkins ADD COLUMN tools_description text DEFAULT NULL;
```

### 2. Change KM photo handler to NOT set status to "answered"

Keep status as "pending" when only the KM photo was submitted. The check-in is only "answered" when all required fields (KM + maintenance + tools) are filled.

### 3. Add `responder_checkin_frota` tool to the AI

A new tool in the TOOLS array that the AI can call when it recognizes the user is answering check-in questions:

```text
responder_checkin_frota(
  km: number | null,
  manutencao: boolean | null,
  descricao_manutencao: string | null,
  ferramentas_ok: boolean | null,
  observacao_ferramentas: string | null
)
```

### 4. Inject check-in context into the AI system prompt

Before calling the AI, check if the user has a recent check-in (pending or answered today). If so, prepend context to the system prompt:

- Which vehicle the check-in is for
- Which fields are already filled (KM, maintenance, tools)
- Which fields are still missing
- Instruct the AI to use `responder_checkin_frota` for any check-in-related responses

### 5. Unified handler `handleResponderCheckinFrota`

Processes AI-parsed check-in data:
- Merges new data with existing check-in record (partial updates)
- Only marks status as "answered" when all 3 fields are complete (KM + maintenance + tools)
- Sends confirmation listing completed/pending items
- Creates maintenance task if needed (when maintenance = true)

### 6. Broaden regex detection block

Change the existing text detection (line 531-538) to also match check-ins with status "answered" from today, as a fallback before the AI path.

## Flow Example

```text
Bot: "Check-in semanal do veículo Strada..."
Driver: [sends photo of dashboard]
Bot: "KM: 45.230 ✅ Agora responda: Manutenção? Ferramentas?"
Driver: "Barulho na suspensão dianteira"
Bot: (AI sees check-in context → uses responder_checkin_frota)
     "✅ Manutenção: Sim - Barulho na suspensão dianteira
      Falta: Ferramentas (sim/não)"
Driver: "Sim"
Bot: "✅ Check-in completo! KM: 45.230 | Manutenção: Sim | Ferramentas: OK"
```

## Files Changed

- **`supabase/functions/whatsapp-webhook/index.ts`**: Add tool, context injection, handler, fix status logic
- **Database migration**: Add `tools_ok` and `tools_description` columns to `fleet_checkins`

