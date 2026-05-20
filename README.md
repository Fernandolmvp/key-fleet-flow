# FrotaOps

## ⚠️ AVISO TEMPORÁRIO — Confirmação de email DESABILITADA

A confirmação de email (`auto_confirm_email = true`) está **desabilitada** no Supabase Auth enquanto o domínio `notify.frotaops.com.br` não está verificado (bloqueado pelo Registro.br por não aceitar NS em subdomínio).

**Religar quando:**
1. DNS migrado para Cloudflare
2. Subdomínio `notify.frotaops.com.br` verificado em Cloud → Emails
3. Teste real de envio bem-sucedido

**Como religar:** chamar `supabase--configure_auth` com `auto_confirm_email: false`, ou via UI do Cloud → Users → Auth Settings → desativar "Auto-confirm email".

Enquanto isso, novos clientes são criados manualmente pelo Super Admin em `/super-admin/empresas/nova` (gera senha temporária, email já vem confirmado).
