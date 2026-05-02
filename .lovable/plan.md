## Problema

Ao confirmar o cupom no app do motorista, o trigger `tg_fuel_auth_require_record_on_use` lança o erro:

> Autorização ... não pode ser marcada como utilizada sem registro de abastecimento vinculado

### Causa raiz

Em `src/pages/app/Colaborador.tsx` (função `confirmAuth`), a ordem das operações está invertida:

1. Faz `UPDATE fuel_authorizations SET status='utilizada'` (linhas 272-276)
2. **Só depois** insere em `fuel_records` (linha 298)

O trigger valida no passo 1 e bloqueia, porque ainda não existe `fuel_record_id` vinculado. O trigger `trg_fuel_record_sync_auth`, que faz o vínculo automático, só rodaria após o INSERT em `fuel_records` — mas nunca é alcançado.

Há também um caso edge: se litros/valor não estiverem preenchidos, o status seria marcado como `utilizada` sem nenhum `fuel_record`, deixando a autorização órfã.

## Correção

Reorganizar `confirmAuth` em `src/pages/app/Colaborador.tsx` para inverter a ordem:

1. **Validar primeiro** que litros e valor unitário foram informados pelo motorista. Se não, bloquear a confirmação com mensagem clara (sem alterar status).
2. **Atualizar a autorização SEM mudar status ainda** — apenas com os dados do cupom (foto, CNPJ, total, extracted, confirmed_at).
3. **Inserir em `fuel_records`** com `authorization_id`. O trigger `trg_fuel_record_sync_auth` cuida automaticamente de:
   - vincular `fuel_record_id` na autorização
   - mudar `status` para `utilizada`
   - preencher `used_at` / `confirmed_at`
4. Se CNPJ não bate (anomalia), seguir caminho separado: marcar status `pendente` com nota da anomalia e **não criar** `fuel_record`. Essa transição (`aprovada → pendente`) não dispara o trigger de exigência de record.
5. Inserir os `fuel_authorization_items` depois do sync, para histórico de auditoria.

### Fluxo final

```text
[motorista envia cupom]
        |
        v
  validar litros+valor preenchidos -> NÃO -> erro "informe litros e valor"
        |
        v
  IA extrai cupom + valida CNPJ
        |
   +----+----+
   |         |
CNPJ ok   CNPJ divergente
   |         |
   v         v
INSERT     UPDATE auth: status=pendente
fuel_record + nota de anomalia
+ auth_id   (sem fuel_record)
   |
   v
trigger sync: auth.status=utilizada,
              fuel_record_id vinculado
   |
   v
INSERT items (histórico)
```

## Arquivos

- `src/pages/app/Colaborador.tsx` — refatorar `confirmAuth` (apenas reorganização da ordem; sem mudança de schema/triggers).

Nenhuma migração de banco é necessária — os triggers já estão corretos, é o código frontend que precisa respeitar a ordem que eles esperam.