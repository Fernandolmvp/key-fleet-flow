-- Documentos: enums, tabela, bucket, policies

CREATE TYPE public.document_entity AS ENUM ('vehicle','driver');
CREATE TYPE public.document_status AS ENUM ('valido','vencendo','vencido','sem_validade');
CREATE TYPE public.document_type AS ENUM (
  'crlv','ipva','licenciamento','seguro','rastreador','laudo_veiculo','outro_veiculo',
  'cnh','exame_medico','exame_toxicologico','curso_mopp','curso_transporte_passageiros','outro_motorista'
);

CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  entity_type public.document_entity NOT NULL,
  entity_id uuid NOT NULL,
  doc_type public.document_type NOT NULL,
  title text,
  document_number text,
  issuer text,
  issue_date date,
  expires_at date,
  status public.document_status NOT NULL DEFAULT 'sem_validade',
  file_url text,
  file_name text,
  mime_type text,
  ai_extracted jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_validation jsonb NOT NULL DEFAULT '{}'::jsonb,
  validation_warning text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_company ON public.documents(company_id);
CREATE INDEX idx_documents_entity ON public.documents(entity_type, entity_id);
CREATE INDEX idx_documents_expires ON public.documents(expires_at);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view documents" ON public.documents
  FOR SELECT USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "managers write documents" ON public.documents
  FOR ALL USING (public.can_manage_fleet(auth.uid(), company_id))
  WITH CHECK (public.can_manage_fleet(auth.uid(), company_id));

-- Trigger updated_at
CREATE TRIGGER tg_documents_updated_at BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Trigger para calcular status com base no expires_at
CREATE OR REPLACE FUNCTION public.tg_documents_compute_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE days_left int;
BEGIN
  IF NEW.expires_at IS NULL THEN
    NEW.status := 'sem_validade';
  ELSE
    days_left := (NEW.expires_at - CURRENT_DATE);
    IF days_left < 0 THEN NEW.status := 'vencido';
    ELSIF days_left <= 30 THEN NEW.status := 'vencendo';
    ELSE NEW.status := 'valido';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER tg_documents_status BEFORE INSERT OR UPDATE OF expires_at ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.tg_documents_compute_status();

-- Bucket privado para fotos de documentos
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "members view document files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documents' AND
    public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "managers upload document files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'documents' AND
    public.can_manage_fleet(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "managers update document files" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'documents' AND
    public.can_manage_fleet(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "managers delete document files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'documents' AND
    public.can_manage_fleet(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );