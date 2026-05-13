
## Objetivo
Adicionar busca automática de endereço por CEP (ViaCEP) em todos os formulários do sistema que têm campos de endereço, com hook + componente reutilizáveis.

## Estado atual
Hoje **nenhum** formulário possui campo CEP. Os formulários de endereço usam apenas:
- `address` (texto livre, "Rua, número, bairro")
- `city`, `state` (separados em alguns)

Tabelas afetadas no banco:
- `companies` (address, city, state) — usado em `CompanyTab.tsx`
- `drivers` (address) — usado em `Drivers.tsx`
- `fuel_stations` (address, city, state) — usado em `FuelStations.tsx`
- `insurance_brokers` (address) — usado em `Brokers.tsx`
- `branches` (a confirmar — tabela ainda não está em formulário ativo)

Não existe coluna `cep` em nenhuma dessas tabelas.

## Etapa 1 — Migration (ADD COLUMN nullable)
```sql
ALTER TABLE public.companies          ADD COLUMN IF NOT EXISTS cep text, ADD COLUMN IF NOT EXISTS neighborhood text;
ALTER TABLE public.drivers            ADD COLUMN IF NOT EXISTS cep text, ADD COLUMN IF NOT EXISTS city text, ADD COLUMN IF NOT EXISTS state text, ADD COLUMN IF NOT EXISTS neighborhood text;
ALTER TABLE public.fuel_stations      ADD COLUMN IF NOT EXISTS cep text, ADD COLUMN IF NOT EXISTS neighborhood text;
ALTER TABLE public.insurance_brokers  ADD COLUMN IF NOT EXISTS cep text, ADD COLUMN IF NOT EXISTS city text, ADD COLUMN IF NOT EXISTS state text, ADD COLUMN IF NOT EXISTS neighborhood text;
-- branches só se a tabela existir
```
Tudo nullable, nada destrutivo. Campos existentes continuam funcionando inalterados.

## Etapa 2 — Hook `src/hooks/useCepLookup.ts`
- `lookup(cep: string)` → valida 8 dígitos numéricos
- Cache em memória (`Map<string, ViaCepResult>`)
- Timeout 3s via `AbortController`
- Retorno: `{ data, loading, error, lookup }`
- Tipo: `{ logradouro, bairro, localidade, uf, cep }` (campos da ViaCEP)
- Trata: CEP inválido, `{erro: true}`, falha de rede

## Etapa 3 — Componente `src/components/forms/CepInput.tsx`
Props:
```ts
{
  value: string;
  onChange: (cep: string) => void;
  onAddressFound?: (a: { street: string; neighborhood: string; city: string; uf: string }) => void;
  nextFieldRef?: React.RefObject<HTMLInputElement>; // foco no número
  label?: string;
}
```
Comportamento:
- Máscara `00000-000` automática
- Debounce 500ms
- Busca automática quando completa 8 dígitos
- Estados visuais: idle / loading (spinner à direita) / success (✓ verde) / error (✕ destrutivo + tooltip)
- `toast.success("Endereço encontrado")` discreto
- Foco automático em `nextFieldRef` após sucesso
- Campos preenchidos permanecem editáveis (componente só dispara callback)

```text
┌─────────────────────────────┐
│ CEP                         │
│ [01310-100        ] [✓]     │  ← sucesso
│ [01310-1          ] [⟳]     │  ← buscando (8 dígitos)
│ [00000-000        ] [✕]     │  ← não encontrado
└─────────────────────────────┘
```

## Etapa 4 — Integração nos formulários
Em cada um: adicionar `<CepInput>` antes do bloco de endereço; o `onAddressFound` preenche `street/neighborhood/city/state` no estado local; campos seguem editáveis.

| Formulário | Arquivo | Campos preenchidos |
|---|---|---|
| Empresa | `pages/app/configuracoes/CompanyTab.tsx` | address (rua), neighborhood, city, state |
| Motorista | `pages/app/Drivers.tsx` (form principal) | address, neighborhood, city, state |
| Posto | `pages/app/FuelStations.tsx` (dialog) | address, neighborhood, city, state |
| Corretora | `pages/app/Brokers.tsx` (dialog) | address, neighborhood, city, state |

`address` continua sendo um único campo livre — pré-preenchemos com `logradouro` da ViaCEP e o usuário acrescenta número manualmente. Adicionamos um campo separado **Bairro** (novo) ao lado.

Filiais (branches) e proprietário do veículo: hoje não há formulário ativo desses no UI; ficam fora do escopo desta entrega (o componente já estará pronto para reuso quando essas telas existirem).

## Etapa 5 — Testes manuais
- 01310-100 → preenche Av. Paulista, Bela Vista, São Paulo, SP
- 13075-000 → preenche Campinas
- 00000-000 → erro "CEP não encontrado"
- 0131 → não dispara busca
- 01310100 (sem hífen) → aceita e busca

## Plano de rollback
1. Reverter integrações nos 4 formulários (pequenas seções de JSX/state)
2. Remover `src/hooks/useCepLookup.ts` e `src/components/forms/CepInput.tsx`
3. Migration reversa opcional (colunas são nullable, podem permanecer sem efeito):
   ```sql
   ALTER TABLE public.companies         DROP COLUMN IF EXISTS cep, DROP COLUMN IF EXISTS neighborhood;
   ALTER TABLE public.drivers           DROP COLUMN IF EXISTS cep, DROP COLUMN IF EXISTS neighborhood;
   ALTER TABLE public.fuel_stations     DROP COLUMN IF EXISTS cep, DROP COLUMN IF EXISTS neighborhood;
   ALTER TABLE public.insurance_brokers DROP COLUMN IF EXISTS cep, DROP COLUMN IF EXISTS neighborhood;
   ```

## Garantias de não-quebra
- Migration apenas ADD COLUMN nullable
- Nenhum campo obrigatório novo
- API ViaCEP sem chave, sem custo, sem secrets
- Falha de rede não bloqueia formulário (catch + toast)
- Formulários continuam salvando mesmo se usuário ignorar o CEP
