import { describe, expect, it } from "vitest";
import { agentStatistic, agentStatusMeta, generateAgentKey, isAgentOffline } from "./agent";

describe("status do agente", () => {
  it("usa verde somente quando o WhatsApp está conectado", () => {
    expect(agentStatusMeta("conectado").dot).toBe("bg-success");
    expect(agentStatusMeta("aguardando_qr").dot).toBe("bg-warning");
    expect(agentStatusMeta("erro").dot).toBe("bg-destructive");
    expect(agentStatusMeta(null).dot).toBe("bg-muted-foreground");
  });

  it("considera o motor offline após 60 segundos sem contato", () => {
    const now = new Date("2026-11-24T20:00:00Z").getTime();
    expect(isAgentOffline("2026-11-24T19:59:00Z", now)).toBe(false);
    expect(isAgentOffline("2026-11-24T19:58:59Z", now)).toBe(true);
    expect(isAgentOffline(null, now)).toBe(true);
  });

  it("gera uma chave com o prefixo e os 40 caracteres contratados", () => {
    const key = generateAgentKey();
    expect(key).toMatch(/^fo_agent_[A-Za-z0-9]{40}$/);
    expect(key.slice(0, 8)).toBe("fo_agent");
  });

  it("não inventa estatísticas ausentes", () => {
    expect(agentStatistic({ mensagens_hoje: 12 }, "mensagens_hoje")).toBe("12");
    expect(agentStatistic({}, "mensagens_hoje")).toBe("—");
  });
});
