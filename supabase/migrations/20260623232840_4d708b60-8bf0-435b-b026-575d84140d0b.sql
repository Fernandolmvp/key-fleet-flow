
CREATE TABLE public.detran_calendar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estado text NOT NULL,
  final_placa int NOT NULL CHECK (final_placa BETWEEN 0 AND 9),
  mes_vencimento int NOT NULL CHECK (mes_vencimento BETWEEN 1 AND 12),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (estado, final_placa)
);

GRANT SELECT ON public.detran_calendar TO authenticated;
GRANT ALL ON public.detran_calendar TO service_role;

ALTER TABLE public.detran_calendar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read detran calendar"
ON public.detran_calendar FOR SELECT
TO authenticated
USING (true);

INSERT INTO public.detran_calendar (estado, final_placa, mes_vencimento) VALUES
  ('SP', 1, 7),
  ('SP', 2, 7),
  ('SP', 3, 8),
  ('SP', 4, 8),
  ('SP', 5, 8),
  ('SP', 6, 9),
  ('SP', 7, 10),
  ('SP', 8, 10),
  ('SP', 9, 11),
  ('SP', 0, 12);

ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS licensing_uf text;
