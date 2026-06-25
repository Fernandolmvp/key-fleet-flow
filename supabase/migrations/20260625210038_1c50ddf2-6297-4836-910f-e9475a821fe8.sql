
-- Add categoria column to detran_calendar (leve = carros/motos/ônibus/reboques; pesado = caminhões/tratores)
ALTER TABLE public.detran_calendar
  ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT 'leve';

-- Drop old unique if exists, recreate with categoria
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'detran_calendar_estado_final_placa_key'
  ) THEN
    ALTER TABLE public.detran_calendar DROP CONSTRAINT detran_calendar_estado_final_placa_key;
  END IF;
END$$;

CREATE UNIQUE INDEX IF NOT EXISTS detran_calendar_uf_cat_final_uk
  ON public.detran_calendar(estado, categoria, final_placa);

-- Atualiza SP leve: final 5 deve vencer em setembro (não agosto)
UPDATE public.detran_calendar SET mes_vencimento = 9
  WHERE estado = 'SP' AND categoria = 'leve' AND final_placa = 5;

-- Seed SP pesado (caminhões e tratores)
INSERT INTO public.detran_calendar (estado, categoria, final_placa, mes_vencimento) VALUES
  ('SP','pesado',1,9),('SP','pesado',2,9),
  ('SP','pesado',3,10),('SP','pesado',4,10),('SP','pesado',5,10),
  ('SP','pesado',6,11),('SP','pesado',7,11),('SP','pesado',8,11),
  ('SP','pesado',9,12),('SP','pesado',0,12)
ON CONFLICT (estado, categoria, final_placa) DO UPDATE SET mes_vencimento = EXCLUDED.mes_vencimento;
