/**
 * Traduz erros de constraint do Postgres/Supabase para mensagens
 * amigáveis em português. Use em todos os formulários:
 *
 *   toast.error(translateDbError(error));
 *
 * Aceita um objeto com `message`/`details`/`hint` ou uma string.
 */
const CONSTRAINT_MAP: Record<string, string> = {
  chk_fuel_records_liters_pos: "A quantidade de litros precisa ser maior que zero.",
  chk_fuel_records_price_pos: "O valor por litro precisa ser maior que zero.",
  chk_fuel_records_total_pos: "O valor total precisa ser maior que zero.",
  chk_fuel_records_km_pos: "O KM informado precisa ser maior que zero.",
  chk_fuel_records_source_origin: "Origem do abastecimento inválida.",
  fuel_records_liters_check: "A quantidade de litros precisa ser maior que zero.",
  fuel_records_price_per_liter_check: "O valor por litro precisa ser maior que zero.",
  fuel_records_total_value_check: "O valor total precisa ser maior que zero.",
  fuel_records_km_at_fueling_check: "O KM informado precisa ser maior que zero.",
};

const REGEX_PATTERNS: Array<{ re: RegExp; msg: (m: RegExpMatchArray) => string }> = [
  {
    re: /violates check constraint "([^"]+)"/i,
    msg: (m) => CONSTRAINT_MAP[m[1]] ?? `Dados inválidos para a regra "${m[1]}".`,
  },
  {
    re: /duplicate key value violates unique constraint "([^"]+)"/i,
    msg: () => "Este registro já existe (duplicado).",
  },
  {
    re: /violates foreign key constraint/i,
    msg: () => "Referência inválida: o registro vinculado não existe ou foi removido.",
  },
  {
    re: /null value in column "([^"]+)"/i,
    msg: (m) => `O campo "${m[1]}" é obrigatório.`,
  },
  {
    re: /permission denied/i,
    msg: () => "Você não tem permissão para realizar esta ação.",
  },
];

export function translateDbError(err: unknown): string {
  if (!err) return "Erro desconhecido.";
  const raw =
    typeof err === "string"
      ? err
      : (err as any)?.message || (err as any)?.error_description || String(err);

  for (const { re, msg } of REGEX_PATTERNS) {
    const m = raw.match(re);
    if (m) return msg(m);
  }
  // Se não bateu em nenhum padrão e é claramente inglês técnico, dá uma genérica.
  if (/new row for relation|constraint|relation .* does not exist/i.test(raw)) {
    return "Não foi possível salvar: dados inválidos. Confira os campos destacados e tente novamente.";
  }
  return raw;
}