type AddrLike = {
  address?: string | null;
  address_number?: string | null;
  address_complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  cep?: string | null;
};

/** Monta string de endereço completo, omitindo partes vazias. */
export function formatAddress(r: AddrLike | null | undefined): string {
  if (!r) return "";
  const street = (r.address ?? "").trim();
  const num = (r.address_number ?? "").trim();
  const comp = (r.address_complement ?? "").trim();
  const bairro = (r.neighborhood ?? "").trim();
  const city = (r.city ?? "").trim();
  const uf = (r.state ?? "").trim();

  const linha1 = [street, num].filter(Boolean).join(", ") + (comp ? ` (${comp})` : "");
  const cityUf = [city, uf].filter(Boolean).join("/");
  return [linha1, bairro, cityUf].filter((s) => s && s.trim()).join(" — ");
}

/** True quando há rua cadastrada mas o número não foi informado (registro antigo). */
export function isAddressMissingNumber(r: AddrLike | null | undefined): boolean {
  if (!r) return false;
  const street = (r.address ?? "").trim();
  const num = (r.address_number ?? "").trim();
  return !!street && !num;
}
