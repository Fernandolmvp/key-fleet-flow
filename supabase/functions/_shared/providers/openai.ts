// Adapter: OpenAI direto (stub — não ativo).
import type { ProviderCallArgs, ProviderCallResult } from "./types.ts";

export async function callOpenAI(_args: ProviderCallArgs): Promise<ProviderCallResult> {
  // TODO: implementar OpenAI Chat Completions (https://api.openai.com/v1/chat/completions)
  return {
    ok: false,
    status: 501,
    kind: "http",
    error: "openai_adapter_not_implemented",
    data: null,
    tokens: { input: 0, output: 0, total: 0 },
  };
}