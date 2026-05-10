// Adapter: Anthropic Claude (stub — não ativo).
import type { ProviderCallArgs, ProviderCallResult } from "./types.ts";

export async function callClaude(_args: ProviderCallArgs): Promise<ProviderCallResult> {
  // TODO: implementar Anthropic Messages API (https://api.anthropic.com/v1/messages)
  return {
    ok: false,
    status: 501,
    kind: "http",
    error: "claude_adapter_not_implemented",
    data: null,
    tokens: { input: 0, output: 0, total: 0 },
  };
}