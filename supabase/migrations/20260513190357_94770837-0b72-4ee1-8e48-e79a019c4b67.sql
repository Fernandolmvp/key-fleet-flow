create or replace function public.normalize_plate(p text)
returns text
language plpgsql
immutable
security definer
set search_path = public
as $$
declare
  s text;
  c char;
  m text;
begin
  if p is null then return null; end if;
  s := upper(regexp_replace(p, '[^A-Za-z0-9]', '', 'g'));
  if length(s) <> 7 then
    return s;
  end if;
  if substring(s,5,1) ~ '[A-Z]' then
    return s;
  end if;
  if s ~ '^[A-Z]{3}[0-9]{4}$' then
    c := substring(s,5,1);
    m := chr(ascii('A') + (c::int));
    return substring(s,1,4) || m || substring(s,6,2);
  end if;
  return s;
end
$$;

alter table public.vehicles
  add column if not exists normalized_plate text
  generated always as (public.normalize_plate(plate)) stored;

create index if not exists idx_vehicles_normalized_plate
  on public.vehicles (company_id, normalized_plate);
create index if not exists idx_vehicles_renavam
  on public.vehicles (company_id, renavam);

create or replace function public.match_policies_for_vehicle(_vehicle_id uuid)
returns table (policy_id uuid, match_by text)
language sql
stable
security definer
set search_path = public
as $$
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
    where ipv.vehicle_id = _vehicle_id and ipv.removed_at is null;
$$;

create or replace function public.match_vehicles_for_ai_plate(
  _company_id uuid, _plate text, _chassis text default null, _renavam text default null
) returns table (vehicle_id uuid, match_by text)
language sql stable security definer set search_path = public as $$
  with t as (
    select public.normalize_plate(_plate) as np,
           upper(regexp_replace(coalesce(_chassis,''),'[^A-Za-z0-9]','','g')) as ch,
           regexp_replace(coalesce(_renavam,''),'[^0-9]','','g') as rn
  )
  select v.id, 'plate'::text   from public.vehicles v, t
    where v.company_id = _company_id and t.np is not null and v.normalized_plate = t.np
  union
  select v.id, 'chassis'::text from public.vehicles v, t
    where v.company_id = _company_id and t.ch <> ''
      and upper(regexp_replace(coalesce(v.chassis,''),'[^A-Za-z0-9]','','g'))
          in (t.ch, right(t.ch,8))
  union
  select v.id, 'renavam'::text from public.vehicles v, t
    where v.company_id = _company_id and t.rn <> ''
      and regexp_replace(coalesce(v.renavam,''),'[^0-9]','','g') = t.rn;
$$;