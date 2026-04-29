-- 1) Novos campos em fuel_authorizations
ALTER TABLE public.fuel_authorizations
  ADD COLUMN IF NOT EXISTS fuel_station_id uuid,
  ADD COLUMN IF NOT EXISTS km_photo_url text,
  ADD COLUMN IF NOT EXISTS plate_photo_url text,
  ADD COLUMN IF NOT EXISTS receipt_photo_url text,
  ADD COLUMN IF NOT EXISTS km_at_request integer,
  ADD COLUMN IF NOT EXISTS plate_recognized text,
  ADD COLUMN IF NOT EXISTS receipt_cnpj text,
  ADD COLUMN IF NOT EXISTS receipt_total numeric,
  ADD COLUMN IF NOT EXISTS receipt_extracted jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS cnpj_match boolean,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;

-- 2) Tabela de itens do cupom (imutáveis pelo motorista após confirmação)
CREATE TABLE IF NOT EXISTS public.fuel_authorization_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  authorization_id uuid NOT NULL REFERENCES public.fuel_authorizations(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_value numeric NOT NULL DEFAULT 0,
  total_value numeric NOT NULL DEFAULT 0,
  is_fuel boolean NOT NULL DEFAULT false,
  fuel_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fuel_authorization_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members view fuel auth items" ON public.fuel_authorization_items;
CREATE POLICY "members view fuel auth items"
  ON public.fuel_authorization_items FOR SELECT
  USING (public.is_company_member(auth.uid(), company_id));

DROP POLICY IF EXISTS "managers write fuel auth items" ON public.fuel_authorization_items;
CREATE POLICY "managers write fuel auth items"
  ON public.fuel_authorization_items FOR ALL
  USING (public.can_manage_fleet(auth.uid(), company_id))
  WITH CHECK (public.can_manage_fleet(auth.uid(), company_id));

-- Permite o próprio solicitante INSERIR itens vindos do cupom (não pode atualizar/deletar depois)
DROP POLICY IF EXISTS "requester insert items on confirm" ON public.fuel_authorization_items;
CREATE POLICY "requester insert items on confirm"
  ON public.fuel_authorization_items FOR INSERT
  WITH CHECK (
    public.is_company_member(auth.uid(), company_id)
    AND EXISTS (
      SELECT 1 FROM public.fuel_authorizations a
      WHERE a.id = authorization_id
        AND a.requested_by = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_fuel_auth_items_auth ON public.fuel_authorization_items(authorization_id);

-- 3) Bucket para fotos de abastecimento (KM, placa, cupom)
INSERT INTO storage.buckets (id, name, public)
VALUES ('fuel-photos', 'fuel-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "fuel-photos public read" ON storage.objects;
CREATE POLICY "fuel-photos public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'fuel-photos');

DROP POLICY IF EXISTS "fuel-photos auth upload" ON storage.objects;
CREATE POLICY "fuel-photos auth upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'fuel-photos' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "fuel-photos auth update" ON storage.objects;
CREATE POLICY "fuel-photos auth update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'fuel-photos' AND auth.uid() IS NOT NULL);