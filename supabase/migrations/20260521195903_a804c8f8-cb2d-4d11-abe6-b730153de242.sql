
CREATE OR REPLACE FUNCTION public.tg_leads_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT,
  email TEXT,
  telefone TEXT,
  empresa TEXT,
  cnpj TEXT,
  quantidade_veiculos TEXT,
  maior_dor TEXT,
  origem TEXT NOT NULL DEFAULT 'OUTRO' CHECK (origem IN ('CAL_COM','WHATSAPP','FORMULARIO_DIRETO','OUTRO')),
  status TEXT NOT NULL DEFAULT 'NOVO' CHECK (status IN ('NOVO','CONTATADO','EM_NEGOCIACAO','CONVERTIDO','PERDIDO')),
  cal_booking_id TEXT,
  converted_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_origem ON public.leads(origem);
CREATE INDEX idx_leads_created_at ON public.leads(created_at DESC);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin full access to leads"
  ON public.leads FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Anyone can insert leads"
  ON public.leads FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE TRIGGER trg_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_leads_set_updated_at();
