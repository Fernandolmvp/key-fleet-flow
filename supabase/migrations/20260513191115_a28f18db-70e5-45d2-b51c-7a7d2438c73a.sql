
-- Tabela de vinculações manuais
CREATE TABLE public.vehicle_policy_manual_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  policy_id uuid NOT NULL REFERENCES public.insurance_policies(id) ON DELETE CASCADE,
  ai_plate text NOT NULL,
  normalized_plate text NOT NULL,
  matched_by uuid,
  matched_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL DEFAULT 'manual_review',
  notes text,
  can_be_revoked boolean NOT NULL DEFAULT true,
  revoked_at timestamptz,
  revoked_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_vpmm_company ON public.vehicle_policy_manual_matches(company_id);
CREATE INDEX idx_vpmm_vehicle ON public.vehicle_policy_manual_matches(vehicle_id);
CREATE INDEX idx_vpmm_policy ON public.vehicle_policy_manual_matches(policy_id);
CREATE INDEX idx_vpmm_active ON public.vehicle_policy_manual_matches(policy_id, normalized_plate) WHERE revoked_at IS NULL;

ALTER TABLE public.vehicle_policy_manual_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view manual matches" ON public.vehicle_policy_manual_matches
  FOR SELECT USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "managers write manual matches" ON public.vehicle_policy_manual_matches
  FOR ALL USING (public.can_manage_fleet(auth.uid(), company_id))
  WITH CHECK (public.can_manage_fleet(auth.uid(), company_id));

CREATE TRIGGER trg_vpmm_updated BEFORE UPDATE ON public.vehicle_policy_manual_matches
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Tabela de placas externas (não pertencem à frota)
CREATE TABLE public.policy_external_plates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  policy_id uuid NOT NULL REFERENCES public.insurance_policies(id) ON DELETE CASCADE,
  ai_plate text NOT NULL,
  normalized_plate text NOT NULL,
  marked_by uuid,
  marked_at timestamptz NOT NULL DEFAULT now(),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (policy_id, normalized_plate)
);

CREATE INDEX idx_pep_company ON public.policy_external_plates(company_id);
CREATE INDEX idx_pep_policy ON public.policy_external_plates(policy_id);

ALTER TABLE public.policy_external_plates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view external plates" ON public.policy_external_plates
  FOR SELECT USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "managers write external plates" ON public.policy_external_plates
  FOR ALL USING (public.can_manage_fleet(auth.uid(), company_id))
  WITH CHECK (public.can_manage_fleet(auth.uid(), company_id));

CREATE TRIGGER trg_pep_updated BEFORE UPDATE ON public.policy_external_plates
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Atualiza match_policies_for_vehicle para incluir vínculo manual
CREATE OR REPLACE FUNCTION public.match_policies_for_vehicle(_vehicle_id uuid)
 RETURNS TABLE(policy_id uuid, match_by text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with v as (
    select id, company_id, normalized_plate,
           upper(regexp_replace(coalesce(chassis,''), '[^A-Za-z0-9]', '', 'g')) as chs,
           regexp_replace(coalesce(renavam,''), '[^0-9]', '', 'g') as rnv
    from public.vehicles where id = _vehicle_id
  ),
  ai as (
    select p.id as policy_id,
           public.normalize_plate(a.elem->>'plate') as np,
           upper(regexp_replace(coalesce(a.elem->>'chassis',''),'[^A-Za-z0-9]','','g')) as ch,
           regexp_replace(coalesce(a.elem->>'renavam',''),'[^0-9]','','g') as rn
      from public.insurance_policies p, v
      cross join lateral jsonb_array_elements(coalesce(p.ai_extracted->'vehicles','[]'::jsonb)) as a(elem)
      where p.company_id = v.company_id
        and p.status = 'ativa'
        and (p.end_date is null or p.end_date >= current_date)
  )
  select policy_id, 'plate'::text   from ai, v where ai.np is not null and ai.np = v.normalized_plate
  union
  select policy_id, 'chassis'::text from ai, v where v.chs <> '' and ai.ch <> ''
                                            and (ai.ch = v.chs or right(ai.ch,8) = right(v.chs,8))
  union
  select policy_id, 'renavam'::text from ai, v where v.rnv <> '' and ai.rn = v.rnv
  union
  select ipv.policy_id, 'link'::text
    from public.insurance_policy_vehicles ipv
    where ipv.vehicle_id = _vehicle_id and ipv.removed_at is null
  union
  select m.policy_id, 'manual'::text
    from public.vehicle_policy_manual_matches m
    where m.vehicle_id = _vehicle_id and m.revoked_at is null;
$function$;
