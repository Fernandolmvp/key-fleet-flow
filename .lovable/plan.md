## Objetivo

Vincular veículos e apólices considerando que a placa antiga (`AAA-9999`) e a Mercosul (`AAA9A99`) podem representar o **mesmo carro**. O cruzamento passa a usar 3 critérios em paralelo: **placa normalizada**, **chassi** (exato ou últimos 8) e **RENAVAM**.

Boa notícia: `vehicles` já tem `chassis` e `renavam`. Não precisa adicionar essas colunas.

## Migration (nova)

`supabase/migrations/<timestamp>_normalize_plate_matching.sql`

```sql
-- 1. Normalizador (SECURITY DEFINER, IMMUTABLE)
create or replace function public.normalize_plate(p text)
returns text
language plpgsql
immutable
security definer
set search_path = public
as $$
declare
  s text;
  c char;
  m text;
begin
  if p is null then return null; end if;
  s := upper(regexp_replace(p, '[^A-Za-z0-9]', '', 'g'));
  if length(s) <> 7 then
    return s;                       -- devolve o que tiver, sem inventar
  end if;
  -- já é Mercosul (5º char é letra)?
  if substring(s,5,1) ~ '[A-Z]' then
    return s;
  end if;
  -- antiga AAA9999 -> AAA9A99 (5º dígito vira letra: 0->A..9->J)
  if s ~ '^[A-Z]{3}[0-9]{4}$' then
    c := substring(s,5,1);
    m := chr(ascii('A') + (c::int));
    return substring(s,1,4) || m || substring(s,6,2);
  end if;
  return s;
end
$$;

-- 2. Coluna gerada em vehicles
alter table public.vehicles
  add column if not exists normalized_plate text
  generated always as (public.normalize_plate(plate)) stored;

create index if not exists idx_vehicles_normalized_plate
  on public.vehicles (company_id, normalized_plate);
create index if not exists idx_vehicles_renavam
  on public.vehicles (company_id, renavam);

-- 3. Match: apólices que cobrem um veículo (cruza por placa norm/chassi/renavam
--    direto no JSONB ai_extracted das apólices ativas + vínculos manuais)
create or replace function public.match_policies_for_vehicle(_vehicle_id uuid)
returns table (
  policy_id uuid,
  match_by  text         -- 'plate' | 'chassis' | 'renavam' | 'link'
)
language sql
stable
security definer
set search_path = public
as $$
  with v as (
    select id, company_id, normalized_plate,
           upper(regexp_replace(coalesce(chassis,''), '[^A-Za-z0-9]', '', 'g')) as chs,
           regexp_replace(coalesce(renavam,''), '[^0-9]', '', 'g') as rnv
    from public.vehicles where id = _vehicle_id
  ),
  ai as (
    select p.id as policy_id, av.*
    from public.insurance_policies p, v,
         lateral jsonb_array_elements(coalesce(p.ai_extracted->'vehicles','[]'::jsonb)) as a(elem)
    cross join lateral (select
      public.normalize_plate(a.elem->>'plate')                                as np,
      upper(regexp_replace(coalesce(a.elem->>'chassis',''),'[^A-Za-z0-9]','','g')) as ch,
      regexp_replace(coalesce(a.elem->>'renavam',''),'[^0-9]','','g')          as rn
    ) av
    where p.company_id = v.company_id
      and p.status = 'ativa'
      and (p.end_date is null or p.end_date >= current_date)
  )
  select policy_id, 'plate'   from ai, v where ai.np is not null and ai.np = v.normalized_plate
  union
  select policy_id, 'chassis' from ai, v where v.chs <> '' and ai.ch <> ''
                                            and (ai.ch = v.chs or right(ai.ch,8) = right(v.chs,8))
  union
  select policy_id, 'renavam' from ai, v where v.rnv <> '' and ai.rn = v.rnv
  union
  select ipv.policy_id, 'link'
    from public.insurance_policy_vehicles ipv
    where ipv.vehicle_id = _vehicle_id and ipv.removed_at is null;
$$;

-- 4. Inverso: dado um veículo "AI" da apólice, achar veículos compatíveis
create or replace function public.match_vehicles_for_ai_plate(
  _company_id uuid, _plate text, _chassis text default null, _renavam text default null
) returns table (vehicle_id uuid, match_by text)
language sql stable security definer set search_path = public as $$
  with t as (
    select public.normalize_plate(_plate) as np,
           upper(regexp_replace(coalesce(_chassis,''),'[^A-Za-z0-9]','','g')) as ch,
           regexp_replace(coalesce(_renavam,''),'[^0-9]','','g') as rn
  )
  select v.id, 'plate'   from public.vehicles v, t
    where v.company_id = _company_id and t.np is not null and v.normalized_plate = t.np
  union
  select v.id, 'chassis' from public.vehicles v, t
    where v.company_id = _company_id and t.ch <> ''
      and upper(regexp_replace(coalesce(v.chassis,''),'[^A-Za-z0-9]','','g'))
          in (t.ch, right(t.ch,8))
  union
  select v.id, 'renavam' from public.vehicles v, t
    where v.company_id = _company_id and t.rn <> ''
      and regexp_replace(coalesce(v.renavam,''),'[^0-9]','','g') = t.rn;
$$;
```

`ai_extracted` continua imutável (a trigger existente bloqueia mudanças). Só adicionamos coluna gerada e funções de leitura.

## Como muda o frontend

Tudo passa a usar `normalize_plate` no cliente (helper TS espelhando a função SQL) **e** chamadas opcionais às funções RPC para confirmar match por chassi/renavam.

`src/lib/plate.ts` (novo, 20 linhas)
```ts
export function normalizePlate(p?: string|null): string {
  if (!p) return "";
  const s = p.toUpperCase().replace(/[^A-Z0-9]/g,"");
  if (s.length !== 7) return s;
  if (/[A-Z]/.test(s[4])) return s;
  if (/^[A-Z]{3}[0-9]{4}$/.test(s)) {
    return s.slice(0,4) + String.fromCharCode(65 + Number(s[4])) + s.slice(5);
  }
  return s;
}
export const normChassis = (c?: string|null) =>
  (c||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
export const normRenavam = (r?: string|null) =>
  (r||"").replace(/[^0-9]/g,"");
```

Arquivos que substituem `normId(plate)` por `normalizePlate(plate)` e adicionam fallback por chassi/renavam:
- `src/components/dashboard/InsurancePanel.tsx` — `smartSearchResults`, `useOrphanPlates`, badge "Vinculado por: placa | chassi | renavam".
- `src/pages/app/insurance/Orphans.tsx` — antes de listar como órfã, descarta placas cujo chassi/renavam bate com algum `vehicles`.
- `src/components/dashboard/VehicleDialog.tsx` — campo **RENAVAM** (já existe coluna), tooltip "Recomendamos preencher chassi e RENAVAM para vinculação automática mesmo se a placa mudar".

Sem mudança em `ai_extracted`, sem alterar `plate` original do usuário.

## Query de busca (resumo)

```ts
const term = normalizePlate(input);     // Mercosul-normalizado
const last8 = normChassis(input).slice(-8);

vehicles.filter(v =>
  v.normalized_plate === term ||
  (normChassis(v.chassis) && normChassis(v.chassis).includes(last8)) ||
  (normRenavam(v.renavam) && normRenavam(v.renavam) === normRenavam(input))
);
```

Para apólices, mesmo critério sobre `ai_extracted.vehicles[*]` (placa, chassi, renavam).

## Casos de teste cobertos

| # | Cenário | Esperado |
|---|---------|----------|
| 1 | veic `ABC-1234` + apólice `ABC1C34` | match por placa (Mercosul) |
| 2 | busca `ABC1234`  | acha veículo + apólice |
| 3 | busca `ABC1C34`  | acha veículo + apólice |
| 4 | veic só com chassi, apólice mesmo chassi placa diferente | match por chassi |
| 5 | match por últimos 8 do chassi | ok |
| 6 | match por RENAVAM | ok |
| 7 | placa parcial via UI | filtro `includes` no campo `normalized_plate` |

## Arquivos alterados

- `supabase/migrations/<ts>_normalize_plate_matching.sql` (novo)
- `src/lib/plate.ts` (novo)
- `src/components/dashboard/InsurancePanel.tsx`
- `src/pages/app/insurance/Orphans.tsx`
- `src/components/dashboard/VehicleDialog.tsx`

## Rollback

- `drop function match_policies_for_vehicle, match_vehicles_for_ai_plate, normalize_plate;`
- `alter table vehicles drop column normalized_plate;`
- Reverter os 4 arquivos do frontend.

Nenhum dado do usuário é tocado; a coluna gerada é derivada de `plate`.
