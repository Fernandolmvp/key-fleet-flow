-- ENUMS
CREATE TYPE public.tire_status AS ENUM ('estoque','instalado','recapagem','descartado');
CREATE TYPE public.tire_kind AS ENUM ('novo','recapado','remold');
CREATE TYPE public.tire_movement_type AS ENUM ('instalacao','remocao','rodizio','recapagem','descarte','calibragem','inspecao','compra');
CREATE TYPE public.axle_layout AS ENUM ('moto_2','carro_4','truck_6','truck_10','carreta_18','custom');

-- TIRES
CREATE TABLE public.tires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  serial text,
  brand text NOT NULL,
  model text,
  size text NOT NULL,
  dot text,
  kind public.tire_kind NOT NULL DEFAULT 'novo',
  status public.tire_status NOT NULL DEFAULT 'estoque',
  initial_tread_mm numeric,
  current_tread_mm numeric,
  min_tread_mm numeric DEFAULT 1.6,
  km_target integer DEFAULT 60000,
  km_accumulated integer NOT NULL DEFAULT 0,
  purchase_price numeric,
  purchase_date date,
  supplier text,
  invoice_url text,
  invoice_number text,
  recap_count integer NOT NULL DEFAULT 0,
  current_vehicle_id uuid,
  current_position text,
  notes text,
  attachments text[] NOT NULL DEFAULT '{}',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tires_company ON public.tires(company_id);
CREATE INDEX idx_tires_status ON public.tires(status);
CREATE INDEX idx_tires_current_vehicle ON public.tires(current_vehicle_id);

ALTER TABLE public.tires ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view tires" ON public.tires FOR SELECT
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "managers write tires" ON public.tires FOR ALL
  USING (public.can_manage_fleet(auth.uid(), company_id))
  WITH CHECK (public.can_manage_fleet(auth.uid(), company_id));

CREATE TRIGGER tires_updated BEFORE UPDATE ON public.tires
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- VEHICLE AXLE LAYOUTS
CREATE TABLE public.vehicle_axle_layouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  vehicle_id uuid NOT NULL UNIQUE,
  layout public.axle_layout NOT NULL DEFAULT 'carro_4',
  positions text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_axle_layouts_company ON public.vehicle_axle_layouts(company_id);

ALTER TABLE public.vehicle_axle_layouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view layouts" ON public.vehicle_axle_layouts FOR SELECT
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "managers write layouts" ON public.vehicle_axle_layouts FOR ALL
  USING (public.can_manage_fleet(auth.uid(), company_id))
  WITH CHECK (public.can_manage_fleet(auth.uid(), company_id));

CREATE TRIGGER axle_layouts_updated BEFORE UPDATE ON public.vehicle_axle_layouts
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- TIRE MOVEMENTS
CREATE TABLE public.tire_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  tire_id uuid NOT NULL,
  vehicle_id uuid,
  movement_type public.tire_movement_type NOT NULL,
  from_position text,
  to_position text,
  vehicle_km integer,
  tread_mm numeric,
  pressure_psi numeric,
  cost numeric,
  reason text,
  notes text,
  invoice_url text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tire_movements_company ON public.tire_movements(company_id);
CREATE INDEX idx_tire_movements_tire ON public.tire_movements(tire_id);
CREATE INDEX idx_tire_movements_vehicle ON public.tire_movements(vehicle_id);

ALTER TABLE public.tire_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view tire movements" ON public.tire_movements FOR SELECT
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "managers write tire movements" ON public.tire_movements FOR ALL
  USING (public.can_manage_fleet(auth.uid(), company_id))
  WITH CHECK (public.can_manage_fleet(auth.uid(), company_id));

-- TRIGGER: when movement is recorded, update the tire state
CREATE OR REPLACE FUNCTION public.tg_tire_movement_apply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t RECORD;
BEGIN
  SELECT * INTO t FROM public.tires WHERE id = NEW.tire_id;
  IF t IS NULL THEN RETURN NEW; END IF;

  IF NEW.movement_type = 'instalacao' THEN
    UPDATE public.tires SET
      status = 'instalado',
      current_vehicle_id = NEW.vehicle_id,
      current_position = NEW.to_position,
      current_tread_mm = COALESCE(NEW.tread_mm, current_tread_mm)
    WHERE id = NEW.tire_id;
  ELSIF NEW.movement_type = 'remocao' THEN
    UPDATE public.tires SET
      status = 'estoque',
      current_vehicle_id = NULL,
      current_position = NULL,
      current_tread_mm = COALESCE(NEW.tread_mm, current_tread_mm)
    WHERE id = NEW.tire_id;
  ELSIF NEW.movement_type = 'rodizio' THEN
    UPDATE public.tires SET
      current_position = NEW.to_position,
      current_tread_mm = COALESCE(NEW.tread_mm, current_tread_mm)
    WHERE id = NEW.tire_id;
  ELSIF NEW.movement_type = 'recapagem' THEN
    UPDATE public.tires SET
      status = 'recapagem',
      kind = 'recapado',
      current_vehicle_id = NULL,
      current_position = NULL,
      recap_count = recap_count + 1,
      initial_tread_mm = COALESCE(NEW.tread_mm, initial_tread_mm),
      current_tread_mm = COALESCE(NEW.tread_mm, current_tread_mm),
      km_accumulated = 0
    WHERE id = NEW.tire_id;
  ELSIF NEW.movement_type = 'descarte' THEN
    UPDATE public.tires SET
      status = 'descartado',
      current_vehicle_id = NULL,
      current_position = NULL
    WHERE id = NEW.tire_id;
  ELSIF NEW.movement_type IN ('calibragem','inspecao') THEN
    UPDATE public.tires SET
      current_tread_mm = COALESCE(NEW.tread_mm, current_tread_mm)
    WHERE id = NEW.tire_id;
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER tire_movement_apply
AFTER INSERT ON public.tire_movements
FOR EACH ROW EXECUTE FUNCTION public.tg_tire_movement_apply();

-- STORAGE bucket for tire docs
INSERT INTO storage.buckets (id, name, public) VALUES ('tire-docs','tire-docs', false);

CREATE POLICY "members read tire docs" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'tire-docs' AND
    public.is_company_member(auth.uid(), (storage.foldername(name))[1]::uuid)
  );

CREATE POLICY "managers upload tire docs" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'tire-docs' AND
    public.can_manage_fleet(auth.uid(), (storage.foldername(name))[1]::uuid)
  );

CREATE POLICY "managers update tire docs" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'tire-docs' AND
    public.can_manage_fleet(auth.uid(), (storage.foldername(name))[1]::uuid)
  );

CREATE POLICY "managers delete tire docs" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'tire-docs' AND
    public.can_manage_fleet(auth.uid(), (storage.foldername(name))[1]::uuid)
  );