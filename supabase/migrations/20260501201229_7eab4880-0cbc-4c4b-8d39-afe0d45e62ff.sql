
-- =========================================================================
-- 1) Remove policy duplicada/insegura em plans
-- =========================================================================
DROP POLICY IF EXISTS "anyone can read plans" ON public.plans;
-- A policy "anyone reads active plans" continua ativa e correta
-- (mostra apenas planos ativos para usuários comuns, todos para super admin)

-- =========================================================================
-- 2) Corrige policy frágil em user_roles
-- A antiga tinha auto-referência (company_id = company_id) sempre verdadeira.
-- A nova permite o INSERT apenas quando:
--  - o user_id é o próprio usuário autenticado, E
--  - a empresa em questão ainda não tem nenhum membro (bootstrap inicial)
-- =========================================================================
DROP POLICY IF EXISTS "self bootstrap admin role" ON public.user_roles;

CREATE POLICY "self bootstrap admin role"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.company_id = user_roles.company_id
  )
);

-- =========================================================================
-- 3) Padroniza enum em driver_status_history
-- Hoje os campos são TEXT; converte para o enum driver_status.
-- =========================================================================
ALTER TABLE public.driver_status_history
  ALTER COLUMN previous_status TYPE public.driver_status
    USING (CASE WHEN previous_status IS NULL OR previous_status = ''
                THEN NULL
                ELSE previous_status::public.driver_status END),
  ALTER COLUMN new_status TYPE public.driver_status
    USING (new_status::public.driver_status);
