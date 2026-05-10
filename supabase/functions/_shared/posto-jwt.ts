// Mini HMAC-SHA256 JWT (HS256) usando SUPABASE_SERVICE_ROLE_KEY como base do segredo.
// Não depende de libs externas.

const enc = new TextEncoder();
const dec = new TextDecoder();

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

async function getKey() {
  const secret = Deno.env.get("POSTO_JWT_SECRET") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret) throw new Error("Missing JWT secret");
  return await crypto.subtle.importKey(
    "raw",
    enc.encode("posto::" + secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export type PostoClaims = {
  sub: string;        // fuel_station_user.id
  station_id: string;
  company_id: string;
  email: string;
  name: string;
  exp: number;
  iat: number;
};

export async function signPostoJwt(payload: Omit<PostoClaims, "exp" | "iat">, ttlSeconds = 60 * 60 * 12): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claims: PostoClaims = { ...payload, iat: now, exp: now + ttlSeconds };
  const h = b64urlEncode(enc.encode(JSON.stringify(header)));
  const p = b64urlEncode(enc.encode(JSON.stringify(claims)));
  const data = `${h}.${p}`;
  const key = await getKey();
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
  return `${data}.${b64urlEncode(sig)}`;
}

export async function verifyPostoJwt(token: string): Promise<PostoClaims> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid token");
  const [h, p, s] = parts;
  const key = await getKey();
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    b64urlDecode(s),
    enc.encode(`${h}.${p}`),
  );
  if (!valid) throw new Error("Invalid signature");
  const claims = JSON.parse(dec.decode(b64urlDecode(p))) as PostoClaims;
  if (claims.exp < Math.floor(Date.now() / 1000)) throw new Error("Token expired");
  return claims;
}

// bcrypt simples via Web Crypto não existe; usamos PBKDF2 (forte e nativo).
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

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};