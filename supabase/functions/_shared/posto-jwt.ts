// Wrapper de compatibilidade para o helper genérico de parceiros.
// Mantém a API antiga (signPostoJwt / verifyPostoJwt / hashPassword / verifyPassword / corsHeaders)
// usada por posto-login, posto-confirm, posto-list, posto-admin-user.
import {
  signPartnerJwt,
  verifyPartnerJwt,
  hashPassword,
  verifyPassword,
  corsHeaders,
  type PartnerClaims,
} from "./partner-auth.ts";

export type PostoClaims = {
  sub: string;
  station_id: string;
  company_id: string;
  email: string;
  name: string;
  exp: number;
  iat: number;
};

export async function signPostoJwt(
  payload: Omit<PostoClaims, "exp" | "iat">,
  ttlSeconds = 60 * 60 * 12,
): Promise<string> {
  return signPartnerJwt(
    {
      sub: payload.sub,
      partner_type: "station",
      partner_id: payload.station_id,
      station_id: payload.station_id,
      company_id: payload.company_id,
      email: payload.email,
      name: payload.name,
    },
    ttlSeconds,
  );
}

export async function verifyPostoJwt(token: string): Promise<PostoClaims> {
  const c: PartnerClaims = await verifyPartnerJwt(token, "station");
  return {
    sub: c.sub,
    station_id: c.station_id ?? c.partner_id,
    company_id: c.company_id,
    email: c.email,
    name: c.name,
    exp: c.exp,
    iat: c.iat,
  };
}

export { hashPassword, verifyPassword, corsHeaders };