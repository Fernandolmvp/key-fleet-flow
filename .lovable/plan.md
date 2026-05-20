# Diagnóstico: emails de confirmação não chegam

## Causa raiz identificada

O projeto **NÃO usa Resend direto** — usa **Lovable Emails** (infra gerenciada que internamente roteia para Resend). O hook `auth-email-hook` já está implementado, deployado e usando a fila pgmq corretamente. O problema é puramente de **DNS**.

**Evidências coletadas:**

| Verificação | Resultado |
|---|---|
| Status do domínio `notify.frotaops.com.br` | ⏳ **Pending — DNS não verificado** |
| Logs da edge `auth-email-hook` (48h) | **Nenhum log** — função nunca foi invocada |
| Logs da edge `process-email-queue` (48h) | **Nenhum log** |
| Registros em `email_send_log` | **0 linhas no total** — nenhum email chegou a ser enfileirado |
| Tentativas de signup nos logs do Auth | Várias (ex: `claytonroza20@gmail.com` em 2026-05-20 18:13 retornou 200) |

**Conclusão:** O Supabase Auth está recebendo os signups (retorna 200), mas como o domínio de envio está pendente de verificação DNS, o hook customizado não chega a ser disparado pelo backend de email da Lovable Cloud. Sem DNS verificado, **nenhum email transacional sai** — nem auth, nem app emails.

## O que NÃO é o problema

- ❌ Não é bug na edge function (`auth-email-hook` está correta, usa fila + retry automático via `process-email-queue`)
- ❌ Não é falta de `RESEND_API_KEY` (Lovable Emails gerencia credenciais, não há Resend direto)
- ❌ Não é limite de plano estourado (0 emails enviados no período)
- ❌ Não é template quebrado (templates `signup`, `recovery`, `magic-link`, etc. já existem em `_shared/email-templates/`)
- ❌ Não é hook não registrado (está registrado e configurado em `supabase/config.toml`)

A retry automática (até 5 tentativas) e o log detalhado em `email_send_log` **já estão implementados** pela infra de fila — não precisam ser adicionados.

## Plano de correção

### Passo 1 — Verificar DNS (única ação necessária)

O domínio `notify.frotaops.com.br` precisa ter os registros NS apontando para os nameservers da Lovable. Abrir a tela de Email para ver os registros exatos a configurar:

- **Cloud → Emails → Manage Domains → `notify.frotaops.com.br`**
- Copiar os 2 registros NS exibidos (algo como `ns3.lovable.cloud` / `ns4.lovable.cloud`)
- Adicioná-los no painel do registrador do `frotaops.com.br` (Registro.br, Cloudflare, GoDaddy, etc.) como:
  ```
  Tipo: NS    Nome: notify    Valor: ns3.lovable.cloud
  Tipo: NS    Nome: notify    Valor: ns4.lovable.cloud
  ```
- Propagação: até 72h (geralmente 15min–2h)
- Clicar em **Verify Domain** após adicionar

Enquanto isso estiver pendente, nenhum email transacional sai — não há workaround no código.

### Passo 2 — Ajustes opcionais (só se você quiser, após DNS ok)

Posso customizar o template `signup.tsx`:
- Assunto explícito: "Confirme seu email - FrotaOps"
- Reply-to: `contato@frotaops.com.br`
- Logo + botão grande

Mas isso é cosmético. O bloqueador é exclusivamente DNS.

### Passo 3 — Teste pós-DNS

Após status virar `active`, disparar signup real com `nandovolpi.jb@gmail.com` e validar:
```sql
select status, recipient_email, error_message, created_at
from email_send_log
where recipient_email = 'nandovolpi.jb@gmail.com'
order by created_at desc;
```

## Resumo executivo

**Causa raiz:** DNS do subdomínio `notify.frotaops.com.br` não verificado → backend bloqueia todo envio.
**O que preciso que você faça manualmente:** adicionar 2 registros NS no registrador do domínio (passo 1 acima).
**O que eu faço depois que DNS estiver verde:** ajustar template (assunto/reply-to/logo) se quiser, e rodar teste real.

Confirma que posso implementar os ajustes cosméticos no template enquanto você resolve o DNS?
