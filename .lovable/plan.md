# TAREFA 2 — Consumo esperado por veículo

## Contexto verificado
- `vehicles` **não** tem ainda `expected_consumption_kml` nem `consumption_tolerance_pct` ✅
- `fuel_records.km_per_liter` é calculado pelo trigger `tg_fuel_compute` (BEFORE INSERT/UPDATE)
- Enum `fuel_anomaly` atual: `km_regressivo, consumo_alto, consumo_baixo, tanque_excedido, duplicado, valor_atipico, horario_suspeito, cidade_incomum`
- Severities usadas no código: `alta | media | baixa` (mapeadas em `src/lib/fuel.ts → SEVERITY_TONE`). **Vou manter esse padrão** em vez de "alto/médio" pra não quebrar os badges existentes.

## Decisão de arquitetura
Em vez de criar um **AFTER INSERT** novo (que forçaria um 2º UPDATE no mesmo registro), **estendo o trigger BEFORE existente `tg_fuel_compute`** com mais um bloco. Vantagens: 1 só write, anomalia já entra junto com as outras, severity é combinada pela mesma lógica.

---

## 1. Migration SQL (completa)

```sql
-- 1.1 Schema
ALTER TABLE public.vehicles
  ADD COLUMN expected_consumption_kml numeric,
  ADD COLUMN consumption_tolerance_pct numeric DEFAULT 20;

ALTER TABLE public.vehicles
  ADD CONSTRAINT vehicles_expected_kml_positive
    CHECK (expected_consumption_kml IS NULL OR expected_consumption_kml > 0),
  ADD CONSTRAINT vehicles_tolerance_range
    CHECK (consumption_tolerance_pct IS NULL
           OR (consumption_tolerance_pct >= 5 AND consumption_tolerance_pct <= 50));

-- 1.2 Novos valores no enum de anomalias
ALTER TYPE public.fuel_anomaly ADD VALUE IF NOT EXISTS 'consumo_abaixo_esperado';
ALTER TYPE public.fuel_anomaly ADD VALUE IF NOT EXISTS 'consumo_acima_esperado';

-- 1.3 Estender tg_fuel_compute (REPLACE preservando lógica atual + bloco novo
--     no fim, antes de NEW.anomalies := anom)
CREATE OR REPLACE FUNCTION public.tg_fuel_compute()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  prev RECORD; v RECORD; hist RECORD;
  anom public.fuel_anomaly[] := '{}';
  sev TEXT := NULL; hour_local INT;
  expected numeric; tol numeric; deviation numeric;
BEGIN
  -- [bloco existente intacto: prev, km_driven, km_per_liter, cost_per_km,
  --  km_regressivo, duplicado, tanque_excedido, consumo_alto/baixo via histórico,
  --  horario_suspeito, valor_atipico, current_km sync]
  -- ...

  -- NOVO: comparação contra consumo esperado configurado no veículo
  expected := v.expected_consumption_kml;
  tol := COALESCE(v.consumption_tolerance_pct, 20);
  IF expected IS NOT NULL AND expected > 0
     AND NEW.km_per_liter IS NOT NULL AND NEW.km_per_liter > 0 THEN
    deviation := ABS(NEW.km_per_liter - expected) / expected * 100.0;
    IF deviation > tol THEN
      IF NEW.km_per_liter < expected THEN
        anom := array_append(anom, 'consumo_acima_esperado'::public.fuel_anomaly);
      ELSE
        anom := array_append(anom, 'consumo_abaixo_esperado'::public.fuel_anomaly);
      END IF;
      IF deviation > 40 THEN sev := 'alta';
      ELSIF deviation > 20 THEN sev := COALESCE(sev,'media');
      ELSE sev := COALESCE(sev,'baixa');
      END IF;
    END IF;
  END IF;

  NEW.anomalies := anom;
  NEW.anomaly_severity := sev;
  -- ... (current_km sync existente)
END $function$;
```

> Nota semântica: **consumo_acima_esperado** = veículo bebendo mais (km/L menor → custo maior). **consumo_abaixo_esperado** = km/L acima do esperado (bom, mas pode indicar erro de leitura). Vou alinhar labels no frontend de acordo.

## 2. Frontend

### 2.1 `src/lib/fuel.ts`
- Adicionar em `ANOMALY_LABEL`:
  - `consumo_acima_esperado: "Consumo acima do esperado"`
  - `consumo_abaixo_esperado: "Consumo abaixo do esperado"`

### 2.2 `src/components/dashboard/VehicleDialog.tsx`
Nova seção **"Parâmetros de consumo (opcional)"**:
- Input numérico **"Consumo esperado (km/L)"** — `step=0.1`, placeholder "Ex.: 8.5"
- Slider **"Tolerância (%)"** — range 5–50, default 20, label dinâmico "±20%"
- Tooltip (ícone `?`): *"O sistema marca o abastecimento como anômalo se o km/L real desviar mais que esta tolerância do valor esperado."*

### 2.3 `src/pages/app/Fuel.tsx` (já lista anomalias via `Badge` + `SEVERITY_TONE`)
- Os novos valores entram automaticamente na coluna **Alertas** (loop existente).
- **Adição:** quando o registro tiver uma das duas anomalias novas, envolver o badge num `<Tooltip>` mostrando: *"Esperado: X km/L · Real: Y km/L · Desvio: Z%"*. Cálculo client-side usando `vehicles.expected_consumption_kml` (vou trazer no select da query — campo já é seguro por RLS de membership).

## 3. Plano de teste (manual + SQL)

| # | Cenário | Setup | Esperado |
|---|---|---|---|
| 1 | Veículo sem `expected_consumption_kml` | NULL | Nenhuma anomalia nova, comportamento atual preservado |
| 2 | `expected=10`, `tol=20`, real=10.5 | desvio 5% | Sem anomalia |
| 3 | `expected=10`, `tol=20`, real=7.5 | desvio 25% | `consumo_acima_esperado`, severity `media` |
| 4 | `expected=10`, `tol=20`, real=5.5 | desvio 45% | `consumo_acima_esperado`, severity `alta` |
| 5 | `expected=10`, `tol=20`, real=13 | desvio 30% | `consumo_abaixo_esperado`, severity `media` |
| 6 | Primeira abastecida do veículo (sem `prev` → `km_per_liter` NULL) | — | Sem anomalia (guardado por `IF NEW.km_per_liter IS NOT NULL`) |
| 7 | `tol=5%`, real desviando 6% | — | Anomalia leve, severity `baixa` |

Testes 2–5 rodo com `INSERT` real num veículo de teste e depois `DELETE`, OU via simulação chamando `tg_fuel_compute` diretamente em transação rolled-back. Vou preferir dry-run em transação.

## 4. Mockup do alerta visual

```text
Tabela Abastecimentos → coluna "Alertas":

┌────────────────────────────────────┐
│ [⚠ Consumo acima do esperado]      │  ← badge âmbar (bg-warning/20)
│  hover ▼                            │
│  ┌──────────────────────────────┐  │
│  │ Esperado: 10.0 km/L          │  │
│  │ Real:      7.2 km/L          │  │
│  │ Desvio:    28%               │  │
│  └──────────────────────────────┘  │
└────────────────────────────────────┘

Severidade alta (>40%) → badge vermelho (bg-destructive/20)
Severidade média (20–40%) → âmbar
Severidade baixa (≤20%, só quando tol<20) → azul (bg-info/20)
```

VehicleDialog (nova seção):

```text
─── Parâmetros de consumo (opcional) ─────────────────
Consumo esperado (km/L)   [   8.5   ] (?)
Tolerância                ●━━━━━━━━━━━━○  ±20%
                          5%          50%
─────────────────────────────────────────────────────
```

## 5. Casos de exceção tratados
- `expected_consumption_kml IS NULL` → bloco inteiro pulado (zero impacto em quem não configurar)
- `km_per_liter IS NULL` (1ª abastecida) → bloco pulado
- `km_per_liter <= 0` → bloco pulado
- `consumption_tolerance_pct` NULL → assume 20 via COALESCE
- CHECK constraints garantem que valores inválidos nunca entram

## Aguardando aprovação
Confirma e eu executo nesta ordem: (a) migration → (b) `src/lib/fuel.ts` → (c) `VehicleDialog.tsx` → (d) `Fuel.tsx` com tooltip → (e) testes dry-run dos 7 cenários.