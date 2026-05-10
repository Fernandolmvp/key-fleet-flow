// Tipos compartilhados entre adapters de provedores de IA.
// Cada adapter implementa callX(args): Promise<ProviderCallResult>.

export type ProviderCallArgs = {
  secret: string;
  model: string;            // model_id (ex.: "google/gemini-2.5-flash")
  endpoint?: string | null; // override do api_endpoint vindo do banco
  messages: any[];          // formato OpenAI
  tools?: any[];
  toolChoice?: any;
  signal?: AbortSignal;
};

export type ProviderErrorKind = "http" | "network" | "timeout" | "no_secret" | "ok";

export type ProviderCallResult = {
  ok: boolean;
  status: number | null;
  kind: ProviderErrorKind;
  error: string | null;
  /** Resposta normalizada no shape OpenAI: choices[0].message.{content,tool_calls} */
  data: any | null;
  tokens: { input: number; output: number; total: number };
};