-- Policies explícitas para tabelas que hoje estão com RLS habilitada sem policies.
-- Ambas são populadas exclusivamente por Edge Functions usando service role
-- (que bypassa RLS). As policies abaixo apenas formalizam o acesso de leitura
-- para usuários autenticados quando faz sentido, sem alterar o fluxo atual.

-- driver_onboarding_attempts: log de tentativas de onboarding (CPF + IP).
-- Mantém INSERT/SELECT restritos: somente service role escreve;
-- super admins podem auditar.
CREATE POLICY "service-only insert onboarding attempts"
  ON public.driver_onboarding_attempts
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (false);

CREATE POLICY "super admin reads onboarding attempts"
  ON public.driver_onboarding_attempts
  FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- work_order_sequences: tabela técnica usada pelo trigger tg_wo_set_os_number
-- (SECURITY DEFINER) para gerar OS-YYYY-NNNN. Não é escrita pelo app.
-- Leitura liberada para membros da empresa (útil para debug/relatórios).
CREATE POLICY "members read own company wo sequences"
  ON public.work_order_sequences
  FOR SELECT
  TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "no direct writes to wo sequences"
  ON public.work_order_sequences
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY "no direct updates to wo sequences"
  ON public.work_order_sequences
  FOR UPDATE
  TO authenticated
  USING (false);