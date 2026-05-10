// Adapter: Lovable AI Gateway (compatível OpenAI Chat Completions).
import type { ProviderCallArgs, ProviderCallResult } from "./types.ts";

const DEFAULT_BASE = "https://ai.gateway.lovable.dev/v1";

function buildUrl(endpoint?: string | null): string {
  const base = (endpoint || DEFAULT_BASE).replace(/\/$/, "");
  return base.endsWith("/chat/completions") ? base : `${base}/chat/completions`;
}

export async function callLovable(args: ProviderCallArgs): Promise<ProviderCallResult> {
  const url = buildUrl(args.endpoint);
  const body: Record<string, unknown> = {
    model: args.model,
    messages: args.messages,
  };
  if (args.tools) body.tools = args.tools;
  if (args.toolChoice) body.tool_choice = args.toolChoice;

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: args.signal,
    });

    if (!resp.ok) {
      let errText = "";
      try { errText = await resp.text(); } catch { /* ignore */ }
      return {
        ok: false,
        status: resp.status,
        kind: "http",
        error: `lovable_http_${resp.status}${errText ? `: ${errText.slice(0, 200)}` : ""}`,
        data: null,
        tokens: { input: 0, output: 0, total: 0 },
      };
    }

    const data = await resp.json();
    const u = data?.usage ?? {};
    const input = Number(u.prompt_tokens ?? u.input_tokens ?? 0) || 0;
    const output = Number(u.completion_tokens ?? u.output_tokens ?? 0) || 0;
    const total = Number(u.total_tokens ?? input + output) || 0;
    return {
      ok: true,
      status: resp.status,
      kind: "ok",
      error: null,
      data,
      tokens: { input, output, total },
    };
  } catch (e: any) {
    const isAbort = e?.name === "AbortError";
    return {
      ok: false,
      status: null,
      kind: isAbort ? "timeout" : "network",
      error: isAbort ? "lovable_timeout" : `lovable_network: ${String(e?.message ?? e)}`,
      data: null,
      tokens: { input: 0, output: 0, total: 0 },
    };
  }
}