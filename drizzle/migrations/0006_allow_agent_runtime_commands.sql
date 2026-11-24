GRANT INSERT (company_id, pending_command) ON public.agent_runtime_status TO authenticated;
CREATE POLICY "company admins create agent command state" ON public.agent_runtime_status
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), company_id, 'admin'));
