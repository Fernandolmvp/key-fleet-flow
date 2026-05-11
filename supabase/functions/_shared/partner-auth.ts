// Helper genérico para autenticação de parceiros (postos, oficinas, ...).
// HS256 + PBKDF2. Compatível com tokens emitidos pelo antigo posto-jwt.ts.

const enc = new TextEncoder();
const dec = new TextDecoder();

export type PartnerType = "station" | "workshop";

function b64urlEncode(bytes: Uint8Array): string {
  let s = btoa(String.fromCharCode(...bytes));
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function b64urlDecode(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Mantemos o prefixo "posto::" para tokens já emitidos continuarem válidos.
// Para parceiros futuros (oficina) usamos "partner::<type>::".
async function getKey(scope: string) {
  const secret = Deno.env.get("POSTO_JWT_SECRET") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret) throw new Error("Missing JWT secret");
  return await crypto.subtle.importKey(
    "raw",
    enc.encode(scope + secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export type PartnerClaims = {
  sub: string;          // user id (fuel_station_users.id ou workshop_users.id)
  partner_type: PartnerType;
  partner_id: string;   // station_id ou workshop_id
  station_id?: string;  // alias legado
  company_id: string;
  email: string;
  name: string;
  exp: number;
  iat: number;
};

export async function signPartnerJwt(
  payload: Omit<PartnerClaims, "exp" | "iat" | "station_id"> & { station_id?: string },
  ttlSeconds = 60 * 60 * 12,
): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claims: PartnerClaims = {
    ...payload,
    station_id: payload.partner_type === "station" ? (payload.station_id ?? payload.partner_id) : payload.station_id,
    iat: now,
    exp: now + ttlSeconds,
  };
  // Para station mantém escopo "posto::" (compat); para outros, scope dedicado.
  const scope = payload.partner_type === "station" ? "posto::" : `partner::${payload.partner_type}::`;
  const h = b64urlEncode(enc.encode(JSON.stringify(header)));
  const p = b64urlEncode(enc.encode(JSON.stringify(claims)));
  const data = `${h}.${p}`;
  const key = await getKey(scope);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
  return `${data}.${b64urlEncode(sig)}`;
}

export async function verifyPartnerJwt(token: string, expected?: PartnerType): Promise<PartnerClaims> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid token");
  const [h, p, s] = parts;
  const claims = JSON.parse(dec.decode(b64urlDecode(p))) as PartnerClaims;
  const ptype: PartnerType = claims.partner_type ?? "station";
  const scope = ptype === "station" ? "posto::" : `partner::${ptype}::`;
  const key = await getKey(scope);
  const valid = await crypto.subtle.verify("HMAC", key, b64urlDecode(s), enc.encode(`${h}.${p}`));
  if (!valid) throw new Error("Invalid signature");
  if (claims.exp < Math.floor(Date.now() / 1000)) throw new Error("Token expired");
  if (expected && (claims.partner_type ?? "station") !== expected) throw new Error("Wrong partner type");
  return claims;
}

const PBKDF2_ITERATIONS = 100_000;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64urlEncode(salt)}$${b64urlEncode(new Uint8Array(bits))}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iter = Number(parts[1]);
  const salt = b64urlDecode(parts[2]);
  const expected = b64urlDecode(parts[3]);
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: iter, hash: "SHA-256" },
    key,
    expected.length * 8,
  ));
  if (bits.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < bits.length; i++) diff |= bits[i] ^ expected[i];
  return diff === 0;
}

export function newInvitationToken(): string {
  return b64urlEncode(crypto.getRandomValues(new Uint8Array(32)));
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

export function partnerLabel(t: PartnerType): string {
  return t === "station" ? "posto" : "oficina";
}