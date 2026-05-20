
# Fix: "User already registered" + auto-recuperação de cadastro travado

## Causa raiz
Quando o cliente faz signup, o fluxo do `Signup.tsx` executa 2 passos sequenciais:
1. `supabase.auth.signUp()` — cria o usuário em `auth.users`
2. `supabase.rpc("bootstrap_company_v2")` — cria empresa, membership, role, profile, subscription

Se o passo 2 falhar (erro de rede, RPC, CNPJ duplicado, sessão ainda não propagada), o usuário fica **órfão**: existe em `auth.users` mas não tem empresa. Na próxima tentativa, o `signUp` retorna `422 user_already_exists` e a UX só mostra a mensagem crua, sem caminho de saída.

Caso real confirmado no banco: `claytonroza20@gmail.com` (criado 13/mai, email confirmado, 0 memberships, 0 roles).

## Solução

### 1. Recuperação automática no `Signup.tsx`
Quando `signUp` retornar erro de "usuário já existe":
- Tentar `signInWithPassword` com o email + senha digitados no formulário.
- Se o login funcionar:
  - Verificar se o usuário já tem `company_members`. Se já tiver, redirecionar pra `/app` (mensagem "Você já tem conta, te conectamos").
  - Se NÃO tiver, executar o mesmo fluxo de bootstrap (`bootstrap_company_v2` + cupom) — é exatamente o cenário do Clayton. Resultado: ele entra no sistema com a base zerada da empresa nova dele.
- Se o login falhar (senha diferente da que ele usou antes):
  - Mostrar mensagem clara: "Já existe uma conta com este email. Se for sua, [Entrar](/login) ou [Recuperar senha](/login)."

### 2. Mensagens de erro mais claras
Substituir `toast.error(error.message)` (que mostra "User already registered" em inglês) por mensagens em português que orientam a próxima ação.

### 3. Recuperação manual do Clayton (caso pontual)
Como ele já está travado e talvez não lembre a senha que digitou no signup original, oferecer 2 caminhos:
- **Opção A (recomendada):** orientar Clayton a ir em `/login` → "Esqueci minha senha", redefinir, e ao logar o app detecta que ele não tem empresa e dispara um **onboarding de empresa** (nova tela, descrita abaixo).
- **Opção B:** você (Super Admin) usa a tela "Criar empresa" que já existe — mas o email dele já está em `auth.users`, então a função `admin-create-company-manual` falharia no `createUser`. Precisaria de uma variante que aceita "usuário existente sem empresa" e só faz o bootstrap.

### 4. Tela de onboarding para usuários órfãos
Hoje, se um usuário logado não tem empresa, o app pode travar ou redirecionar de forma confusa. Vou adicionar uma rota `/onboarding/empresa` que:
- Detecta `user && companies.length === 0` no `AuthContext`.
- Mostra o mesmo formulário (empresa + cupom) do signup, mas sem os campos de auth.
- Chama `bootstrap_company_v2` + cupom direto.
- Redireciona pra `/app`.

Isso fecha o loop pra qualquer caso futuro de bootstrap parcial e resolve o Clayton sem migration manual.

## Arquivos afetados

- `src/pages/auth/Signup.tsx` — adicionar fallback de `signInWithPassword` + bootstrap quando `signUp` falhar com `user_already_exists`; mensagens em português.
- `src/pages/auth/OnboardingEmpresa.tsx` (novo) — formulário de empresa+cupom para usuário logado sem empresa.
- `src/App.tsx` — registrar rota `/onboarding/empresa` e, no roteamento autenticado, redirecionar pra ela quando `companies.length === 0`.
- `src/components/auth/RequireAuth.tsx` (verificar) — garantir redirect pra onboarding quando aplicável.

## Fora de escopo (confirmado seguro hoje)
- **Isolamento entre empresas:** as policies RLS já usam `is_company_member(auth.uid(), company_id)`. Validei nos `db-functions` que não há policy permissiva cruzando empresas. Nada vaza — não preciso mexer.
- **Limpeza de dados de tentativa anterior:** o Clayton nunca chegou a criar empresa, então não existe lixo a limpar. A nova empresa nascerá zerada naturalmente via `bootstrap_company_v2`.

## Resultado esperado
1. Clayton vai em `/login` → "Esqueci senha" → redefine → loga → cai no `/onboarding/empresa` → preenche dados + cupom → entra no sistema com empresa nova e base 100% vazia.
2. Qualquer novo cliente cujo bootstrap travar consegue se recuperar sozinho (tentando signup de novo com mesma senha, ou via login + onboarding).
3. Mensagens de erro deixam claro o que fazer.
