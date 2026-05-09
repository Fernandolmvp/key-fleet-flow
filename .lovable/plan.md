# Correção e melhoria do módulo de Importação de Apólice

## Diagnóstico do problema atual

A IA "retorna vazio" porque a edge function `extract-insurance-policy` **nunca chega a ser chamada com sucesso** em PDFs reais. Verificado pelos logs (vazios) e pelo código atual em `InsurancePanel.tsx`:

```ts
const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
```

Para PDFs de poucos KB isso até funciona, mas para apólices reais (centenas de KB a alguns MB) o `String.fromCharCode(...arr)` **estoura o tamanho de argumentos da função** (RangeError: Maximum call stack), o `try/catch` engole e mostra "IA não conseguiu ler". A função sequer recebe o arquivo. Esse é o bug nº 1 e a correção sozinha já restabelece a leitura.

Além disso, hoje a vinculação só usa **placa**. Vamos adicionar **fallback por chassi** e uma **tela de revisão** classificando cada veículo em `VINCULADO / NÃO ENCONTRADO / INCONSISTÊNCIA` antes de salvar.

A coluna `chassis` já existe em `vehicles` e o edge function já extrai `chassis` por veículo — não precisamos de migration.

## Arquivos que serão modificados

1. **`src/components/dashboard/InsurancePanel.tsx`** (frontend)
   - Trocar a conversão base64 por uma versão **chunked** (segura para arquivos grandes).
   - Carregar `chassis` junto com cada `vehicle` no `load()`.
   - Nova função utilitária `normalize(s)` (uppercase + remove tudo que não é A‑Z/0‑9).
   - Nova função `matchVehicle(aiVeh)` que busca:
     1. por placa normalizada;
     2. se não achar, por chassi normalizado;
     3. classifica como `linked` / `not_found` / `mismatch` (achou por placa mas chassi do banco ≠ chassi da apólice, ou vice‑versa).
   - Novo estado `reviewItems` + um **diálogo de revisão** mostrado logo após a extração da IA, listando cada veículo com badge colorida e ação:
     - **Vinculado** (verde) — pré‑marcado para vincular.
     - **Não encontrado** (âmbar) — exibe placa/chassi vindos da apólice; sem ação automática.
     - **Inconsistência** (vermelho) — pede revisão manual; gestor pode confirmar mesmo assim ou ignorar.
   - Botão "Confirmar e vincular": cria os registros em `insurance_policy_vehicles` apenas dos itens marcados pelo gestor (upsert por `policy_id,vehicle_id` — já existe constraint).
   - Manter os fluxos atuais de salvar apólice, editar, excluir e vinculação manual — nada é removido.

2. **`supabase/functions/extract-insurance-policy/index.ts`** (backend)
   - Adicionar `console.log` no início (recebimento, tamanho do payload, mimeType) para facilitar diagnóstico futuro.
   - Reforçar instrução do system prompt para **sempre retornar `vehicles[]` com `plate` e `chassis` quando visíveis** (já está, só endurecemos a frase).
   - Sem mudança de schema do tool — as informações pedidas (seguradora, número, vigência, placas, chassi) já estão no schema atual.

## Migrations

**Nenhuma.** Todos os campos necessários já existem (`vehicles.chassis`, `insurance_policies.ai_extracted`, `insurance_policy_vehicles` com `inclusion_type` e unique `(policy_id, vehicle_id)`).

## O que NÃO muda

- Painel de seguros, listagem, edição manual e exclusão de apólices.
- Sincronização `sync_vehicle_insurance_fields`.
- Estrutura do banco e RLS.
- Cadastro automático de corretor a partir da IA.

## Resumo da experiência final

1. Gestor anexa PDF → upload OK (já funcionava) → IA agora **lê de verdade**.
2. Abre automaticamente o **diálogo de revisão** com a lista classificada.
3. Gestor confirma → registros são criados em `insurance_policy_vehicles` e veículos passam a aparecer vinculados à apólice.
4. Apólice é salva normalmente com o `ai_extracted` bruto preservado.

Posso aplicar?
