# Helper Genérico de IA com Fallback Automático

## Visão Geral

Criar um helper `callAi()` que abstrai todas as chamadas de IA. As edge functions passam apenas `feature` + `messages`; o helper consulta as tabelas `ai_providers`, `ai_models`, `ai_feature_routing` para decidir provedor primário e fallback, executa, registra em `ai_usage_logs` com provider_id, model_id_used, was_fallback e response_time_ms, e retorna o resultado.

A IA atual (Lovable Gateway hardcoded) continua funcionando durante toda a migração — o Lovable já é o primário em todas as 11 features cadastradas, e o fallback é automaticamente acionado se algum provedor falhar ou se seu secret não estiver configurado.

---

## Estrutura de arquivos

```text
supabase/functions/_shared/
├── ai-tokens.ts            (mantido — guardAiCall, registerAiUsage)
├── ai-router.ts            (NOVO — callAi orquestrador)
└── providers/
    ├── types.ts            (NOVO — tipos compartilhados)
    ├── lovable.ts          (NOVO — adapter ativo)
    ├── gemini.ts           (NOVO — adapter ativo)
    ├── claude.ts           (NOVO — stub)
    └── openai.ts           (NOVO — stub)
```

---

## ETAPA 1 — `ai-router.ts`

```ts
export type CallAiParams = {
  feature: string;
  messages: any[];
  tools?: any[];
  toolChoice?: any;
  // ctx vindo de guardAiCall (ctx.supabase, ctx.companyId, ctx.userId, ctx.requestId)
  ctx: GuardContext;
};

export type CallAiResult = {
  success: boolean;
  data: any | null;
  providerUsed: string | null;     // code
  modelUsed: string | null;        // model_id
  providerId: string | null;       // uuid (para log)
  modelId: string | null;          // uuid (para log)
  tokensInput: number;
  tokensOutput: number;
  tokensTotal: number;
  wasFallback: boolean;
  responseTimeMs: number;
  errorMessage: string | null;
  httpStatus: number | null;
};

export async function callAi(p: CallAiParams): Promise<CallAiResult>
```

Fluxo interno:
1. `ctx.supabase.rpc("get_routing_for_feature", { _feature })` → { primary: {provider_code, secret_name, api_endpoint, model_id, model_uuid, provider_uuid}, fallback: {...} | null }
2. Tentar primário com `tryProvider(primary)` → mede `Date.now()` antes/depois
3. Se erro recuperável e existe fallback → tentar fallback (was_fallback = true)
4. Independente do resultado, registrar em `ai_usage_logs` via `registerAiUsage` com novos campos: provider_id, model_id_used, was_fallback, response_time_ms
5. Retornar resultado estruturado

Classificação de erro (helper interno):
```ts
function isRecoverable(status: number | null, kind: 'http'|'network'|'timeout'|'no_secret'): boolean {
  if (kind === 'no_secret' || kind === 'network' || kind === 'timeout') return true;
  if (status === 402 || status === 429) return true;
  if (status && status >= 500 && status <= 599) return true;
  return false; // 400/401/403 → não tenta fallback
}
```

`tryProvider(p)`:
- Se `Deno.env.get(p.secret_name)` vazio → retorna `{ ok:false, kind:'no_secret', error:'secret_not_configured: '+p.secret_name }` (sem chamar fetch)
- Faz dispatch por `provider_code`: lovable | gemini | claude | openai
- AbortController com timeout 30s
- Retorna `{ ok, data, status, kind, tokens:{input,output,total}, error }`

---

## ETAPA 2 — Adapters

`providers/types.ts` — tipos `ProviderCallArgs`, `ProviderCallResult`.

`providers/lovable.ts` (ativo, mantém comportamento atual):
- Endpoint: `https://ai.gateway.lovable.dev/v1/chat/completions` (ou api_endpoint do banco)
- Header: `Authorization: Bearer ${secret}`
- Body OpenAI-compat: `{ model, messages, tools?, tool_choice? }`
- Tokens: `usage.prompt_tokens / completion_tokens / total_tokens`

`providers/gemini.ts` (ativo, Google direto):
- Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={secret}`
- `adaptMessagesToGemini(messages)`:
  - system → `systemInstruction: { parts: [{text}] }`
  - user/assistant → `contents: [{ role: 'user'|'model', parts: [...] }]`
  - parts: text → `{text}`; image_url(data URL) → `{inlineData:{mimeType,data}}`; file(file_data data URL) → `{inlineData:{mimeType,data}}`
  - tools → `tools: [{ functionDeclarations: [...] }]`, tool_choice → `toolConfig: {functionCallingConfig:{mode:'ANY', allowedFunctionNames:[name]}}`
- `extractTokensFromGemini`: `usageMetadata.promptTokenCount / candidatesTokenCount / totalTokenCount`
- Resposta normalizada para o mesmo shape do Lovable: `{ choices: [{ message: { content, tool_calls:[{function:{name, arguments: JSON.stringify(args)}}] } }], usage: {...} }` para que as edge functions não precisem mudar parsing.

`providers/claude.ts` e `providers/openai.ts`:
```ts
export async function callClaude(args: ProviderCallArgs): Promise<ProviderCallResult> {
  // TODO: implementar Anthropic Messages API
  return { ok:false, kind:'http', status:501, error:'claude_adapter_not_implemented', tokens:{input:0,output:0,total:0}, data:null };
}
```

---

## ETAPA 3 — Persistência ampliada

Estender `registerAiUsage` em `ai-tokens.ts` para aceitar opcionalmente `providerId`, `modelIdUsed`, `wasFallback`, `responseTimeMs` e passar para a RPC `consume_ai_tokens`.

Migração SQL (única, segura): adicionar parâmetros opcionais à `consume_ai_tokens` com defaults `NULL`/`false` para preencher as novas colunas em `ai_usage_logs`. Função existente continua aceita pelas chamadas antigas (defaults).

---

## ETAPA 4 — Comportamento sem secret

`tryProvider` checa `Deno.env.get(secret_name)` antes de qualquer fetch. Se vazio:
- Não conta como erro de provedor real (sem latência registrada do fetch)
- Marca `error_message = 'secret_not_configured: GEMINI_API_KEY'`
- Dispara fallback automaticamente
- Loga tentativa primária (provider_id do primário, success=false) + log do fallback bem-sucedido

---

## ETAPA 5 — Migração das edge functions

Padrão antes/depois (exemplo `review-insurance-policy`):

Antes:
```ts
const guard = await guardAiCall(req, FEATURE);
if ("err" in guard) return jsonResponse(...);
const ctx = guard.ctx;
const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
  headers: { Authorization: `Bearer ${LOVABLE_API_KEY}` },
  body: JSON.stringify({ model: "google/gemini-2.5-pro", messages, tools, tool_choice }),
});
// parse + registerAiUsage manual
```

Depois:
```ts
const guard = await guardAiCall(req, FEATURE);
if ("err" in guard) return jsonResponse(guard.err.status, guard.err.body);
const ctx = guard.ctx;
const result = await callAi({
  ctx, feature: FEATURE, messages,
  tools: [TOOL],
  toolChoice: { type: "function", function: { name: "review_insurance_vs_fleet" } },
});
if (!result.success) {
  return jsonResponse(result.httpStatus ?? 500, { error: humanizeError(result.errorMessage) });
}
const call = result.data?.choices?.[0]?.message?.tool_calls?.[0];
// resto do parsing igual
```

A edge function não menciona mais provider/model/endpoint/secret. `callAi` faz o `registerAiUsage` internamente em todos os caminhos (sucesso, falha primária, sucesso fallback, falha total) — removemos os `registerAiUsage` espalhados.

Ordem de migração (1 PR = 1 etapa lógica, mas faremos sequencial nesta resposta):
1. extract-document
2. extract-insurance-policy
3. review-insurance-policy

---

## ETAPA 6 — Retrocompatibilidade

- `guardAiCall`: inalterado.
- `extractTokensFromResponse`: mantido (usado se algum chamador ainda quiser fora do router).
- `registerAiUsage`: aceita novos campos opcionais — chamadas existentes continuam funcionando.
- Idempotência por `request_id` mantida (a RPC `consume_ai_tokens` já é idempotente; se houver duas tentativas — primário falha + fallback sucesso — usamos `request_id:1` para a tentativa primária e `request_id` puro para a chamada efetiva, aproveitando o sufixo `callIndex` que já existe).
- Estrutura JSON devolvida ao frontend: idêntica.

---

## ETAPA 7 — Plano de testes

1. **Sem GEMINI_API_KEY** + feature mapeada para `gemini` primário → cai no Lovable, log: 1 entrada com `was_fallback=true`, `error_message` da primária `secret_not_configured: GEMINI_API_KEY`.
2. **Saldo zero** → 402 do `guardAiCall` antes de qualquer provider, log com `source='blocked'`, success=false, sem provider_id.
3. **Idempotência** → mesmo `request_id` repetido: nenhum débito extra, nenhum log duplicado (RPC já garante).

Como hoje os 4 routings ativos apontam para `lovable` como primário (provider priority 10) ou para modelos `gemini-*` da Google, vou validar com `extract-document` (feature `crlv`) após cada migração.

---

## Plano de rollback

- **Granular:** cada edge function migrada permanece auto-suficiente; reverter uma é trocar a chamada `callAi(...)` de volta pelo bloco `fetch(...)` + `registerAiUsage` original. Como manteremos o histórico nos commits, basta revert do arquivo específico.
- **Total:** os arquivos novos (`ai-router.ts`, `providers/*`) podem ser deletados sem afetar nada se as 3 edge functions voltarem ao código antigo.
- **Banco:** a migração SQL apenas adiciona parâmetros opcionais com defaults em `consume_ai_tokens` — não há quebra de assinatura para chamadas antigas, e não afeta dados existentes.
- **Sentinela:** se um provedor novo (ex.: gemini direto) começar a falhar massivamente, basta desativar via `UPDATE ai_providers SET active=false` na tela do super admin que `get_routing_for_feature` para de retorná-lo e o roteamento volta a usar Lovable.

---

## Detalhes técnicos (referência)

- Timeout: 30s via `AbortController`.
- Métricas: `response_time_ms` medido só do `fetch` real (no_secret = 0).
- Logs por chamada (console): `[ai-router] feature=… provider=… status=… ms=… fallback=…`.
- A RPC `get_routing_for_feature` já existe e devolve provider/model/endpoint/secret_name de primary e fallback. Nenhuma migração estrutural nova é necessária além do ALTER da função `consume_ai_tokens`.

Aguardando aprovação para executar.
