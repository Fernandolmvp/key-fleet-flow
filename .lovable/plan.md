## Inverter roteamento Gemini ↔ Lovable em todas as 11 features

### Estado atual (confirmado via SELECT)

11 linhas ativas em `ai_feature_routing`. Todas têm:
- **Primário** = provider `gemini` (API direta)
- **Fallback** = provider `lovable` (gateway)

Mapeamento dos modelos envolvidos:

| Model ID (UUID)                          | Provider | model_id              |
|------------------------------------------|----------|-----------------------|
| `fd46d44e-1234-4c0b-beef-980085fd5b3e`   | gemini   | gemini-2.5-flash      |
| `bfc3760b-27f5-4682-998d-e7346dc0fa4f`   | lovable  | google/gemini-2.5-flash |
| `d8c52cb6-9d08-4b7f-9ecd-147933549487`   | gemini   | gemini-2.5-pro        |
| `380659c3-d32d-4317-bf4c-47e8dc794685`   | lovable  | google/gemini-2.5-pro |

Distribuição:
- **9 features** usam o par flash (`cnh`, `crlv`, `cupom_fiscal`, `documento_generico`, `extract_document`, `leitura_hodometro`, `leitura_placa`, `nota_manutencao`, `nota_pneu`)
- **2 features** usam o par pro (`extract_insurance_policy`, `review_insurance_policy`)

### SQL que será executado (1 statement, atômico)

```sql
UPDATE public.ai_feature_routing
SET
  primary_model_id = fallback_model_id,
  fallback_model_id = primary_model_id,
  updated_at = now()
WHERE active = true
  AND fallback_model_id IS NOT NULL
  AND (
    (primary_model_id = 'fd46d44e-1234-4c0b-beef-980085fd5b3e'
     AND fallback_model_id = 'bfc3760b-27f5-4682-998d-e7346dc0fa4f')
    OR
    (primary_model_id = 'd8c52cb6-9d08-4b7f-9ecd-147933549487'
     AND fallback_model_id = '380659c3-d32d-4317-bf4c-47e8dc794685')
  );
```

Por que esse formato: o swap `primary ↔ fallback` é literalmente trocar os dois UUIDs entre si. O filtro extra garante que só atinge os pares Gemini-direto ↔ Lovable correspondentes (evita afetar qualquer linha que já esteja em outra configuração ou que venha a ser criada no futuro com modelos diferentes).

**Linhas afetadas:** 11 (9 do par flash + 2 do par pro), conforme SELECT acima.

### Estado final esperado (preview)

Todas as 11 features ficarão:

| Feature                      | Primário (após)              | Fallback (após)             |
|------------------------------|------------------------------|-----------------------------|
| cnh, crlv, cupom_fiscal, documento_generico, extract_document, leitura_hodometro, leitura_placa, nota_manutencao, nota_pneu | **lovable** · google/gemini-2.5-flash | **gemini** · gemini-2.5-flash |
| extract_insurance_policy, review_insurance_policy | **lovable** · google/gemini-2.5-pro   | **gemini** · gemini-2.5-pro   |

### Validação pós-execução

Vou rodar o mesmo SELECT do diagnóstico inicial para confirmar que `primary_provider = 'lovable'` e `fallback_provider = 'gemini'` em todas as 11 linhas.

### Impacto no sistema

- O `ai-router.ts` lê routing via RPC `get_routing_for_feature` — efeito imediato na próxima chamada, sem deploy.
- Como `LOVABLE_API_KEY` e `GEMINI_API_KEY` estão configurados, ambos os caminhos funcionam.
- Custo passa a debitar **créditos do plano Lovable** primeiro (em vez da quota Gemini direta).

### Teste sugerido após swap

Subir um documento simples (CNH ou CRLV) na tela de Documentos. No log esperado:
- `[ai-router] primary:start { provider: "lovable", model: "google/gemini-2.5-flash" }`
- `[ai-router] primary:done { ok: true }`
- Em `ai_usage_logs` a linha deve sair com `provider_id` = id do provider Lovable e `was_fallback = false`.

### Rollback

Se algo der errado, basta rodar o mesmo UPDATE de novo (o swap é simétrico — duas execuções voltam ao estado original).

### Aprovação

Aprove para eu executar o UPDATE via tool de dados (não-migração, pois é alteração de dados, não de schema).