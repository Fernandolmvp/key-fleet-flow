# Migração de Auth Emails para Resend

## Visão geral

Vou criar um **Auth Email Hook** customizado que intercepta os 4 tipos de email do Supabase Auth e envia via **Resend** (mesmo gateway já usado em `send-partner-email`). Lovable Emails permanece desabilitado.

> ⚠️ Importante: NÃO vou usar o tooling `scaffold_auth_email_templates` (que é o caminho gerenciado Lovable Emails). Vou criar manualmente porque você optou explicitamente por Resend.

---

## ETAPA 1 — Limpeza preliminar

- Deletar usuário órfão `flvcontabilidade@hotmail.com` da `auth.users` via migration (`DELETE FROM auth.users WHERE email = ...`).
- Verificar se existe registro em `profiles`/`company_members` ligado a esse user_id e limpar se necessário.

## ETAPA 2 — Generalizar email sender

Refatorar `send-partner-email` em **`send-transactional-email`** mantendo retrocompatibilidade:

- Aceita `type`: `'partner_invite' | 'partner_reset' | 'auth_signup' | 'auth_recovery' | 'auth_email_change' | 'auth_magiclink' | 'raw'`
- Para `raw`: usa `{to, subject, html}` (compatível com chamadas atuais)
- Para tipos auth: recebe `{to, data: { confirmation_url, token, ... }}` e renderiza template internamente
- Mantém endpoint `send-partner-email` como **alias** que redireciona internamente para evitar quebrar `partner-invite` e `driver-onboarding`

## ETAPA 3 — Auth Email Hook

Criar **`supabase/functions/auth-email-hook/index.ts`**:

```
POST /auth-email-hook
Headers: webhook-id, webhook-timestamp, webhook-signature (HMAC SHA-256)
Body: { user: {...}, email_data: { token, token_hash, redirect_to, email_action_type, site_url } }
```

Fluxo:
1. Validar assinatura HMAC com `SEND_EMAIL_HOOK_SECRET` (gerado pelo Supabase ao registrar o webhook)
2. Mapear `email_action_type` → template:
   - `signup` → auth_signup
   - `recovery` → auth_recovery
   - `email_change` / `email_change_new` → auth_email_change
   - `magiclink` → auth_magiclink
   - `invite` → tratar como signup
3. Construir `confirmation_url` = `{site_url}/auth/v1/verify?token={token_hash}&type={action}&redirect_to={redirect_to}`
4. Chamar `send-transactional-email` internamente
5. Retornar `200 {}` em sucesso, `4xx/5xx` em erro

Configurar em `supabase/config.toml`:
```toml
[functions.auth-email-hook]
verify_jwt = false
```

**Registro do webhook no Supabase Auth**: Será necessário rodar uma migration ou solicitar via tooling para apontar Auth → `https://<project>.supabase.co/functions/v1/auth-email-hook` e gerar o `SEND_EMAIL_HOOK_SECRET`. Vou tentar via SQL no `auth.config` / `supabase_auth_admin`. Se não for possível via SQL gerenciado, te mostro o passo manual no painel **Cloud → Auth Hooks**.

## ETAPA 4 — Templates HTML (visual FrotaOps escuro)

Estrutura comum:
```
[Header: bg #0a0e1a, logo FrotaOps em gradient azul]
[Body: bg #0f1420, card #151b2e, texto #e5e7eb]
  Olá!
  <Mensagem específica>
  [Botão CTA: gradient azul→roxo, sombra glow]
  Ou copie este link: <url>
[Footer: bg #0a0e1a, "Precisa de ajuda? contato@frotaops.com.br" + LGPD]
```

Conteúdo por tipo:
| Type | Subject | Heading | CTA |
|------|---------|---------|-----|
| signup | "Confirme seu email · FrotaOps" | "Bem-vindo à FrotaOps" | "Confirmar email" |
| recovery | "Redefinir sua senha · FrotaOps" | "Vamos redefinir sua senha" | "Redefinir senha" |
| email_change | "Confirme seu novo email · FrotaOps" | "Confirmação de novo email" | "Confirmar novo email" |
| magiclink | "Seu link de acesso · FrotaOps" | "Acesse sua conta" | "Entrar agora" |

Templates como funções TS retornando string HTML (sem React Email — mais simples e leve).

## ETAPA 5 — "Esqueci minha senha" (empresa)

Atualmente o reset existe apenas para **motorista** (via `driver-onboarding`). Vou adicionar para conta empresa:

- No `Login.tsx` aba **Empresa**, adicionar link "Esqueci minha senha"
- Modal pede email → `supabase.auth.resetPasswordForEmail(email, { redirectTo: '${origin}/reset-password' })`
- Mensagem neutra: "Se o email existir, enviaremos instruções em alguns minutos"
- `/reset-password` já existe e funciona com o token PKCE

## ETAPA 6 — Teste end-to-end

1. Após deploy, criar conta com `nandovolpi.jb@gmail.com`
2. Verificar logs em `auth-email-hook` e `send-transactional-email`
3. Confirmar email chega via Resend (vou ler logs `email_send_log` se existir, ou apenas logs da function)
4. Clicar no link → deve cair em `/welcome` ou rota equivalente
5. Testar "esqueci senha" da empresa
6. Te mostrar status final + IDs Resend

## Rollback

Se algo falhar:
1. Reverter migration que registra o webhook (Auth volta a usar default Lovable)
2. Manter `send-transactional-email` (não quebra nada — é aditivo)
3. Hook fica deployed mas inativo (sem webhook configurado, não é chamado)

---

## Estrutura de arquivos

```
supabase/functions/
  auth-email-hook/
    index.ts              [novo]
  send-transactional-email/
    index.ts              [novo - generalização]
    templates.ts          [novo - 4 templates auth + partner]
  send-partner-email/
    index.ts              [mantido como alias retrocompatível]

src/pages/auth/Login.tsx  [adicionar reset senha empresa]

supabase/migrations/
  YYYYMMDD_delete_orphan_user.sql
  YYYYMMDD_register_auth_email_hook.sql  [se possível via SQL]
```

## Secrets

- `RESEND_API_KEY` ✅ já existe
- `LOVABLE_API_KEY` ✅ já existe
- `SEND_EMAIL_HOOK_SECRET` ⚠️ será gerado quando registrar o webhook — vou pedir pra você adicionar via tooling de secrets se necessário

---

**Confirma que posso executar?** Vou mostrar resultado de cada etapa antes da próxima (limpeza → hook+templates → reset empresa → teste).
