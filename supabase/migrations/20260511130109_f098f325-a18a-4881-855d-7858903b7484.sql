create table public.partner_invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  partner_type text not null check (partner_type in ('station','workshop')),
  partner_id uuid not null,
  email text not null,
  name text not null,
  role text not null default 'operador',
  kind text not null default 'invite' check (kind in ('invite','reset')),
  token text not null unique,
  status text not null default 'pending' check (status in ('pending','accepted','expired','cancelled')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  cancelled_at timestamptz,
  attempts int not null default 0,
  resent_count int not null default 0,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_partner_inv_company_status on public.partner_invitations(company_id, status);
create index idx_partner_inv_partner on public.partner_invitations(partner_type, partner_id);
create unique index uq_partner_inv_pending_email on public.partner_invitations(partner_id, lower(email)) where status = 'pending';

alter table public.partner_invitations enable row level security;

create policy "members read partner invitations"
  on public.partner_invitations for select to authenticated
  using (public.is_company_member(auth.uid(), company_id));

create policy "managers manage partner invitations"
  on public.partner_invitations for all to authenticated
  using (public.can_manage_fleet(auth.uid(), company_id))
  with check (public.can_manage_fleet(auth.uid(), company_id));

create trigger trg_partner_invitations_updated
  before update on public.partner_invitations
  for each row execute function public.set_updated_at();