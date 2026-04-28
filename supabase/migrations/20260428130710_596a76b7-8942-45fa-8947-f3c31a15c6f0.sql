
-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('admin','gestor_frota','manutencao','financeiro','motorista','auditor');
CREATE TYPE public.vehicle_status AS ENUM ('ativo','manutencao','vendido','parado','sinistrado');
CREATE TYPE public.driver_status AS ENUM ('ativo','inativo','ferias','afastado');
CREATE TYPE public.fuel_type AS ENUM ('gasolina','etanol','diesel','diesel_s10','flex','gnv','eletrico','hibrido');

-- =========================================================
-- COMPANIES & BRANCHES
-- =========================================================
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cnpj TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  city TEXT,
  state TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_branches_company ON public.branches(company_id);

-- =========================================================
-- PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  current_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================
-- COMPANY MEMBERS & ROLES
-- =========================================================
CREATE TABLE public.company_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, user_id)
);
CREATE INDEX idx_members_user ON public.company_members(user_id);
CREATE INDEX idx_members_company ON public.company_members(company_id);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, company_id, role)
);
CREATE INDEX idx_roles_lookup ON public.user_roles(user_id, company_id);

-- =========================================================
-- SECURITY DEFINER HELPERS (avoid RLS recursion)
-- =========================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _company_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND company_id = _company_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_company_member(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE user_id = _user_id AND company_id = _company_id
  )
$$;

CREATE OR REPLACE FUNCTION public.can_manage_fleet(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND company_id = _company_id
      AND role IN ('admin','gestor_frota')
  )
$$;

-- =========================================================
-- COST CENTERS
-- =========================================================
CREATE TABLE public.cost_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, code)
);
CREATE INDEX idx_cost_centers_company ON public.cost_centers(company_id);

-- =========================================================
-- VEHICLES
-- =========================================================
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  plate TEXT NOT NULL,
  renavam TEXT,
  chassis TEXT,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  year_manufacture INT,
  year_model INT,
  color TEXT,
  fuel_type public.fuel_type,
  tank_capacity NUMERIC(6,2),
  vehicle_type TEXT,
  current_km INT NOT NULL DEFAULT 0,
  status public.vehicle_status NOT NULL DEFAULT 'ativo',
  responsible TEXT,
  has_tracker BOOLEAN NOT NULL DEFAULT FALSE,
  insurer TEXT,
  insurance_policy TEXT,
  insurance_expires_at DATE,
  fipe_value NUMERIC(12,2),
  photos TEXT[] NOT NULL DEFAULT '{}',
  documents TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, plate)
);
CREATE INDEX idx_vehicles_company ON public.vehicles(company_id);
CREATE INDEX idx_vehicles_status ON public.vehicles(company_id, status);

-- =========================================================
-- DRIVERS
-- =========================================================
CREATE TABLE public.drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  cpf TEXT,
  phone TEXT,
  email TEXT,
  cnh_number TEXT,
  cnh_category TEXT,
  cnh_expires_at DATE,
  medical_exam_expires_at DATE,
  address TEXT,
  photo_url TEXT,
  status public.driver_status NOT NULL DEFAULT 'ativo',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, cpf)
);
CREATE INDEX idx_drivers_company ON public.drivers(company_id);

-- =========================================================
-- AUDIT LOGS
-- =========================================================
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  action TEXT NOT NULL,
  changes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_company ON public.audit_logs(company_id, created_at DESC);

-- =========================================================
-- updated_at trigger
-- =========================================================
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER t_companies_updated BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER t_branches_updated BEFORE UPDATE ON public.branches FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER t_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER t_costcenters_updated BEFORE UPDATE ON public.cost_centers FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER t_vehicles_updated BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER t_drivers_updated BEFORE UPDATE ON public.drivers FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================
-- AUTO-CREATE PROFILE on signup
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)));
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- ENABLE RLS
-- =========================================================
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- RLS POLICIES
-- =========================================================

-- profiles
CREATE POLICY "own profile select" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- companies: members can view; admins update
CREATE POLICY "members view companies" ON public.companies FOR SELECT
  USING (public.is_company_member(auth.uid(), id));
CREATE POLICY "admins update companies" ON public.companies FOR UPDATE
  USING (public.has_role(auth.uid(), id, 'admin'));
CREATE POLICY "anyone create companies" ON public.companies FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- company_members
CREATE POLICY "view own memberships" ON public.company_members FOR SELECT
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), company_id, 'admin'));
CREATE POLICY "admins manage members" ON public.company_members FOR ALL
  USING (public.has_role(auth.uid(), company_id, 'admin'))
  WITH CHECK (public.has_role(auth.uid(), company_id, 'admin'));
CREATE POLICY "self insert membership" ON public.company_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- user_roles
CREATE POLICY "view own roles" ON public.user_roles FOR SELECT
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), company_id, 'admin'));
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), company_id, 'admin'))
  WITH CHECK (public.has_role(auth.uid(), company_id, 'admin'));
CREATE POLICY "self bootstrap admin role" ON public.user_roles FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE company_id = user_roles.company_id)
  );

-- branches
CREATE POLICY "members view branches" ON public.branches FOR SELECT
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "managers write branches" ON public.branches FOR ALL
  USING (public.can_manage_fleet(auth.uid(), company_id))
  WITH CHECK (public.can_manage_fleet(auth.uid(), company_id));

-- cost_centers
CREATE POLICY "members view cost centers" ON public.cost_centers FOR SELECT
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "managers write cost centers" ON public.cost_centers FOR ALL
  USING (public.can_manage_fleet(auth.uid(), company_id))
  WITH CHECK (public.can_manage_fleet(auth.uid(), company_id));

-- vehicles
CREATE POLICY "members view vehicles" ON public.vehicles FOR SELECT
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "managers write vehicles" ON public.vehicles FOR ALL
  USING (public.can_manage_fleet(auth.uid(), company_id))
  WITH CHECK (public.can_manage_fleet(auth.uid(), company_id));

-- drivers
CREATE POLICY "members view drivers" ON public.drivers FOR SELECT
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "managers write drivers" ON public.drivers FOR ALL
  USING (public.can_manage_fleet(auth.uid(), company_id))
  WITH CHECK (public.can_manage_fleet(auth.uid(), company_id));

-- audit_logs (admins read; system inserts)
CREATE POLICY "admins read audit" ON public.audit_logs FOR SELECT
  USING (public.has_role(auth.uid(), company_id, 'admin'));
CREATE POLICY "members insert audit" ON public.audit_logs FOR INSERT
  WITH CHECK (public.is_company_member(auth.uid(), company_id));

-- =========================================================
-- STORAGE BUCKETS
-- =========================================================
INSERT INTO storage.buckets (id, name, public) VALUES
  ('vehicle-photos','vehicle-photos', true),
  ('vehicle-docs','vehicle-docs', false),
  ('driver-photos','driver-photos', true),
  ('company-logos','company-logos', true)
ON CONFLICT (id) DO NOTHING;

-- vehicle-photos (public read, authenticated write within own company folder)
CREATE POLICY "vehicle photos public read" ON storage.objects FOR SELECT
  USING (bucket_id = 'vehicle-photos');
CREATE POLICY "vehicle photos auth write" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'vehicle-photos' AND auth.uid() IS NOT NULL);
CREATE POLICY "vehicle photos auth update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'vehicle-photos' AND auth.uid() IS NOT NULL);
CREATE POLICY "vehicle photos auth delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'vehicle-photos' AND auth.uid() IS NOT NULL);

-- vehicle-docs (private)
CREATE POLICY "vehicle docs auth read" ON storage.objects FOR SELECT
  USING (bucket_id = 'vehicle-docs' AND auth.uid() IS NOT NULL);
CREATE POLICY "vehicle docs auth write" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'vehicle-docs' AND auth.uid() IS NOT NULL);
CREATE POLICY "vehicle docs auth update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'vehicle-docs' AND auth.uid() IS NOT NULL);
CREATE POLICY "vehicle docs auth delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'vehicle-docs' AND auth.uid() IS NOT NULL);

-- driver-photos
CREATE POLICY "driver photos public read" ON storage.objects FOR SELECT
  USING (bucket_id = 'driver-photos');
CREATE POLICY "driver photos auth write" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'driver-photos' AND auth.uid() IS NOT NULL);
CREATE POLICY "driver photos auth update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'driver-photos' AND auth.uid() IS NOT NULL);
CREATE POLICY "driver photos auth delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'driver-photos' AND auth.uid() IS NOT NULL);

-- company-logos
CREATE POLICY "company logos public read" ON storage.objects FOR SELECT
  USING (bucket_id = 'company-logos');
CREATE POLICY "company logos auth write" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'company-logos' AND auth.uid() IS NOT NULL);
