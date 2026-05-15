
CREATE TABLE IF NOT EXISTS public.trip_reimbursements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE RESTRICT,

  total_amount numeric(14,2) NOT NULL,
  expense_ids uuid[] NOT NULL DEFAULT '{}',

  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','aprovado','pago','rejeitado')),
  approved_by uuid,
  approved_at timestamptz,
  paid_at date,
  paid_method text,
  payment_proof_url text,

  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tr_trip ON public.trip_reimbursements(trip_id);
CREATE INDEX IF NOT EXISTS idx_tr_driver ON public.trip_reimbursements(driver_id);
CREATE INDEX IF NOT EXISTS idx_tr_company_status ON public.trip_reimbursements(company_id, status);

DROP TRIGGER IF EXISTS trg_tr_updated_at ON public.trip_reimbursements;
CREATE TRIGGER trg_tr_updated_at BEFORE UPDATE ON public.trip_reimbursements
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.trip_reimbursements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tr_select_member_or_driver" ON public.trip_reimbursements
  FOR SELECT TO authenticated
  USING (
    public.is_company_member(auth.uid(), company_id)
    OR public.is_trip_driver(auth.uid(), driver_id)
  );

CREATE POLICY "tr_insert_manager" ON public.trip_reimbursements
  FOR INSERT TO authenticated WITH CHECK (public.can_manage_fleet(auth.uid(), company_id));

CREATE POLICY "tr_update_manager" ON public.trip_reimbursements
  FOR UPDATE TO authenticated
  USING (public.can_manage_fleet(auth.uid(), company_id))
  WITH CHECK (public.can_manage_fleet(auth.uid(), company_id));

CREATE POLICY "tr_delete_manager" ON public.trip_reimbursements
  FOR DELETE TO authenticated USING (public.can_manage_fleet(auth.uid(), company_id));

-- Storage bucket privado
INSERT INTO storage.buckets (id, name, public)
VALUES ('trip-receipts','trip-receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Policies: pasta raiz = company_id
CREATE POLICY "trip_receipts_select_member"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'trip-receipts'
  AND public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "trip_receipts_insert_member"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'trip-receipts'
  AND public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "trip_receipts_update_member"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'trip-receipts'
  AND public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "trip_receipts_delete_manager"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'trip-receipts'
  AND public.can_manage_fleet(auth.uid(), ((storage.foldername(name))[1])::uuid)
);
