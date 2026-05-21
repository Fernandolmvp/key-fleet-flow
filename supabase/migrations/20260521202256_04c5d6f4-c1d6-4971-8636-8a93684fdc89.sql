
-- Extend leads constraints to include new origem ('INDICACAO') and status ('DEMO_AGENDADA') values
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_origem_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_origem_check
  CHECK (origem = ANY (ARRAY['CAL_COM','WHATSAPP','FORMULARIO_DIRETO','INDICACAO','OUTRO']));

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_status_check
  CHECK (status = ANY (ARRAY['NOVO','CONTATADO','DEMO_AGENDADA','EM_NEGOCIACAO','CONVERTIDO','PERDIDO']));
